import { SUBJECTS, dateKey, validDate, shiftDate, weekDates, conflicts, createPlan, validTask } from './planner.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const STORAGE_KEY = 'pulse-neet-planner-v1';
const today = () => dateKey();
const emptyState = () => ({ version: 1, tasks: [], settings: { goal: 6, exam: '' }, sessions: [] });
let state = emptyState();
let selectedDate = today();
let filter = 'all';
let view = 'dashboard';
let showAllSubjects = false;
let deletingId;
let toastTimeout;

function isValidState(data) {
  return data?.version === 1 && Array.isArray(data.tasks) && data.tasks.every(validTask)
    && new Set(data.tasks.map(task => task.id)).size === data.tasks.length
    && Number.isInteger(data.settings?.goal) && data.settings.goal >= 1 && data.settings.goal <= 16
    && typeof data.settings.exam === 'string'
    && (data.settings.exam === '' || validDate(data.settings.exam))
    && Array.isArray(data.sessions) && data.sessions.every(session => typeof session.date === 'string'
      && validDate(session.date) && Number.isInteger(session.minutes) && session.minutes > 0);
}

function warn(message) {
  $('#storage-warning').textContent = message;
  $('#storage-warning').hidden = false;
  $('#save-status').textContent = 'Changes are not saved';
}

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (!isValidState(parsed)) throw new Error('Invalid planner data');
    state = parsed;
  }
} catch (error) {
  console.error('Unable to load planner:', error);
  warn('Your saved plan could not be loaded. It has not been overwritten. Restore a backup in Planner settings, or download your current plan before leaving.');
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $('#storage-warning').hidden = true;
    $('#save-status').innerHTML = '<i></i> Saved on this device';
    return true;
  } catch (error) {
    console.error('Unable to save planner:', error);
    warn('Your browser could not save these changes. Download a backup from Planner settings before leaving this page.');
    return false;
  }
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function toast(message) {
  clearTimeout(toastTimeout);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 4000);
}

const formatDate = (key, options) => new Date(`${key}T12:00:00`).toLocaleDateString('en-IN', options);
const hoursText = value => Number((value / 60).toFixed(1));
const tasksForDay = () => state.tasks.filter(task => task.date === selectedDate);

function renderStats() {
  const tasks = tasksForDay();
  const done = tasks.filter(task => task.done);
  const completedMinutes = done.reduce((sum, task) => sum + task.duration, 0);
  const week = weekDates(selectedDate);
  const activeDays = new Set(state.tasks.filter(task => task.done && week.includes(task.date)).map(task => task.date));
  const subjects = new Set(done.map(task => task.subject));
  const items = [
    ['Tasks completed', `${done.length}<small>/ ${tasks.length}</small>`, tasks.length ? `${Math.round(done.length / tasks.length * 100)}% of your daily plan` : 'A fresh page, a fresh start', '✓'],
    ['Study hours', `${hoursText(completedMinutes)}<small>/ ${state.settings.goal} hrs</small>`, 'From completed study tasks', '◷'],
    ['Subjects studied', `${subjects.size}<small>/ 19</small>`, 'A little more ground covered', '▥'],
    ['Active days', `${activeDays.size}<small>/ 7 days</small>`, 'This week, at your own pace', '↗'],
  ];
  $('#stats').innerHTML = items.map(([label, value, detail, icon]) => `<article class="stat"><span class="stat-icon" aria-hidden="true">${icon}</span><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-detail">${detail}</div></article>`).join('');
}

function renderWeek() {
  const dates = weekDates(selectedDate);
  $('#week-label').textContent = `${formatDate(dates[0], { day: 'numeric', month: 'short' })} - ${formatDate(dates[6], { day: 'numeric', month: 'short', year: 'numeric' })}`;
  $('#week-strip').innerHTML = dates.map(date => `<button class="day${date === selectedDate ? ' selected' : ''}${date === today() ? ' today' : ''}${state.tasks.some(task => task.date === date) ? ' has-tasks' : ''}" data-date="${date}" aria-pressed="${date === selectedDate}" aria-label="${formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}${date === today() ? ', today' : ''}"><span>${formatDate(date, { weekday: 'short' }).toUpperCase()}</span><strong>${Number(date.slice(-2))}</strong><i></i></button>`).join('');
}

