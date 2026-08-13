export const issueRank = { blocker: 4, high: 3, medium: 2, low: 1 }

const maxImportedChanges = 500

function text(value, maximum) {
  return String(value || '').trim().slice(0, maximum)
}

function boundedNumber(value, minimum, maximum, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback
}

export const demoChanges = [
  {
    id: 'CHG-1042', title: 'Enforce phishing-resistant MFA', service: 'Identity platform',
    start: '2026-08-10T09:00:00-04:00', end: '2026-08-10T10:30:00-04:00', owner: 'Avery Chen',
    changeType: 'security', likelihood: 3, impact: 4, rollbackMinutes: 30,
    dependencies: ['directory', 'vpn'], validation: 'Confirm pilot and break-glass sign-ins; review failed-authentication rate.',
    rollback: 'Restore the prior conditional-access policy and revoke new sessions.',
  },
  {
    id: 'CHG-1043', title: 'Upgrade VPN gateway firmware', service: 'Remote access',
    start: '2026-08-10T09:30:00-04:00', end: '2026-08-10T11:00:00-04:00', owner: 'Morgan Webb',
    changeType: 'infrastructure', likelihood: 3, impact: 5, rollbackMinutes: 45,
    dependencies: ['vpn', 'identity platform'], validation: 'Connect through both gateways and verify route, DNS, and MFA flows.',
    rollback: 'Fail traffic to the standby gateway and restore the previous firmware image.',
  },
  {
    id: 'CHG-1044', title: 'Add reporting index', service: 'Data warehouse',
    start: '2026-08-11T14:00:00-04:00', end: '2026-08-11T15:00:00-04:00', owner: 'Priya Shah',
    changeType: 'database', likelihood: 2, impact: 3, rollbackMinutes: 15,
    dependencies: ['analytics'], validation: 'Compare query plans and p95 report latency against the pre-change baseline.',
    rollback: 'Drop the new index and confirm replication lag returns to baseline.',
  },
  {
    id: 'CHG-1045', title: 'Rotate integration signing key', service: 'Integration gateway',
    start: '2026-08-12T11:00:00-04:00', end: '2026-08-12T12:00:00-04:00', owner: 'Noah Reed',
    changeType: 'security', likelihood: 2, impact: 5, rollbackMinutes: 20,
    dependencies: ['partner api', 'secrets vault'], validation: 'Verify new-key transactions with two partner test tenants.',
    rollback: '',
  },
  {
    id: 'CHG-1046', title: 'Release payroll calculation update', service: 'Payroll',
    start: '2026-08-14T18:00:00-04:00', end: '2026-08-14T20:00:00-04:00', owner: 'Sam Ortega',
    changeType: 'application', likelihood: 4, impact: 4, rollbackMinutes: 150,
    dependencies: ['hr suite', 'data warehouse'], validation: 'Run the approved comparison payroll and reconcile totals before reopening the queue.',
    rollback: 'Restore the previous release and replay queued payroll jobs after data-owner approval.',
  },
  {
    id: 'CHG-1047', title: 'Retire legacy file transfer endpoint', service: 'Partner exchange',
    start: '2026-08-13T15:00:00-04:00', end: '2026-08-13T16:00:00-04:00', owner: '',
    changeType: 'retirement', likelihood: 2, impact: 4, rollbackMinutes: 20,
    dependencies: ['partner api'], validation: '', rollback: 'Restore the DNS record and re-enable the legacy listener.',
  },
]

function list(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(/[,;|]/)
  return items.map((item) => text(item, 80)).filter(Boolean).slice(0, 30)
}

