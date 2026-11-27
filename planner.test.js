import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, validDate, shiftDate, weekDates, conflicts, createPlan, validTask } from './planner.js';

const base = { id: 'existing', date: '2026-11-27', time: '09:00', duration: 60 };
test('calendar uses Monday weeks across month and year boundaries', () => {
  assert.equal(weekDates('2027-01-01')[0], '2026-12-28');
  assert.equal(weekDates('2027-01-03')[6], '2027-01-03');
  assert.equal(shiftDate('2028-02-28', 1), '2028-02-29');
  assert.equal(dateKey(new Date(2026, 0, 2)), '2026-01-02');
  assert.equal(validDate('2026-02-31'), false);
  assert.equal(validDate('2028-02-29'), true);
});
test('overlap excludes adjacent slots, other dates and the task being edited', () => {
  assert.equal(conflicts([base], { ...base, id: 'new', time: '09:30' }), true);
  assert.equal(conflicts([base], { ...base, id: 'new', time: '10:00' }), false);
  assert.equal(conflicts([base], { ...base, id: 'new', date: '2026-11-28' }), false);
  assert.equal(conflicts([base], base), false);
});
test('generated plans preserve breaks, rotate subjects and avoid existing tasks', () => {
  let counter = 0;
  const tasks = createPlan({ date: base.date, start: '08:00', hours: 4, subjects: ['Medicine', 'Surgery'], tasks: [base], id: () => String(counter++) });
  assert.equal(tasks.length, 4);
  assert.deepEqual(tasks.map(task => task.time), ['08:00', '10:00', '11:15', '12:30']);
  assert.deepEqual(tasks.map(task => task.type), ['Revision', 'MCQs', 'Revision', 'MCQs']);
  assert.deepEqual(tasks.map(task => task.subject), ['Medicine', 'Surgery', 'Medicine', 'Surgery']);
  for (const task of tasks) {
    assert.ok(validTask(task));
    assert.equal(conflicts([base, ...tasks], task), false);
  }
});
test('generation reports invalid requests and insufficient same-day time', () => {
  const args = { date: base.date, start: '23:30', hours: 1, subjects: ['Medicine'] };
  assert.throws(() => createPlan(args), /Not enough time/);
  assert.throws(() => createPlan({ ...args, subjects: [] }), /at least one/);
  assert.throws(() => createPlan({ ...args, hours: 1.5 }), /1 to 12/);
  assert.throws(() => createPlan({ ...args, date: '2026-02-31' }), /valid date/);
  assert.throws(() => createPlan({ ...args, start: 'invalid' }), /valid date/);
});
test('task validation rejects malformed or overnight data', () => {
  const task = createPlan({ date: base.date, start: '08:00', hours: 1, subjects: ['Medicine'] })[0];
  assert.ok(validTask(task));
  for (const patch of [{ title: ' ' }, { time: '24:00' }, { duration: -1 }, { duration: 1.5 }, { subject: 'Unknown' }, { date: 'bad' }, { time: '23:45' }, { done: 'yes' }]) {
    assert.equal(validTask({ ...task, ...patch }), false);
  }
});