function renderTasks() {
  const tasks = tasksForDay();
  const visible = tasks.filter(task => filter === 'all' || (filter === 'completed' ? task.done : !task.done)).sort((a, b) => a.time.localeCompare(b.time));
  $('#task-count').textContent = `${tasks.length} task${tasks.length === 1 ? '' : 's'}`;
  $('#planned-hours').textContent = `${hoursText(tasks.reduce((sum, task) => sum + task.duration, 0))} hrs planned`;
  if (!visible.length) {
    $('#task-list').innerHTML = `<div class="empty-state"><span class="empty-symbol" aria-hidden="true">▤</span><strong>${filter === 'completed' ? 'Your wins will live here.' : filter === 'pending' && tasks.length ? 'A day well done.' : 'Make space for your next small win.'}</strong><p>${filter === 'completed' ? 'Check off a task when you finish to see your progress.' : filter === 'pending' && tasks.length ? 'Every task is complete. Take a well-earned break.' : 'Add your first study task, or let us build a balanced plan for your day.'}</p>${filter === 'all' ? '<button class="text-button" id="empty-build">Build a study plan ↗</button>' : ''}</div>`;
    return;
  }
  $('#task-list').innerHTML = visible.map(task => `<article class="task${task.done ? ' done' : ''}"><input type="checkbox" class="task-check" data-toggle="${escapeHtml(task.id)}" ${task.done ? 'checked' : ''} aria-label="Mark ${escapeHtml(task.title)} ${task.done ? 'incomplete' : 'complete'}"><div class="task-info"><div class="task-title">${escapeHtml(task.title)}</div><div class="task-meta"><span class="subject-tag">${escapeHtml(task.subject)}</span><span>${task.time} · ${task.duration} min</span><span>${escapeHtml(task.type)}</span></div></div><span class="priority ${task.priority.toLowerCase()}">${task.priority}</span><div class="task-actions"><button data-edit="${escapeHtml(task.id)}" aria-label="Edit ${escapeHtml(task.title)}" title="Edit task">✎</button><button data-delete="${escapeHtml(task.id)}" aria-label="Delete ${escapeHtml(task.title)}" title="Delete task">×</button></div></article>`).join('');
}

function renderSubjects() {
  const subjects = showAllSubjects || view === 'subjects' ? SUBJECTS : [...SUBJECTS].sort((a, b) => {
    const score = subject => state.tasks.filter(task => task.subject === subject).length;
    return score(b) - score(a);
  }).slice(0, 4);
  $('#all-subjects').textContent = showAllSubjects ? 'Show less ↑' : 'All 19 subjects ↗';
  $('#all-subjects').hidden = view === 'subjects';
  $('#subject-list').innerHTML = subjects.map(subject => {
    const tasks = state.tasks.filter(task => task.subject === subject);
    const done = tasks.filter(task => task.done).length;
    const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    return `<div class="subject-list-row"><span class="subject-initial">${subject.slice(0, 2).toUpperCase()}</span><div class="subject-progress"><div class="subject-row-heading"><span>${subject}</span><small>${tasks.length ? `${done}/${tasks.length} tasks · ${percent}%` : 'Not planned yet'}</small></div><div class="progress-track" role="progressbar" aria-label="${subject} planned tasks completed" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${percent}%"></div></div></div></div>`;
  }).join('');
}

function renderExam() {
  if (!state.settings.exam) {
    $('#exam-count').textContent = 'YOUR PACE';
    $('#exam-caption').textContent = 'Your journey. Your timeline.';
    $('#exam-button').textContent = 'Set your target date ↗';
    return;
  }
  const days = Math.round((new Date(`${state.settings.exam}T12:00:00`) - new Date(`${today()}T12:00:00`)) / 86400000);
  $('#exam-count').textContent = days > 0 ? `${days} days` : days === 0 ? 'Target day!' : 'New chapter';
  $('#exam-caption').textContent = days < 0 ? 'Ready for your next target?' : 'Until your personal target';
  $('#exam-button').textContent = 'Update target date ↗';
}

function render() {
  $('#header-date').textContent = formatDate(today(), { day: 'numeric', month: 'short', year: 'numeric' });
  renderStats();
  renderWeek();
  renderTasks();
  renderSubjects();
  renderExam();
  renderSessionCount();
}

function openTask(task) {
  const form = $('#task-form');
  form.reset();
  $('#task-error').textContent = '';
  $('#task-dialog-title').textContent = task ? 'Edit study task' : 'Add a study task';
  const values = task || { id: '', date: selectedDate, time: '09:00', duration: 60 };
  for (const [key, value] of Object.entries(values)) {
    if (form.elements.namedItem(key)) form.elements.namedItem(key).value = value;
  }
  $('#task-dialog').showModal();
}