export function normalizeChange(change, index = 0) {
  const input = change && typeof change === 'object' ? change : {}
  return {
    id: text(input.id || `CHG-${String(index + 1).padStart(4, '0')}`, 80),
    title: text(input.title || 'Untitled change', 100),
    service: text(input.service || 'Unassigned service', 80),
    start: text(input.start, 40),
    end: text(input.end, 40),
    owner: text(input.owner, 80),
    changeType: text(input.changeType || input.type || 'standard', 40).toLowerCase(),
    likelihood: boundedNumber(input.likelihood, 1, 5, 1),
    impact: boundedNumber(input.impact, 1, 5, 1),
    rollbackMinutes: boundedNumber(input.rollbackMinutes, 0, 10080, 0),
    dependencies: list(input.dependencies),
    validation: text(input.validation, 2000),
    rollback: text(input.rollback, 2000),
  }
}

function uniqueChangeIds(changes) {
  const used = new Set()
  return changes.map((change) => {
    let id = change.id
    let suffix = 2
    while (used.has(id)) { id = `${change.id}-${suffix}`; suffix += 1 }
    used.add(id)
    return id === change.id ? change : { ...change, id }
  })
}

export function parseCSV(csvText) {
  if (typeof csvText !== 'string') return []
  const text = csvText.trim()
  if (!text) return []

  const lines = []
  let currentLine = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        currentLine.push(currentField.trim())
        currentField = ''
      } else if (char === '\r') {
        // ignore CR
      } else if (char === '\n') {
        currentLine.push(currentField.trim())
        lines.push(currentLine)
        currentLine = []
        currentField = ''
      } else {
        currentField += char
      }
    }
  }
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim())
    lines.push(currentLine)
  }

  if (lines.length === 0) return []
  const headers = lines[0].map(h => h.replace(/^"|"$/g, '').trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].length === 1 && lines[i][0] === '') continue
    const row = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = lines[i][j] || ''
    }
    rows.push(row)
  }
  return rows
}

export function parseServiceNowExport(input) {
  let records = []
  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed)
      records = Array.isArray(parsed) ? parsed : (parsed.result || parsed.changes || [parsed])
    } else {
      records = parseCSV(trimmed)
    }
  } else if (Array.isArray(input)) {
    records = input
  } else if (input && typeof input === 'object') {
    records = input.result || input.changes || [input]
  }

  if (!records.length) throw new Error('No ServiceNow records found.')
  if (records.length > maxImportedChanges) throw new Error(`Plans are limited to ${maxImportedChanges} changes.`)

  const mapped = records.map((rec, index) => {
    const id = rec.number || rec.sys_id || rec.u_number || rec.id || `CHG-SNOW-${index + 1}`
    const title = rec.short_description || rec.description || rec.u_title || rec.title || 'ServiceNow Change Request'
    const service = rec.cmdb_ci || rec.service_offering || rec.u_service || rec.service || 'CMDB Service'
    const start = rec.start_date || rec.work_start || rec.planned_start_date || rec.start || ''
    const end = rec.end_date || rec.work_end || rec.planned_end_date || rec.end || ''
    const owner = rec.assigned_to || rec['assigned_to.display_value'] || rec.u_owner || rec.owner || ''
    const changeType = rec.type || rec.category || rec.u_change_type || rec.changeType || 'standard'

    let likelihood = rec.likelihood
    let impact = rec.impact
    if (!likelihood || !impact) {
      const riskVal = String(rec.risk || rec.priority || '').toLowerCase()
      if (riskVal.includes('1') || riskVal.includes('critical') || riskVal.includes('high')) {
        likelihood = likelihood || 4; impact = impact || 4
      } else if (riskVal.includes('2') || riskVal.includes('moderate')) {
        likelihood = likelihood || 3; impact = impact || 3
      } else {
        likelihood = likelihood || 2; impact = impact || 2
      }
    }

    const rollbackMinutes = rec.rollbackMinutes || rec.u_rollback_duration || (rec.backout_plan ? 30 : 0)
    const dependencies = rec.cmdb_ci_services || rec.u_dependencies || rec.dependencies || ''
    const validation = rec.test_plan || rec.u_test_plan || rec.validation || ''
    const rollback = rec.backout_plan || rec.u_backout_plan || rec.rollback || ''

    return normalizeChange({
      id, title, service, start, end, owner, changeType, likelihood, impact, rollbackMinutes, dependencies, validation, rollback
    }, index)
  })

  return uniqueChangeIds(mapped)
}

