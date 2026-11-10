// What each person is allowed to see.
//  * Sarah (owner): everything.
//  * Mitchell: his own students, requests and Classroom classes, plus every teacher's
//    public settings.
//  * A student: their own record, their teacher's public settings, and only the
//    *times* other students are booked (no names), so open slots can be worked out.
import { sameEmail, clone } from "./util.mjs";

const LIVE = ["pending", "accepted", "logged"];
const TLIVE = ["pending", "accepted", "enrolled"];
const anonTrial = (x) => ({ id: x.id, anon: true, teacher: x.teacher, date: x.date, start: x.start, mins: x.mins, status: x.status, name: "" });

function publicTeacher(t) {
  const { id, name, short, owner, rates, paypal, zelle, phone, open, away, firstFree, rev } = t;
  return { id, name, short, owner, rates, paypal, zelle, phone, open, away, firstFree, rev };
}

export function classesWithTeachers(cache, db) {
  return (cache.classes || []).map((c) => ({ ...c, teacher: db.classMap[c.id] || c.teacherGuess || "sarah" }));
}

export function classroomFor(cache, db, who) {
  const classes = classesWithTeachers(cache, db);
  const base = { connected: !!cache.connected, account: cache.account || "", synced: cache.synced || 0, error: cache.error || "" };
  if (who.role === "teacher" && who.owner) return { ...base, classes, roster: cache.roster || {}, items: cache.items || [] };
  if (who.role === "teacher") {
    const ids = classes.filter((c) => c.teacher === who.id).map((c) => c.id);
    const roster = {}; ids.forEach((id) => (roster[id] = (cache.roster || {})[id] || []));
    return { ...base, classes, roster, items: (cache.items || []).filter((i) => ids.includes(i.cls)) };
  }
  // student
  const me = db.students.find((s) => s.id === who.id);
  const mine = classes.filter((c) => ((cache.roster || {})[c.id] || []).some((r) => sameEmail(r.email, me.email)));
  const roster = {}; mine.forEach((c) => (roster[c.id] = [{ name: me.name, email: me.email }]));
  const ids = mine.map((c) => c.id);
  return { ...base, account: "", classes: mine, roster, items: (cache.items || []).filter((i) => ids.includes(i.cls)) };
}

export function viewFor(db, who, cache) {
  if (who.role === "teacher" && who.owner) {
    return { me: who, teachers: db.teachers, students: db.students.filter((s) => !s.archived), requests: db.requests, trials: db.trials, store: db.store, sessions: db.sessions, classroom: classroomFor(cache, db, who) };
  }
  if (who.role === "teacher") {
    const students = db.students.filter((s) => !s.archived && s.teacher === who.id);
    const ids = new Set(students.map((s) => s.id));
    const sessions = {}; Object.entries(db.sessions).forEach(([k, v]) => { if (ids.has(k.split("|")[0])) sessions[k] = v; });
    const teachers = {}; Object.values(db.teachers).forEach((t) => (teachers[t.id] = t.id === who.id ? t : publicTeacher(t)));
    return { me: who, teachers, students, requests: db.requests.filter((r) => r.teacher === who.id), trials: db.trials.filter((x) => x.teacher === who.id), store: db.store, sessions, classroom: classroomFor(cache, db, who) };
  }
  // student
  const me = db.students.find((s) => s.id === who.id);
  const t = db.teachers[me.teacher];
  const others = db.students.filter((s) => !s.archived && s.teacher === me.teacher && s.id !== me.id && s.regular)
    .map((s, i) => ({ id: "busy" + i, anon: true, name: "", teacher: s.teacher, regular: s.regular, lessons: [], rep: [], grid: {} }));
  const requests = db.requests.filter((r) => r.teacher === me.teacher && (r.studentId === me.id || LIVE.includes(r.status)))
    .map((r) => (r.studentId === me.id ? r : { id: r.id, anon: true, studentId: "busy", teacher: r.teacher, date: r.date, start: r.start, mins: r.mins, status: r.status }));
  const sessions = {}; Object.entries(db.sessions).forEach(([k, v]) => { if (k.split("|")[0] === me.id) sessions[k] = v; });
  const mineOnly = clone(me);
  const trials = db.trials.filter((x) => x.teacher === me.teacher && TLIVE.includes(x.status)).map(anonTrial);
  return { me: who, teachers: { [t.id]: publicTeacher(t) }, students: [mineOnly, ...others], requests, trials, store: { name: db.store.name }, sessions, classroom: classroomFor(cache, db, who) };
}

// Rhapsody Music, through its private link: open times, anonymous busy times, and the
// Get to Know sessions the store has booked. No students, lessons or money.
export function viewForStore(db) {
  const teachers = {}; Object.values(db.teachers).forEach((t) => { teachers[t.id] = { id: t.id, name: t.name, short: t.short, open: t.open, away: t.away, firstFree: t.firstFree, rates: {}, rev: 0 }; });
  const students = db.students.filter((s) => !s.archived && s.regular).map((s, i) => ({ id: "busy" + i, anon: true, name: "", teacher: s.teacher, regular: s.regular, lessons: [], rep: [], grid: {} }));
  const requests = db.requests.filter((r) => LIVE.includes(r.status)).map((r) => ({ id: r.id, anon: true, studentId: "busy", teacher: r.teacher, date: r.date, start: r.start, mins: r.mins, status: r.status }));
  const trials = db.trials.map(({ reply, ...x }) => x);
  return { me: { role: "store" }, teachers, students, requests, trials, store: { name: db.store.name, trialMins: db.store.trialMins }, sessions: {}, classroom: { connected: false, classes: [], roster: {}, items: [] } };
}
