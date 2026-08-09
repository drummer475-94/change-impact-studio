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

export function parsePlanText(value) {
  const source = String(value || '').trim()
  if (!source) throw new Error('The selected plan is empty.')
  let parsed
  try { parsed = JSON.parse(source) } catch { throw new Error('Use a JSON array or an object with a changes array.') }
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