export function parseJiraServiceManagementExport(input) {
  let records = []
  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed)
      records = Array.isArray(parsed) ? parsed : (parsed.issues || parsed.changes || [parsed])
    } else {
      records = parseCSV(trimmed)
    }
  } else if (Array.isArray(input)) {
    records = input
  } else if (input && typeof input === 'object') {
    records = input.issues || input.changes || [input]
  }

  if (!records.length) throw new Error('No Jira Service Management records found.')
  if (records.length > maxImportedChanges) throw new Error(`Plans are limited to ${maxImportedChanges} changes.`)

  const mapped = records.map((rec, index) => {
    const id = rec.Key || rec['Issue key'] || rec['Issue Key'] || rec.key || rec.id || `JIRA-${index + 1}`
    const title = rec.Summary || rec.summary || rec.title || 'Jira Change Request'
    const service = rec['Component/s'] || rec.Components || rec.Component || rec.components || rec.service || 'Jira Component'
    const start = rec['Custom field (Change start date)'] || rec['Change start date'] || rec['Start date'] || rec.start || ''
    const end = rec['Custom field (Change completion date)'] || rec['Change completion date'] || rec['End date'] || rec.end || ''
    const owner = rec.Assignee || rec.Reporter || rec.assignee || rec.owner || ''
    const changeType = rec['Issue Type'] || rec['Change type'] || rec.type || rec.changeType || 'standard'

    let likelihood = rec.likelihood
    let impact = rec.impact
    if (!likelihood || !impact) {
      const prio = String(rec.Impact || rec.Priority || rec['Risk rating'] || '').toLowerCase()
      if (prio.includes('highest') || prio.includes('critical') || prio.includes('high')) {
        likelihood = likelihood || 4; impact = impact || 4
      } else if (prio.includes('medium') || prio.includes('moderate')) {
        likelihood = likelihood || 3; impact = impact || 3
      } else {
        likelihood = likelihood || 2; impact = impact || 2
      }
    }

    const rollbackMinutes = rec.rollbackMinutes || (rec['Custom field (Rollback plan)'] || rec['Rollback plan'] ? 30 : 0)
    const dependencies = rec['Outward issue link (Depends on)'] || rec['Linked Issues'] || rec.dependencies || ''
    const validation = rec['Custom field (Test plan)'] || rec['Test plan'] || rec.validation || ''
    const rollback = rec['Custom field (Rollback plan)'] || rec['Rollback plan'] || rec.rollback || ''

    return normalizeChange({
      id, title, service, start, end, owner, changeType, likelihood, impact, rollbackMinutes, dependencies, validation, rollback
    }, index)
  })

  return uniqueChangeIds(mapped)
}