function openPlan() {
  $('#plan-form').elements.date.value = selectedDate;
  $('#plan-error').textContent = '';
  $('#plan-dialog').showModal();
}

function openSettings() {
  $('#settings-form').elements.goal.value = state.settings.goal;
  $('#settings-form').elements.exam.value = state.settings.exam;
  $('#settings-error').textContent = '';
  $('#settings-dialog').showModal();
}

$('#task-subject').innerHTML = SUBJECTS.map(subject => `<option>${subject}</option>`).join('');
$('#plan-subjects').innerHTML = SUBJECTS.map(subject => `<label><input type="checkbox" name="subjects" value="${subject}">${subject}</label>`).join('');
$$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$('#add-task').addEventListener('click', () => openTask());
$('#generate-button').addEventListener('click', openPlan);
$('#settings-button').addEventListener('click', openSettings);
$('#exam-button').addEventListener('click', openSettings);
$('.top-avatar').setAttribute('role', 'button');
$('.top-avatar').setAttribute('tabindex', '0');
$('.top-avatar').setAttribute('aria-label', 'Open planner settings');
$('.top-avatar').addEventListener('click', openSettings);
$('.top-avatar').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openSettings(); }
});

$('#task-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const previous = state.tasks.find(task => task.id === data.id);
  const task = { ...data, id: data.id || crypto.randomUUID(), title: data.title.trim(), duration: Number(data.duration), done: previous?.done ?? false };
  if (!validTask(task)) { $('#task-error').textContent = 'Check all fields. Tasks need a title and must finish before midnight.'; return; }
  if (conflicts(state.tasks, task)) { $('#task-error').textContent = 'This time overlaps another task. Choose a different start time.'; return; }
  state.tasks = [...state.tasks.filter(item => item.id !== task.id), task];
  selectedDate = task.date;
  const saved = persist();
  $('#task-dialog').close();
  render();
  if (saved) toast(previous ? 'Task updated. Your plan, your pace.' : 'One small step added to your day.');
});

$('#plan-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  try {
    const tasks = createPlan({ date: data.get('date'), start: data.get('start'), hours: Number(data.get('hours')), subjects: data.getAll('subjects'), tasks: state.tasks });
    state.tasks.push(...tasks);
    selectedDate = data.get('date');
    filter = 'all';
    $$('[data-filter]').forEach(button => button.classList.toggle('active', button.dataset.filter === filter));
    const saved = persist();
    $('#plan-dialog').close();
    setView('schedule');
    if (saved) toast(`Your ${tasks.length}-hour plan is ready. You've got this.`);
  } catch (error) { $('#plan-error').textContent = error.message; }
});

$('#task-list').addEventListener('change', event => {
  if (!event.target.dataset.toggle) return;
  const task = state.tasks.find(task => task.id === event.target.dataset.toggle);
  task.done = event.target.checked;
  persist();
  render();
});
$('#task-list').addEventListener('click', event => {
  const edit = event.target.closest('[data-edit]');
  const remove = event.target.closest('[data-delete]');
  if (edit) openTask(state.tasks.find(task => task.id === edit.dataset.edit));
  if (remove) { deletingId = remove.dataset.delete; $('#delete-dialog').showModal(); }
  if (event.target.closest('#empty-build')) openPlan();
});
$('#delete-form').addEventListener('submit', event => {
  event.preventDefault();
  state.tasks = state.tasks.filter(task => task.id !== deletingId);
  const saved = persist();
  $('#delete-dialog').close();
  render();
  if (saved) toast('Task removed from your plan.');
});
$('#week-strip').addEventListener('click', event => {
  const button = event.target.closest('[data-date]');
  if (button) { selectedDate = button.dataset.date; render(); }
});
$('#previous-week').addEventListener('click', () => { selectedDate = shiftDate(selectedDate, -7); render(); });
$('#next-week').addEventListener('click', () => { selectedDate = shiftDate(selectedDate, 7); render(); });
function jumpToday() { selectedDate = today(); render(); }
$('#today-button').addEventListener('click', jumpToday);
$('#jump-today').addEventListener('click', jumpToday);
$$('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  $$('[data-filter]').forEach(item => item.classList.toggle('active', item === button));
  renderTasks();
}));
$('#all-subjects').addEventListener('click', () => { showAllSubjects = !showAllSubjects; renderSubjects(); });

