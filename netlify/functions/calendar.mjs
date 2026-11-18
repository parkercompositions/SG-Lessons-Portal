// Calendar subscriptions (Google, Apple, Outlook): /api/calendar/<token>.ics
// The token in the link is private to one student or teacher. The feed covers the
// last 30 days and the next 6 months, and calendar apps refresh it on their own.
import { readDb } from "../lib/store.mjs";
import { addDays, todayISO, toHM } from "../lib/util.mjs";
import { feedEvents } from "../lib/feed.mjs";
import { readBusyMap } from "../lib/gcal.mjs";

const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line) => { const out = []; let l = line; while (l.length > 74) { out.push(l.slice(0, 74)); l = " " + l.slice(74); } out.push(l); return out.join("\r\n"); };
const dt = (date, min) => date.replace(/-/g, "") + "T" + toHM(min).replace(":", "") + "00";
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

const VTZ = ["BEGIN:VTIMEZONE", "TZID:America/New_York",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:-0500", "TZOFFSETTO:-0400", "TZNAME:EDT", "DTSTART:19700308T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:-0400", "TZOFFSETTO:-0500", "TZNAME:EST", "DTSTART:19701101T020000", "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU", "END:STANDARD",
  "END:VTIMEZONE"];

function ev({ uid, date, start, mins, title, desc = "", cancelled = false, allDay = false, endDate, open = false }) {
  const lines = ["BEGIN:VEVENT", `UID:${uid}@sg-lesson-studio`, `DTSTAMP:${stamp()}`];
  if (allDay) lines.push(`DTSTART;VALUE=DATE:${date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${addDays(endDate || date, 1).replace(/-/g, "")}`);
  else lines.push(`DTSTART;TZID=America/New_York:${dt(date, start)}`, `DTEND;TZID=America/New_York:${dt(date, start + mins)}`);
  lines.push(`SUMMARY:${esc(title)}`);
  if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
  if (cancelled) lines.push("STATUS:CANCELLED");
  if (open) lines.push("TRANSP:TRANSPARENT");
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

  const from = addDays(todayISO(), -30), to = addDays(todayISO(), 183);
  const tid = student ? student.teacher : teacher.id, T = db.teachers[tid];
  const out = [];
  feedEvents(db, { student, teacherId: tid, from, to, bookingsTo: "9999-12-31", withOpen: !student, gbusy: await readBusyMap() }).forEach((e) => out.push(...ev(e)));

  const name = student ? `Lessons with ${T.short}` : `${T.short}'s teaching`;
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sarah Griego Music//Lesson Studio//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`, "X-WR-TIMEZONE:America/New_York", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H", ...VTZ, ...out, "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
  return new Response(body, { status: 200, headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-cache" } });
};

export const config = { path: "/api/calendar/:file" };