export function parsePlanText(value, formatHint) {
  const source = String(value || '').trim()
  if (!source) throw new Error('The selected plan is empty.')

  if (formatHint === 'servicenow') return parseServiceNowExport(source)
  if (formatHint === 'jira') return parseJiraServiceManagementExport(source)

  let parsed
  try {
    parsed = JSON.parse(source)
  } catch {
    if (source.includes(',') || source.includes('\n')) {
      const csvRows = parseCSV(source)
      if (csvRows.length) {
        const firstRowKeys = Object.keys(csvRows[0]).join(' ').toLowerCase()
        if (firstRowKeys.includes('number') || firstRowKeys.includes('cmdb_ci') || firstRowKeys.includes('backout_plan') || firstRowKeys.includes('sys_id')) {
          return parseServiceNowExport(source)
        }
        if (firstRowKeys.includes('key') || firstRowKeys.includes('issue key') || firstRowKeys.includes('component') || firstRowKeys.includes('rollback plan')) {
          return parseJiraServiceManagementExport(source)
        }
        const genericMapped = csvRows.map((r, i) => normalizeChange({
          id: r.id || r.ID || r.change_id,
          title: r.title || r.Title || r.summary,
          service: r.service || r.Service || r.component,
          start: r.start || r.Start || r.start_date,
          end: r.end || r.End || r.end_date,
          owner: r.owner || r.Owner || r.assignee,
          changeType: r.changeType || r.type || r.Type,
          likelihood: r.likelihood || r.Likelihood,
          impact: r.impact || r.Impact,
          rollbackMinutes: r.rollbackMinutes || r.rollback_minutes,
          dependencies: r.dependencies || r.Dependencies,
          validation: r.validation || r.Validation,
          rollback: r.rollback || r.Rollback
        }, i))
        return uniqueChangeIds(genericMapped)
      }
    }
    throw new Error('Use a JSON array or an object with a changes array.')
  }

  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.result) || parsed.sys_id || parsed.number) {
      return parseServiceNowExport(parsed)
    }
    if (Array.isArray(parsed.issues) || parsed.Key || parsed['Issue key']) {
      return parseJiraServiceManagementExport(parsed)
    }
  }

  const records = Array.isArray(parsed) ? parsed : parsed?.changes
  if (!Array.isArray(records) || !records.length) throw new Error('No changes were found in this JSON plan.')
  if (records.length > maxImportedChanges) throw new Error(`Plans are limited to ${maxImportedChanges} changes.`)
  if (records.some((record) => !record || typeof record !== 'object' || Array.isArray(record))) {
    throw new Error('Every change must be a JSON object.')
  }
  return uniqueChangeIds(records.map(normalizeChange))
}

export function riskScore(change) { return Number(change.likelihood) * Number(change.impact) }
export function riskBand(score) { return score >= 16 ? 'critical' : score >= 10 ? 'high' : score >= 5 ? 'medium' : 'low' }

export function changesOverlap(first, second) {
  const firstStart = new Date(first.start).getTime()
  const firstEnd = new Date(first.end).getTime()
  const secondStart = new Date(second.start).getTime()
  const secondEnd = new Date(second.end).getTime()
  if (![firstStart, firstEnd, secondStart, secondEnd].every(Number.isFinite)) return false
  return firstStart < secondEnd && secondStart < firstEnd
}

export function sharedComponents(first, second) {
  const firstComponents = new Set([first.service, ...first.dependencies].map((item) => item.toLowerCase()))
  return [second.service, ...second.dependencies].filter((item) => firstComponents.has(item.toLowerCase()))
}

function issue(type, severity, title, changeIds, summary, action) {
  return { id: `${type}:${changeIds.join('|')}`, type, severity, title, changeIds, summary, action }
}

export function analyzePlan(changes) {
  const issues = []
  for (const change of changes) {
    const start = new Date(change.start)
    const end = new Date(change.end)
    const duration = (end.getTime() - start.getTime()) / 60000
    const score = riskScore(change)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || duration <= 0) {
      issues.push(issue('invalid-window', 'blocker', 'Invalid change window', [change.id], `${change.id} does not have a usable start and end time.`, 'Correct the schedule before review.'))
      continue
    }
    if (score >= 12) issues.push(issue('high-risk', score >= 16 ? 'blocker' : 'high', 'High inherent change risk', [change.id], `${change.id} scores ${score}/25 from likelihood ${change.likelihood} × impact ${change.impact}.`, 'Add independent approval, explicit stop conditions, and live monitoring coverage.'))
    if (!change.owner) issues.push(issue('missing-owner', 'blocker', 'No accountable change owner', [change.id], `${change.id} has no named owner for execution and recovery.`, 'Assign an owner before the implementation window.'))
    if (!change.rollback) issues.push(issue('missing-rollback', 'blocker', 'Rollback procedure is missing', [change.id], `${change.id} cannot demonstrate a recovery path.`, 'Document a tested rollback or an explicit forward-fix decision with approval.'))
    if (!change.validation) issues.push(issue('missing-validation', 'high', 'Validation plan is missing', [change.id], `${change.id} has no objective success check.`, 'Add measurable validation steps and a decision deadline.'))
    if (change.rollbackMinutes > duration) issues.push(issue('rollback-overrun', 'high', 'Rollback exceeds the booked window', [change.id], `${change.id} reserves ${duration} minutes but estimates ${change.rollbackMinutes} minutes for rollback.`, 'Extend the window or set an earlier go/no-go checkpoint.'))
    if (start.getDay() === 0 || start.getDay() === 6 || (start.getDay() === 5 && start.getHours() >= 17)) {
      issues.push(issue('blackout-window', 'medium', 'Change enters a protected period', [change.id], `${change.id} begins during the default Friday-evening or weekend protection window.`, 'Confirm an approved exception and on-call coverage, or reschedule.'))
    }
  }

  for (let firstIndex = 0; firstIndex < changes.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < changes.length; secondIndex += 1) {
      const first = changes[firstIndex]
      const second = changes[secondIndex]
      const shared = sharedComponents(first, second)
      if (changesOverlap(first, second) && shared.length) {
        issues.push(issue('dependency-collision', 'blocker', 'Overlapping dependency change', [first.id, second.id], `${first.id} and ${second.id} overlap while sharing ${[...new Set(shared)].join(', ')}.`, 'Separate the windows or document a coordinated implementation and recovery sequence.'))
      }
    }
  }
  return issues.sort((a, b) => issueRank[b.severity] - issueRank[a.severity] || a.title.localeCompare(b.title))
}

