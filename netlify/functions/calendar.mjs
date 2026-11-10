// Calendar subscriptions (Google, Apple, Outlook): /api/calendar/<token>.ics
// The token in the link is private to one student or teacher. The feed covers the
// last 30 days and the next 6 months, and calendar apps refresh it on their own.
import { readDb } from "../lib/store.mjs";
import { occurs, addDays, todayISO, toHM, fmtTime } from "../lib/util.mjs";

const LIVE = ["accepted", "logged"];
const TLIVE = ["pending", "accepted", "enrolled"];
const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line) => { const out = []; let l = line; while (l.length > 74) { out.push(l.slice(0, 74)); l = " " + l.slice(74); } out.push(l); return out.join("\r\n"); };
const dt = (date, min) => date.replace(/-/g, "") + "T" + toHM(min).replace(":", "") + "00";
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

const VTZ = ["BEGIN:VTIMEZONE", "TZID:America/New_York",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:-0500", "TZOFFSETTO:-0400", "TZNAME:EDT", "DTSTART:19700308T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:-0400", "TZOFFSETTO:-0500", "TZNAME:EST", "DTSTART:19701101T020000", "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU", "END:STANDARD",
  "END:VTIMEZONE"];

function ev({ uid, date, start, mins, title, desc = "", cancelled = false, allDay = false, endDate }) {
  const lines = ["BEGIN:VEVENT", `UID:${uid}@sg-lesson-studio`, `DTSTAMP:${stamp()}`];
  if (allDay) lines.push(`DTSTART;VALUE=DATE:${date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${addDays(endDate || date, 1).replace(/-/g, "")}`);
  else lines.push(`DTSTART;TZID=America/New_York:${dt(date, start)}`, `DTEND;TZID=America/New_York:${dt(date, start + mins)}`);
  lines.push(`SUMMARY:${esc(title)}`);
  if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
  if (cancelled) lines.push("STATUS:CANCELLED");
  lines.push("END:VEVENT");
  return lines;
}

export default async (req, context) => {
  const file = (context.params && context.params.file) || new URL(req.url).pathname.split("/").pop();
  const token = String(file || "").replace(/\.ics$/, "");
  let db;
  try { ({ db } = await readDb()); } catch (e) { return new Response("Calendar temporarily unavailable", { status: 503 }); }
  const student = db.students.find((s) => !s.archived && s.calToken === token);
  const teacher = !student && Object.values(db.teachers).find((t) => t.calToken === token);
  if (!token || (!student && !teacher)) return new Response("Not found", { status: 404 });

  const from = addDays(todayISO(), -30), to = addDays(todayISO(), 183), out = [];
  const tid = student ? student.teacher : teacher.id, T = db.teachers[tid];
  const away = (d) => (T.away || []).find((a) => d >= a.from && d <= a.to);
  const list = student ? [student] : db.students.filter((s) => !s.archived && s.teacher === tid);

  for (let d = from; d <= to; d = addDays(d, 1)) {
    for (const s of list) {
      if (!occurs(s, d) || away(d)) continue;
      const ses = db.sessions[s.id + "|" + d] || {};
      const who = student ? `Lesson with ${T.name}` : `${s.name} · lesson`;
      const remote = ses.mode === "remote";
      out.push(...ev({ uid: `l-${s.id}-${d}`, date: d, start: s.regular.start, mins: s.regular.mins, title: (ses.mode === "cancelled" ? "Cancelled: " : "") + who + (remote ? " (remote)" : ""),
        desc: remote ? (ses.link ? "Join: " + ses.link : "Remote lesson. The link will come by email.") : "", cancelled: ses.mode === "cancelled" }));
    }
  }
  db.requests.filter((r) => r.teacher === tid && r.date >= from && (student ? r.studentId === student.id : true) && (LIVE.includes(r.status) || r.status === "cancelled")).forEach((r) => {
    const s = db.students.find((x) => x.id === r.studentId);
    out.push(...ev({ uid: `x-${r.id}`, date: r.date, start: r.start, mins: r.mins, title: (r.status === "cancelled" ? "Cancelled: " : "") + (student ? `Extra lesson with ${T.name}` : `${s ? s.name : "Student"} · extra lesson`) + (r.mode === "remote" ? " (remote)" : ""), cancelled: r.status === "cancelled" }));
  });
  if (teacher) {
    db.trials.filter((x) => x.teacher === tid && x.date >= from && TLIVE.includes(x.status)).forEach((x) =>
      out.push(...ev({ uid: `t-${x.id}`, date: x.date, start: x.start, mins: x.mins, title: `Get to Know: ${x.name}${x.status === "pending" ? " (to confirm)" : ""}`, desc: `${x.instrument}. ${x.guardian ? x.guardian + ", " : ""}${x.email}${x.phone ? ", " + x.phone : ""}` })));
  }
  (T.away || []).filter((a) => a.to >= from).forEach((a) =>
    out.push(...ev({ uid: `a-${tid}-${a.id}`, date: a.from, endDate: a.to, allDay: true, title: student ? `No lesson: ${T.short} is away` : `Away${a.note ? ": " + a.note : ""}` })));

  const name = student ? `Lessons with ${T.short}` : `${T.short}'s teaching`;
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sarah Griego Music//Lesson Studio//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`, "X-WR-TIMEZONE:America/New_York", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H", ...VTZ, ...out, "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
  return new Response(body, { status: 200, headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-cache" } });
};

export const config = { path: "/api/calendar/:file" };
