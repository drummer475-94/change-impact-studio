import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  analyzePlan,
  calculatePlanSafetyScore,
  calculateSafetyScore,
  checkRecoveryWindowSLA,
  demoChanges,
  normalizeChange,
  parseCSV,
  parseJiraServiceManagementExport,
  parsePlanText,
  parseServiceNowExport,
  validateRollbackWorkflow
} from '../core.js'

test('browser importer exposes the CSV and JSON formats supported by the parser', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

  assert.match(html, /id="fileInput"/)
  assert.match(html, /accept="[^"]*\.json[^"]*\.csv[^"]*"/)
  assert.match(html, /aria-label="[^"]*ServiceNow[^"]*Jira[^"]*JSON or CSV"/)
})

test('parseCSV parses quoted strings, escaping, commas, and line breaks correctly', () => {
  const csv = `"id","title","service","description"\r\nCHG-101,"Upgrade ""core"" router, primary",Network,"Line 1\r\nLine 2"\r\nCHG-102,Simple change,App,No quotes`

  const rows = parseCSV(csv)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].id, 'CHG-101')
  assert.equal(rows[0].title, 'Upgrade "core" router, primary')
  assert.equal(rows[0].description.replace(/\r\n/g, '\n'), 'Line 1\nLine 2')
  assert.equal(rows[1].id, 'CHG-102')

  assert.deepEqual(parseCSV(''), [])
  assert.deepEqual(parseCSV(null), [])
  assert.deepEqual(parseCSV('    \n   '), [])
})

test('parseServiceNowExport handles CSV, JSON, JS objects, and fallback values', () => {
  const snowCSV = `number,short_description,cmdb_ci,start_date,end_date,assigned_to,type,risk,backout_plan,test_plan,cmdb_ci_services
CHG-SNOW-001,Database security patch,UserDB,2026-08-15T10:00:00Z,2026-08-15T12:00:00Z,Alice,normal,1 - High,Restore snapshot from backup,Run benchmark query,UserDB
CHG-SNOW-002,Cache flush,RedisCache,2026-08-15T13:00:00Z,2026-08-15T13:30:00Z,Bob,standard,2 - Moderate,,,
CHG-SNOW-003,Minor edit,Docs,2026-08-15T14:00:00Z,2026-08-15T14:30:00Z,Charlie,minor,5 - Very Low,,,`

  const changesCSV = parseServiceNowExport(snowCSV)
  assert.equal(changesCSV.length, 3)
  assert.equal(changesCSV[0].id, 'CHG-SNOW-001')
  assert.equal(changesCSV[0].likelihood, 4)
  assert.equal(changesCSV[1].likelihood, 3)
  assert.equal(changesCSV[2].likelihood, 2)

  const snowJSON = JSON.stringify({
    result: [
      {
        sys_id: 'sys_12345',
        short_description: 'API Gateway Key Rotation',
        cmdb_ci: 'APIGateway',
        work_start: '2026-08-16T08:00:00Z',
        work_end: '2026-08-16T09:00:00Z',
        assigned_to: 'Carol',
        backout_plan: 'Revert to legacy key',
        test_plan: 'Validate auth endpoints'
      }
    ]
  })

  const changesJSON = parseServiceNowExport(snowJSON)
  assert.equal(changesJSON.length, 1)
  assert.equal(changesJSON[0].id, 'sys_12345')

  const singleObj = parseServiceNowExport({
    u_number: 'CHG-OBJ-1',
    u_title: 'Single Obj',
    u_service: 'Svc',
    planned_start_date: '2026-08-15T10:00:00Z',
    planned_end_date: '2026-08-15T11:00:00Z',
    u_owner: 'Owner1'
  })
  assert.equal(singleObj[0].id, 'CHG-OBJ-1')

  assert.throws(() => parseServiceNowExport(''), /No ServiceNow records found/)
})