export function validateRollbackWorkflow(change, options = {}) {
  const norm = normalizeChange(change)
  const checks = []
  const recommendations = []
  let score = 100

  const hasRollback = Boolean(norm.rollback && norm.rollback.length > 5)
  if (hasRollback) {
    checks.push({ name: 'rollback_procedure_documented', passed: true, detail: 'Rollback procedure is clearly documented.' })
  } else {
    score -= 35
    checks.push({ name: 'rollback_procedure_documented', passed: false, detail: 'No rollback procedure documented.' })
    recommendations.push('Document concrete backout steps or gain forward-fix exemption sign-off.')
  }

  const start = new Date(norm.start).getTime()
  const end = new Date(norm.end).getTime()
  const windowDuration = (Number.isFinite(start) && Number.isFinite(end) && end > start) ? (end - start) / 60000 : 0

  if (windowDuration > 0) {
    if (norm.rollbackMinutes > windowDuration) {
      score -= 30
      checks.push({ name: 'rollback_window_feasibility', passed: false, detail: `Rollback estimate (${norm.rollbackMinutes}m) exceeds booked window (${windowDuration}m).` })
      recommendations.push('Extend implementation window or create mid-window go/no-go checkpoint.')
    } else {
      checks.push({ name: 'rollback_window_feasibility', passed: true, detail: `Rollback estimate fits within booked window (${norm.rollbackMinutes}m / ${windowDuration}m).` })
    }
  } else {
    score -= 20
    checks.push({ name: 'rollback_window_feasibility', passed: false, detail: 'Invalid change window dates.' })
  }

  const backupVerified = Boolean(options.backupVerified || (norm.rollback && /backup|restore|snapshot|checkpoint/i.test(norm.rollback)))
  if (backupVerified) {
    checks.push({ name: 'backup_verification', passed: true, detail: 'Preflight backup/restore point verified.' })
  } else {
    score -= 15
    checks.push({ name: 'backup_verification', passed: false, detail: 'Backup or restore point not explicitly verified.' })
    recommendations.push('Confirm data snapshot/backup before executing high-impact steps.')
  }

  const hasValidation = Boolean(norm.validation && norm.validation.length > 5)
  if (hasValidation) {
    checks.push({ name: 'validation_plan_present', passed: true, detail: 'Post-change validation procedure documented.' })
  } else {
    score -= 20
    checks.push({ name: 'validation_plan_present', passed: false, detail: 'Validation plan missing.' })
    recommendations.push('Define concrete health checks and latency benchmarks for post-change validation.')
  }

  score = Math.max(0, Math.min(100, score))
  const status = score >= 80 ? 'APPROVED' : score >= 50 ? 'WARNING' : 'REJECTED'

  return {
    status,
    score,
    checks,
    recommendations
  }
}

