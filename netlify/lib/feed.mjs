// The events a student or teacher sees on their own calendar. Used by the
// calendar subscription (.ics) and by the direct Google Calendar connection, so the
// two always agree.
import { occurs, addDays, fmtTime, todayISO } from "./util.mjs";
import { freeOn } from "./apply.mjs";

const LIVE = ["accepted", "logged"];
const TLIVE = ["pending", "accepted", "enrolled"];
export const OPEN_TITLE = "Open for extra lessons/trial lessons";

// Price of a lesson length from a teacher's rates (45 minutes sits halfway between 30 and 60).
export function rateFor(t, mins) {
  const r = (t && t.rates) || {};
  if (r[mins] != null) return +r[mins];
  if (r[30] != null && r[60] != null) return Math.round(+r[30] + ((+r[60] - +r[30]) * (mins - 30)) / 30);
  return r[60] != null ? Math.round((+r[60] * mins) / 60) : 0;
}
export const bookingLabel = (x) => (x.kind === "extra" ? "Extra lesson" : "Get to Know");

// -> [{ uid, date, start, mins, title, desc, cancelled, allDay, endDate, open }]
export function feedEvents(db, { student = null, teacherId = null, from, to, bookingsTo = to, withOpen = false, gbusy = null }) {
  const out = [];
  const tid = student ? student.teacher : teacherId, T = db.teachers[tid];
  if (!T) return out;
  const away = (d) => (T.away || []).find((a) => d >= a.from && d <= a.to);
  const today = todayISO();
  const list = student ? [student] : db.students.filter((s) => !s.archived && s.teacher === tid);

  for (let d = from; d <= to; d = addDays(d, 1)) {
    for (const s of list) {
      if (!s.regular || !occurs(s, d) || away(d)) continue;
      const ses = db.sessions[s.id + "|" + d] || {};
      const who = student ? `Lesson with ${T.name}` : `${s.name} · lesson`;
      const remote = ses.mode === "remote";
      out.push({ uid: `l-${s.id}-${d}`, date: d, start: s.regular.start, mins: s.regular.mins, title: (ses.mode === "cancelled" ? "Cancelled: " : "") + who + (remote ? " (remote)" : ""),
        desc: remote ? (ses.link ? "Join: " + ses.link : "Remote lesson. The link will come by email.") : "", cancelled: ses.mode === "cancelled" });
    }
    // Teachers also see their open times, minus anything already booked.
    if (withOpen && !student && d >= today) {
      freeOn(db, tid, d, gbusy).forEach(([a, b]) => out.push({ uid: `o-${tid}-${d}-${a}`, date: d, start: a, mins: b - a, title: OPEN_TITLE,
        desc: "Students can request an extra lesson here, and Rhapsody Music can book a trial or extra lesson. It disappears once booked.", open: true }));
    }
  }
  db.requests.filter((r) => r.teacher === tid && r.date >= from && r.date <= bookingsTo && (student ? r.studentId === student.id : true) && (LIVE.includes(r.status) || r.status === "cancelled")).forEach((r) => {
    const s = db.students.find((x) => x.id === r.studentId);
    out.push({ uid: `x-${r.id}`, date: r.date, start: r.start, mins: r.mins, title: (r.status === "cancelled" ? "Cancelled: " : "") + (student ? `Extra lesson with ${T.name}` : `${s ? s.name : "Student"} · extra lesson`) + (r.mode === "remote" ? " (remote)" : ""),
      desc: r.note || "", cancelled: r.status === "cancelled" });
  });
  if (!student) {
    db.trials.filter((x) => x.teacher === tid && x.date >= from && x.date <= bookingsTo && TLIVE.includes(x.status)).forEach((x) =>
      out.push({ uid: `t-${x.id}`, date: x.date, start: x.start, mins: x.mins,
        title: `${bookingLabel(x)}: ${x.name}${x.status === "pending" ? " (to confirm)" : ""}`,
        desc: [`${x.kind === "extra" ? `Extra lesson, ${x.mins} minutes, about $${rateFor(T, x.mins)}` : `Free trial lesson, ${x.mins} minutes`}. Booked through ${(db.store && db.store.name) || "the store"}${x.bookedBy ? " by " + x.bookedBy : ""}.`,
          `${x.instrument}. ${x.guardian ? x.guardian + ", " : ""}${x.email}${x.phone ? ", " + x.phone : ""}`, x.note || ""].filter(Boolean).join("\n") }));
  }
  (T.away || []).filter((a) => a.to >= from && a.from <= bookingsTo).forEach((a) =>
    out.push({ uid: `a-${tid}-${a.id}`, date: a.from, endDate: a.to, allDay: true, title: student ? `No lesson: ${T.short} is away` : `Away${a.note ? ": " + a.note : ""}` }));
  return out;
}
export { fmtTime };