test('parseJiraServiceManagementExport handles CSV, JSON, JS objects, and fallbacks', () => {
  const jiraCSV = `Key,Summary,Component/s,Custom field (Change start date),Custom field (Change completion date),Assignee,Issue Type,Impact,Custom field (Rollback plan),Custom field (Test plan)
JSM-101,Upgrade Auth Service,Auth,2026-08-17T02:00:00Z,2026-08-17T04:00:00Z,Dave,Standard,Highest,Rollback container release,Execute regression test suite
JSM-102,DNS Record Update,Networking,2026-08-17T05:00:00Z,2026-08-17T05:30:00Z,Eve,Emergency,Medium,Revert DNS record,Ping endpoints
JSM-103,Doc Update,Wiki,2026-08-17T06:00:00Z,2026-08-17T06:30:00Z,Frank,Standard,Low,,`

  const changesCSV = parseJiraServiceManagementExport(jiraCSV)
  assert.equal(changesCSV.length, 3)
  assert.equal(changesCSV[0].id, 'JSM-101')
  assert.equal(changesCSV[1].likelihood, 3)
  assert.equal(changesCSV[2].likelihood, 2)

  const jiraJSON = JSON.stringify({
    issues: [
      {
        Key: 'JSM-201',
        Summary: 'Storage SAN expansion',
        Components: 'SAN-Storage',
        'Start date': '2026-08-18T00:00:00Z',
        'End date': '2026-08-18T03:00:00Z',
        Reporter: 'Frank'
      }
    ]
  })

  const changesJSON = parseJiraServiceManagementExport(jiraJSON)
  assert.equal(changesJSON.length, 1)
  assert.equal(changesJSON[0].id, 'JSM-201')

  const singleJiraObj = parseJiraServiceManagementExport({
    key: 'JIRA-SINGLE',
    summary: 'Single Jira',
    component: 'Comp1',
    start: '2026-08-18T00:00:00Z',
    end: '2026-08-18T01:00:00Z'
  })
  assert.equal(singleJiraObj[0].id, 'JIRA-SINGLE')

  assert.throws(() => parseJiraServiceManagementExport(''), /No Jira Service Management records found/)
})

test('parsePlanText handles generic CSV and all format options', () => {
  const genericCSV = `id,title,service,start,end,owner,changeType,likelihood,impact,rollbackMinutes,dependencies,validation,rollback
CHG-GEN-1,Generic CSV,Svc1,2026-08-15T10:00:00Z,2026-08-15T11:00:00Z,Owner,standard,2,2,15,dep1,val1,roll1`

  const genericChanges = parsePlanText(genericCSV)
  assert.equal(genericChanges.length, 1)
  assert.equal(genericChanges[0].id, 'CHG-GEN-1')

  const snowCSV = `number,short_description,cmdb_ci,start_date,end_date
CHG-AUTO-1,Auto SNOW,WebFront,2026-08-15T10:00:00Z,2026-08-15T11:00:00Z`

  const changesAutoSNOW = parsePlanText(snowCSV)
  assert.equal(changesAutoSNOW[0].id, 'CHG-AUTO-1')

  const jiraCSV = `Key,Summary,Component/s,Start date,End date
JSM-AUTO-1,Auto JSM,Billing,2026-08-15T10:00:00Z,2026-08-15T11:00:00Z`

  const changesAutoJira = parsePlanText(jiraCSV)
  assert.equal(changesAutoJira[0].id, 'JSM-AUTO-1')

  const snowHint = parsePlanText(JSON.stringify([{ sys_id: 'sys_999', short_description: 'Hint SNOW' }]), 'servicenow')
  assert.equal(snowHint[0].id, 'sys_999')

  const jiraHint = parsePlanText(JSON.stringify([{ Key: 'JIRA-888', Summary: 'Hint Jira' }]), 'jira')
  assert.equal(jiraHint[0].id, 'JIRA-888')
})