export function checkRecoveryWindowSLA(change, slaOptions = {}) {
  const norm = normalizeChange(change)
  const minLeadTimeHours = slaOptions.minLeadTimeHours ?? 24
  const maxWindowHours = slaOptions.maxWindowHours ?? 8
  const minBufferMinutes = slaOptions.minBufferMinutes ?? 15

  const start = new Date(norm.start)
  const end = new Date(norm.end)
  const startTime = start.getTime()
  const endTime = end.getTime()

  const flags = []
  let slaStatus = 'COMPLIANT'

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return {
      inSLA: false,
      slaStatus: 'NON_COMPLIANT',
      bufferMinutes: 0,
      leadTimeHours: 0,
      windowDurationMinutes: 0,
      flags: ['Invalid schedule dates']
    }
  }

  const windowDurationMinutes = (endTime - startTime) / 60000
  const bufferMinutes = windowDurationMinutes - norm.rollbackMinutes

  const now = slaOptions.referenceTime ? new Date(slaOptions.referenceTime).getTime() : Date.now()
  const leadTimeHours = (startTime - now) / 3600000
  if (leadTimeHours < minLeadTimeHours && norm.changeType !== 'emergency') {
    flags.push(`Lead time (${leadTimeHours.toFixed(1)}h) is less than SLA minimum (${minLeadTimeHours}h)`)
    slaStatus = 'WARNING'
  }

  if (windowDurationMinutes > maxWindowHours * 60) {
    flags.push(`Window duration (${(windowDurationMinutes / 60).toFixed(1)}h) exceeds max SLA limit (${maxWindowHours}h)`)
    slaStatus = 'NON_COMPLIANT'
  }

  if (bufferMinutes < minBufferMinutes) {
    flags.push(`Recovery buffer (${bufferMinutes}m) is below minimum SLA buffer (${minBufferMinutes}m)`)
    if (slaStatus !== 'NON_COMPLIANT') slaStatus = 'WARNING'
  }

  const startDay = start.getDay()
  const startHour = start.getHours()
  const isWeekend = startDay === 0 || startDay === 6
  const isFridayEvening = startDay === 5 && startHour >= 17
  if (isWeekend || isFridayEvening) {
    flags.push('Change scheduled inside protected weekend/Friday blackout window')
    if (slaStatus !== 'NON_COMPLIANT') slaStatus = 'WARNING'
  }

  const inSLA = slaStatus === 'COMPLIANT'

  return {
    inSLA,
    slaStatus,
    bufferMinutes,
    leadTimeHours,
    windowDurationMinutes,
    flags
  }
}

export function calculateSafetyScore(change, issues = [], options = {}) {
  const norm = normalizeChange(change)
  const rScore = riskScore(norm)
  const rollbackVal = validateRollbackWorkflow(norm, options)
  const slaCheck = checkRecoveryWindowSLA(norm, options)

  let score = 100

  const riskPenalty = ((rScore - 1) / 24) * 30
  score -= riskPenalty

  const rollbackPenalty = (100 - rollbackVal.score) * 0.35
  score -= rollbackPenalty

  if (slaCheck.slaStatus === 'NON_COMPLIANT') {
    score -= 25
  } else if (slaCheck.slaStatus === 'WARNING') {
    score -= 10
  }

  const relevantIssues = issues.filter(i => i.changeIds && i.changeIds.includes(norm.id))
  for (const issue of relevantIssues) {
    if (issue.severity === 'blocker') score -= 20
    else if (issue.severity === 'high') score -= 10
    else if (issue.severity === 'medium') score -= 5
  }

  score = Math.round(Math.max(0, Math.min(100, score)))

  let grade = 'F'
  if (score >= 90) grade = 'A'
  else if (score >= 75) grade = 'B'
  else if (score >= 60) grade = 'C'
  else if (score >= 45) grade = 'D'

  let riskLevel = 'LOW'
  if (score < 45 || rScore >= 16) riskLevel = 'CRITICAL'
  else if (score < 65 || rScore >= 10) riskLevel = 'HIGH'
  else if (score < 85 || rScore >= 5) riskLevel = 'MEDIUM'

  return {
    score,
    grade,
    riskLevel,
    factors: {
      inherentRiskScore: rScore,
      riskPenalty: Number(riskPenalty.toFixed(1)),
      rollbackScore: rollbackVal.score,
      slaStatus: slaCheck.slaStatus,
      issueCount: relevantIssues.length
    },
    rollbackValidation: rollbackVal,
    slaCheck
  }
}

