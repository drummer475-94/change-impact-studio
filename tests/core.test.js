import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzePlan, changesOverlap, demoChanges, normalizeChange, parsePlanText, planSummary, readinessFor, riskBand, riskScore, runbookMarkdown, sharedComponents } from '../core.js'

test('normalizes dependency lists and bounds risk inputs', () => {
  const change = normalizeChange({ title: 'Test', dependencies: 'vpn, identity | dns', likelihood: 9, impact: 0, rollbackMinutes: '1e309' })
  assert.deepEqual(change.dependencies, ['vpn', 'identity', 'dns'])
  assert.equal(change.likelihood, 5)
  assert.equal(change.impact, 1)
  assert.equal(change.rollbackMinutes, 0)
})

test('calculates risk scores and named bands', () => {
  assert.equal(riskScore({ likelihood: 4, impact: 4 }), 16)
  assert.equal(riskBand(16), 'critical')
  assert.equal(riskBand(8), 'medium')
})

test('imports bounded JSON plans with stable unique identifiers', () => {
  const changes = parsePlanText(JSON.stringify({ changes: [
    { id: 'CHG-7', title: 'First' },
    { id: 'CHG-7', title: 'Second' },
  ] }))
  assert.deepEqual(changes.map((change) => change.id), ['CHG-7', 'CHG-7-2'])
  assert.throws(() => parsePlanText('{bad json'), /JSON array/)
  assert.throws(() => parsePlanText(JSON.stringify(Array.from({ length: 501 }, () => ({})))), /500 changes/)
})

test('detects overlap only when windows intersect', () => {
  const [first, second, third] = demoChanges.map(normalizeChange)
  assert.equal(changesOverlap(first, second), true)
  assert.equal(changesOverlap(first, third), false)
  assert.ok(sharedComponents(first, second).includes('vpn'))
})

test('finds dependency collisions and readiness blockers', () => {
  const changes = demoChanges.map(normalizeChange)
  const issues = analyzePlan(changes)
  assert.ok(issues.some((item) => item.type === 'dependency-collision'))
  assert.ok(issues.some((item) => item.type === 'missing-rollback'))
  assert.ok(issues.some((item) => item.type === 'blackout-window'))
  assert.equal(readinessFor(changes[0], issues, { checklist: { approval: true, backup: true, communications: true, monitoring: true } }).ready, false)
})

test('marks a clean change ready after all preflight checks', () => {
  const clean = normalizeChange({ id: 'CHG-1', title: 'Safe update', service: 'Docs', start: '2026-08-11T10:00:00Z', end: '2026-08-11T11:00:00Z', owner: 'Alex', likelihood: 1, impact: 2, rollbackMinutes: 10, dependencies: [], validation: 'Open the page', rollback: 'Restore prior file' })
  const issues = analyzePlan([clean])
  const record = { checklist: { approval: true, backup: true, communications: true, monitoring: true } }
  assert.equal(readinessFor(clean, issues, record).ready, true)
  assert.equal(planSummary([clean], issues, { 'CHG-1': record }).ready, 1)
})

test('exports a runbook with analysis and checklist state', () => {
  const change = normalizeChange(demoChanges[0])
  const markdown = runbookMarkdown(change, analyzePlan(demoChanges.map(normalizeChange)), { checklist: { approval: true }, notes: 'Notify support.' })
  assert.match(markdown, /# CHG-1042/)
  assert.match(markdown, /\[x\] Approval recorded/)
  assert.match(markdown, /Notify support/)
})