test('validateRollbackWorkflow evaluates procedure, window feasibility, and backup verification', () => {
  const validChange = normalizeChange({
    id: 'CHG-VAL-1',
    start: '2026-08-20T10:00:00Z',
    end: '2026-08-20T12:00:00Z',
    rollbackMinutes: 30,
    rollback: 'Restore snapshot from backup server',
    validation: 'Verify HTTP 200 OK on /health'
  })

  const valRes = validateRollbackWorkflow(validChange, { backupVerified: true })
  assert.equal(valRes.status, 'APPROVED')
  assert.equal(valRes.score, 100)
  assert.ok(valRes.checks.every((c) => c.passed))

  const incompleteChange = normalizeChange({
    id: 'CHG-VAL-2',
    start: '2026-08-20T10:00:00Z',
    end: '2026-08-20T10:30:00Z',
    rollbackMinutes: 60,
    rollback: '',
    validation: ''
  })

  const incRes = validateRollbackWorkflow(incompleteChange)
  assert.equal(incRes.status, 'REJECTED')
  assert.ok(incRes.score < 50)
  assert.ok(incRes.recommendations.length > 0)
})

test('checkRecoveryWindowSLA validates lead time, window duration, and recovery buffer', () => {
  const compliantChange = normalizeChange({
    id: 'CHG-SLA-1',
    start: '2026-08-25T10:00:00Z',
    end: '2026-08-25T12:00:00Z',
    rollbackMinutes: 30
  })

  const slaRes = checkRecoveryWindowSLA(compliantChange, { referenceTime: '2026-08-20T10:00:00Z' })
  assert.equal(slaRes.inSLA, true)
  assert.equal(slaRes.slaStatus, 'COMPLIANT')
  assert.equal(slaRes.bufferMinutes, 90)

  const nonCompliantChange = normalizeChange({
    id: 'CHG-SLA-2',
    start: '2026-08-20T10:00:00Z',
    end: '2026-08-20T20:00:00Z',
    rollbackMinutes: 580
  })

  const slaFail = checkRecoveryWindowSLA(nonCompliantChange, { referenceTime: '2026-08-20T08:00:00Z' })
  assert.equal(slaFail.inSLA, false)
  assert.equal(slaFail.slaStatus, 'NON_COMPLIANT')
  assert.ok(slaFail.flags.length >= 2)

  const invalidDates = checkRecoveryWindowSLA(normalizeChange({ id: 'CHG-INV', start: 'invalid', end: 'invalid' }))
  assert.equal(invalidDates.inSLA, false)
  assert.equal(invalidDates.slaStatus, 'NON_COMPLIANT')
})

test('calculateSafetyScore and calculatePlanSafetyScore compute accurate safety grades and scores', () => {
  const safeChange = normalizeChange({
    id: 'CHG-SAFE-1',
    title: 'Low risk patch',
    service: 'Portal',
    start: '2026-08-25T10:00:00Z',
    end: '2026-08-25T11:00:00Z',
    owner: 'Sam',
    likelihood: 1,
    impact: 1,
    rollbackMinutes: 10,
    validation: 'Check status page',
    rollback: 'Restore snapshot from backup'
  })

  const safety = calculateSafetyScore(safeChange, [], { referenceTime: '2026-08-20T10:00:00Z' })
  assert.equal(safety.grade, 'A')
  assert.ok(safety.score >= 90)
  assert.equal(safety.riskLevel, 'LOW')

  const riskyChange = normalizeChange({
    id: 'CHG-RISK-1',
    title: 'Core Switch Firmware',
    service: 'Network',
    start: '2026-08-21T18:00:00Z',
    end: '2026-08-21T19:00:00Z',
    likelihood: 5,
    impact: 5,
    rollbackMinutes: 90,
    rollback: '',
    validation: ''
  })

  const issues = analyzePlan([riskyChange])
  const riskySafety = calculateSafetyScore(riskyChange, issues)
  assert.equal(riskySafety.grade, 'F')
  assert.equal(riskySafety.riskLevel, 'CRITICAL')

  const planScore = calculatePlanSafetyScore([safeChange, riskyChange], issues)
  assert.equal(planScore.criticalCount, 1)
  assert.equal(planScore.grade, 'F')

  const emptyPlan = calculatePlanSafetyScore([])
  assert.equal(emptyPlan.overallScore, 0)
  assert.equal(emptyPlan.grade, 'F')
})
