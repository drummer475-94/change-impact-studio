import { analyzePlan, demoChanges, issueRank, normalizeChange, planSummary, readinessFor, riskBand, riskScore, runbookMarkdown } from './core.js'

const storageKey = 'change-impact-studio:readiness:v1'
const state = { changes: demoChanges.map(normalizeChange), issues: [], records: loadRecords(), selectedId: 'CHG-1042' }
const ids = ['importButton', 'fileInput', 'exportPlanButton', 'addChangeButton', 'loadStatus', 'changeMetric', 'collisionMetric', 'riskMetric', 'readyMetric', 'scheduleBoard', 'issueCount', 'issueList', 'detailEmpty', 'detailContent', 'detailId', 'detailTitle', 'detailService', 'detailRisk', 'detailRiskBand', 'detailWindow', 'detailOwner', 'detailDependencies', 'detailRollbackMinutes', 'detailValidation', 'detailRollback', 'readinessLabel', 'checklist', 'coordinatorNotes', 'saveReadinessButton', 'runbookButton', 'riskMatrix', 'changeDialog', 'changeForm', 'closeDialogButton']
const element = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]))

function loadRecords() { try { return JSON.parse(localStorage.getItem(storageKey)) || {} } catch { return {} } }
function saveRecords() { try { localStorage.setItem(storageKey, JSON.stringify(state.records)) } catch { /* Readiness remains usable in memory. */ } }

function analyze(status) {
  state.issues = analyzePlan(state.changes)
  if (!state.changes.some((change) => change.id === state.selectedId)) state.selectedId = state.changes[0]?.id || ''
  renderAll()
  if (status) element.loadStatus.textContent = status
}

function renderAll() {
  const summary = planSummary(state.changes, state.issues, state.records)
  element.changeMetric.textContent = summary.changes
  element.collisionMetric.textContent = summary.collisions
  element.riskMetric.textContent = summary.highRisk
  element.readyMetric.textContent = summary.ready
  renderSchedule(); renderIssues(); renderDetail(); renderRiskMatrix()
}

function weekDates() {
  const times = state.changes.map((change) => new Date(change.start).getTime()).filter(Number.isFinite)
  const first = new Date(Math.min(...times))
  const day = first.getDay()
  first.setDate(first.getDate() - ((day + 6) % 7))
  first.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, index) => new Date(first.getTime() + index * 86400000))
}