export function calculatePlanSafetyScore(changes, issues = [], options = {}) {
  if (!changes || !changes.length) {
    return { overallScore: 0, grade: 'F', changeScores: [], averageScore: 0, criticalCount: 0 }
  }

  const changeScores = changes.map(c => calculateSafetyScore(c, issues, options))
  const avgScore = Math.round(changeScores.reduce((sum, item) => sum + item.score, 0) / changeScores.length)
  const minScore = Math.min(...changeScores.map(s => s.score))
  const criticalCount = changeScores.filter(s => s.riskLevel === 'CRITICAL' || s.grade === 'F').length

  let overallScore = avgScore
  if (criticalCount > 0) {
    overallScore = Math.min(overallScore, minScore)
  }

  let grade = 'F'
  if (overallScore >= 90) grade = 'A'
  else if (overallScore >= 75) grade = 'B'
  else if (overallScore >= 60) grade = 'C'
  else if (overallScore >= 45) grade = 'D'

  return {
    overallScore,
    grade,
    averageScore: avgScore,
    minScore,
    criticalCount,
    changeScores
  }
}

export function readinessFor(change, issues, record = {}) {
  const blockers = issues.filter((item) => item.changeIds.includes(change.id) && item.severity === 'blocker').length
  const checklist = record.checklist || {}
  const complete = ['approval', 'backup', 'communications', 'monitoring'].filter((key) => checklist[key]).length
  return { blockers, complete, total: 4, ready: blockers === 0 && complete === 4 }
}

export function planSummary(changes, issues, records = {}) {
  const collisions = issues.filter((item) => item.type === 'dependency-collision').length
  return {
    changes: changes.length,
    collisions,
    highRisk: changes.filter((change) => riskScore(change) >= 12).length,
    ready: changes.filter((change) => readinessFor(change, issues, records[change.id]).ready).length,
  }
}

export function runbookMarkdown(change, issues, record = {}) {
  const related = issues.filter((item) => item.changeIds.includes(change.id))
  const checklist = record.checklist || {}
  const line = (key, label) => `- [${checklist[key] ? 'x' : ' '}] ${label}`
  return `# ${change.id}: ${change.title}\n\n` +
    `## Window and ownership\n\n- Service: ${change.service}\n- Owner: ${change.owner || 'UNASSIGNED'}\n- Start: ${change.start}\n- End: ${change.end}\n- Risk: ${riskScore(change)}/25 (${riskBand(riskScore(change))})\n- Dependencies: ${change.dependencies.join(', ') || 'None recorded'}\n\n` +
    `## Validation\n\n${change.validation || 'NOT DOCUMENTED'}\n\n## Rollback\n\n${change.rollback || 'NOT DOCUMENTED'}\n\nEstimated rollback time: ${change.rollbackMinutes} minutes\n\n` +
    `## Preflight\n\n${line('approval', 'Approval recorded')}\n${line('backup', 'Backup or restore point verified')}\n${line('communications', 'Stakeholder communications prepared')}\n${line('monitoring', 'Monitoring and stop conditions assigned')}\n\n` +
    `## Open analysis issues\n\n${related.length ? related.map((item) => `- **${item.severity.toUpperCase()} — ${item.title}:** ${item.summary} ${item.action}`).join('\n') : '- No automated issues found.'}\n\n` +
    `## Coordinator notes\n\n${record.notes || 'No notes recorded.'}\n`
}
