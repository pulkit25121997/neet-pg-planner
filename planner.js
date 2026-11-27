export const SUBJECTS = [
  'Anatomy', 'Physiology', 'Biochemistry', 'Pathology', 'Pharmacology',
  'Microbiology', 'Forensic Medicine', 'PSM', 'Medicine', 'Surgery',
  'Obstetrics & Gynaecology', 'Paediatrics', 'Ophthalmology', 'ENT',
  'Orthopaedics', 'Dermatology', 'Psychiatry', 'Anaesthesia', 'Radiology',
];

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validDate(key) {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key)
    && Number.isFinite(Date.parse(`${key}T12:00:00`))
    && dateKey(new Date(`${key}T12:00:00`)) === key;
}

export function shiftDate(key, amount) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

export function weekDates(key) {
  const day = new Date(`${key}T12:00:00`).getDay();
  const monday = shiftDate(key, -(day + 6) % 7);
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
}

export function minutes(time) {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

export function conflicts(tasks, candidate) {
  const start = minutes(candidate.time);
  const end = start + Number(candidate.duration);
  return tasks.some(task => task.id !== candidate.id && task.date === candidate.date
    && start < minutes(task.time) + Number(task.duration) && end > minutes(task.time));
}

export function createPlan({ date, start, hours, subjects, tasks = [], id = () => crypto.randomUUID() }) {
  if (!validDate(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start)) throw new Error('Choose a valid date and start time.');
  if (!subjects.length) throw new Error('Choose at least one subject.');
  if (!subjects.every(subject => SUBJECTS.includes(subject))) throw new Error('Choose subjects from the list.');
  if (!Number.isInteger(hours) || hours < 1 || hours > 12) throw new Error('Choose 1 to 12 study hours.');
  let cursor = minutes(start);
  const blocks = [];
  for (let index = 0; index < hours; index++) {
    const subject = subjects[index % subjects.length];
    let task;
    do {
      if (cursor + 60 > 1440) throw new Error('Not enough time left in this day. Choose an earlier start or fewer hours.');
      task = {
        id: id(), date, subject,
        title: index % 2 ? `${subject} - MCQs & review` : `${subject} - concepts & revision`,
        type: index % 2 ? 'MCQs' : 'Revision',
        priority: 'Medium', time: `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`,
        duration: 60, done: false,
      };
      if (!conflicts([...tasks, ...blocks], task)) break;
      cursor += 15;
    } while (true);
    blocks.push(task);
    cursor += 75;
  }
  return blocks;
}

export function validTask(task) {
  return task && typeof task.id === 'string' && typeof task.title === 'string'
    && task.title.trim().length > 0 && task.title.length <= 160
    && validDate(task.date)
    && SUBJECTS.includes(task.subject) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(task.time)
    && Number.isInteger(task.duration) && task.duration >= 5 && task.duration <= 480
    && minutes(task.time) + task.duration <= 1440
    && ['Revision', 'MCQs', 'Lecture', 'Mock test'].includes(task.type)
    && ['Low', 'Medium', 'High'].includes(task.priority) && typeof task.done === 'boolean';
}