function renderSchedule() {
  if (!state.changes.length) { element.scheduleBoard.replaceChildren(); return }
  const days = weekDates()
  element.scheduleBoard.replaceChildren(...days.map((day) => {
    const column = document.createElement('section')
    column.className = 'day-column'
    const header = document.createElement('header')
    header.innerHTML = '<span></span><strong></strong>'
    header.querySelector('span').textContent = day.toLocaleDateString([], { weekday: 'short' })
    header.querySelector('strong').textContent = day.toLocaleDateString([], { month: 'short', day: 'numeric' })
    column.append(header)
    const dayChanges = state.changes.filter((change) => new Date(change.start).toDateString() === day.toDateString()).sort((a, b) => a.start.localeCompare(b.start))
    if (!dayChanges.length) { const empty = document.createElement('p'); empty.className = 'day-empty'; empty.textContent = 'No changes'; column.append(empty) }
    dayChanges.forEach((change) => {
      const button = document.createElement('button')
      const band = riskBand(riskScore(change))
      button.type = 'button'; button.className = `change-block ${band}${change.id === state.selectedId ? ' selected' : ''}`
      button.innerHTML = '<time></time><strong></strong><span></span>'
      const time = button.querySelector('time'); time.dateTime = change.start; time.textContent = new Date(change.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      button.querySelector('strong').textContent = change.title
      button.querySelector('span').textContent = change.id
      button.addEventListener('click', () => selectChange(change.id))
      column.append(button)
    })
    return column
  }))
}

function renderIssues() {
  element.issueCount.textContent = state.issues.length
  if (!state.issues.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No automated plan issues found.'; element.issueList.replaceChildren(empty); return }
  element.issueList.replaceChildren(...state.issues.map((issue) => {
    const button = document.createElement('button')
    button.type = 'button'; button.className = 'issue-card'
    button.innerHTML = '<span class="issue-severity"></span><strong></strong><p></p><small></small>'
    const severity = button.querySelector('.issue-severity'); severity.classList.add(issue.severity); severity.textContent = issue.severity
    button.querySelector('strong').textContent = issue.title
    button.querySelector('p').textContent = issue.summary
    button.querySelector('small').textContent = issue.changeIds.join(' + ')
    button.addEventListener('click', () => selectChange(issue.changeIds[0]))
    return button
  }))
}

function selectChange(id) { state.selectedId = id; renderSchedule(); renderDetail(); element.detailContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }

function renderDetail() {
  const change = state.changes.find((item) => item.id === state.selectedId)
  element.detailEmpty.hidden = Boolean(change)
  element.detailContent.hidden = !change
  if (!change) return
  const score = riskScore(change)
  const record = state.records[change.id] || { checklist: {}, notes: '' }
  const readiness = readinessFor(change, state.issues, record)
  element.detailId.textContent = `${change.id} / ${change.changeType}`
  element.detailTitle.textContent = change.title
  element.detailService.textContent = change.service
  element.detailRisk.textContent = score
  element.detailRiskBand.textContent = riskBand(score)
  element.detailWindow.textContent = `${new Date(change.start).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} – ${new Date(change.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  element.detailOwner.textContent = change.owner || 'Unassigned'
  element.detailDependencies.textContent = change.dependencies.join(', ') || 'None recorded'
  element.detailRollbackMinutes.textContent = `${change.rollbackMinutes} minutes`
  element.detailValidation.textContent = change.validation || 'Not documented'
  element.detailRollback.textContent = change.rollback || 'Not documented'
  element.readinessLabel.textContent = readiness.ready ? 'Ready for approval' : `${readiness.blockers} blocker${readiness.blockers === 1 ? '' : 's'} · ${readiness.complete}/4 preflight`
  element.readinessLabel.dataset.ready = String(readiness.ready)
  element.checklist.querySelectorAll('input').forEach((input) => { input.checked = Boolean(record.checklist?.[input.dataset.key]) })
  element.coordinatorNotes.value = record.notes || ''
}

function renderRiskMatrix() {
  const cells = []
  for (let likelihood = 5; likelihood >= 1; likelihood -= 1) {
    for (let impact = 1; impact <= 5; impact += 1) {
      const score = likelihood * impact
      const cell = document.createElement('div')
      cell.className = `risk-cell ${riskBand(score)}`
      const changes = state.changes.filter((change) => change.likelihood === likelihood && change.impact === impact)
      cell.setAttribute('aria-label', `Likelihood ${likelihood}, impact ${impact}: ${changes.length} changes`)
      const value = document.createElement('span'); value.textContent = score; cell.append(value)
      if (changes.length) {
        const count = document.createElement('strong'); count.textContent = changes.length; count.title = changes.map((change) => `${change.id}: ${change.title}`).join('\n'); cell.append(count)
      }
      cells.push(cell)
    }
  }
  element.riskMatrix.replaceChildren(...cells)
}

function saveReadiness() {
  const change = state.changes.find((item) => item.id === state.selectedId)
  if (!change) return
  const checklist = Object.fromEntries([...element.checklist.querySelectorAll('input')].map((input) => [input.dataset.key, input.checked]))
  state.records[change.id] = { checklist, notes: element.coordinatorNotes.value.trim(), updatedAt: new Date().toISOString() }
  saveRecords(); renderAll(); element.loadStatus.textContent = `${change.id} readiness saved in this browser.`
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url)
}

function downloadRunbook() {
  const change = state.changes.find((item) => item.id === state.selectedId)
  if (!change) return
  download(`${change.id.toLowerCase()}-runbook.md`, runbookMarkdown(change, state.issues, state.records[change.id]), 'text/markdown')
}

function exportPlan() {
  download('change-impact-plan.json', JSON.stringify({ exportedAt: new Date().toISOString(), changes: state.changes, issues: state.issues, readiness: state.records }, null, 2), 'application/json')
}

element.importButton.addEventListener('click', () => element.fileInput.click())
element.fileInput.addEventListener('change', async () => {
  const file = element.fileInput.files?.[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) { element.loadStatus.textContent = 'Choose a plan smaller than 2 MB.'; return }
  try {
    const parsed = JSON.parse(await file.text())
    const records = Array.isArray(parsed) ? parsed : parsed.changes
    if (!Array.isArray(records) || !records.length) throw new Error('No changes were found in this JSON plan.')
    state.changes = records.map(normalizeChange)
    state.records = {}
    saveRecords()
    state.selectedId = state.changes[0].id
    analyze(`${state.changes.length} changes loaded from ${file.name}.`)
  } catch (error) { element.loadStatus.textContent = error.message } finally { element.fileInput.value = '' }
})
element.exportPlanButton.addEventListener('click', exportPlan)
element.addChangeButton.addEventListener('click', () => { element.changeForm.reset(); element.changeForm.elements.start.value = '2026-08-13T10:00'; element.changeForm.elements.end.value = '2026-08-13T11:00'; element.changeDialog.showModal() })
element.closeDialogButton.addEventListener('click', () => element.changeDialog.close())
element.changeForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const input = Object.fromEntries(new FormData(element.changeForm))
  const highestId = Math.max(1041, ...state.changes.map((change) => Number(change.id.match(/^CHG-(\d+)$/)?.[1]) || 0))
  input.id = `CHG-${String(highestId + 1).padStart(4, '0')}`
  const change = normalizeChange(input, state.changes.length)
  state.changes.push(change); state.selectedId = change.id; element.changeDialog.close(); analyze(`${change.id} added to this browser session.`)
})
element.saveReadinessButton.addEventListener('click', saveReadiness)
element.runbookButton.addEventListener('click', downloadRunbook)

analyze('Sample change plan loaded.')