function setView(next) {
  view = next;
  $('.app-shell').dataset.view = view;
  const titles = { dashboard: ["Let's make today count", 'A clear plan. A focused mind. One step closer to your white coat.', 'Overview'], schedule: ['A plan that works for you', 'Build a rhythm around your goals, one study block at a time.', 'My schedule'], subjects: ['See the bigger picture', 'Completion reflects your planned tasks, not total syllabus coverage.', 'Subjects'], focus: ['This moment is yours', 'Put distractions aside. Choose one thing. Begin.', 'Focus room'] };
  $('#page-title').innerHTML = `${titles[view][0]}<span>.</span>`;
  $('#page-description').textContent = titles[view][1];
  $('#breadcrumb-view').textContent = titles[view][2];
  $$('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  render();
}
$$('.nav-item[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));

$('#settings-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.settings = { goal: Number(data.get('goal')), exam: data.get('exam') };
  const saved = persist();
  $('#settings-dialog').close();
  render();
  if (saved) toast('Your planner, personalised.');
});
$('#export-data').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `pulse-planner-${today()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('#import-data').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 5_000_000) throw new Error('Choose a backup smaller than 5 MB.');
    const data = JSON.parse(await file.text());
    if (!isValidState(data)) throw new Error('This is not a valid Pulse planner backup. Your current plan has not changed.');
    // Merge backups so restoring never silently discards current tasks or sessions.
    const tasks = new Map(state.tasks.map(task => [task.id, task]));
    data.tasks.forEach(task => { if (!tasks.has(task.id)) tasks.set(task.id, task); });
    const sessions = new Map(state.sessions.map(session => [JSON.stringify(session), session]));
    data.sessions.forEach(session => sessions.set(JSON.stringify(session), session));
    state = { version: 1, tasks: [...tasks.values()], sessions: [...sessions.values()], settings: data.settings };
    const saved = persist();
    render();
    $('#settings-form').elements.goal.value = state.settings.goal;
    $('#settings-form').elements.exam.value = state.settings.exam;
    $('#settings-error').textContent = '';
    if (saved) toast('Backup restored. Existing tasks were kept.');
  } catch (error) {
    $('#settings-error').textContent = error instanceof SyntaxError ? 'This file is not valid JSON. Choose a Pulse planner backup.' : error.message;
  } finally { event.target.value = ''; }
});

let timerMode = 25;
let remaining = timerMode * 60;
let deadline = null;
let ticker = null;

function renderTimer() {
  $('#timer').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  $('#start-timer').innerHTML = deadline ? 'Pause <span aria-hidden="true">Ⅱ</span>' : `${remaining < timerMode * 60 ? 'Resume' : timerMode === 25 ? 'Start focus' : 'Start break'} <span aria-hidden="true">▶</span>`;
  $('#timer-caption').textContent = timerMode === 25 ? 'ONE THING AT A TIME' : 'REST IS PRODUCTIVE, TOO';
  document.title = deadline ? `${$('#timer').textContent} | Pulse` : 'Pulse | Your NEET PG study planner';
}

function renderSessionCount() {
  const count = state.sessions.filter(session => session.date === today()).length;
  $('#focus-sessions').textContent = count ? `${count} focus session${count === 1 ? '' : 's'} completed today. Keep your rhythm.` : 'Your next 25 minutes can make a difference.';
}

function stopTimer() { clearInterval(ticker); ticker = null; deadline = null; }
function tick() {
  if (!deadline) return;
  remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  if (remaining === 0) {
    stopTimer();
    if (timerMode === 25) {
      state.sessions.push({ date: today(), minutes: 25, completedAt: new Date().toISOString() });
      persist();
      renderSessionCount();
    }
    toast(timerMode === 25 ? 'Focus complete. You showed up. Time for a break!' : 'Break complete. Ready for your next small win?');
    remaining = timerMode * 60;
  }
  renderTimer();
}
$('#start-timer').addEventListener('click', () => {
  if (deadline) { tick(); stopTimer(); }
  else { deadline = Date.now() + remaining * 1000; ticker = setInterval(tick, 250); }
  renderTimer();
});
$('#reset-timer').addEventListener('click', () => { stopTimer(); remaining = timerMode * 60; renderTimer(); });
$$('[data-mode]').forEach(button => button.addEventListener('click', () => {
  stopTimer();
  timerMode = Number(button.dataset.mode);
  remaining = timerMode * 60;
  $$('[data-mode]').forEach(item => item.classList.toggle('active', item === button));
  renderTimer();
}));
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY) {
    warn('Your planner changed in another tab. Download a backup of any unsaved changes, then reload this tab before editing.');
  }
});
setView('dashboard');
renderTimer();
