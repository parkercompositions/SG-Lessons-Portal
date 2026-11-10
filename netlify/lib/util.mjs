// Small shared helpers for the Lesson Studio functions.
import crypto from "node:crypto";

export const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

export const OWNER = "sarah";
export const SITE = () => (process.env.URL || "").replace(/\/$/, "");

// ---------- dates (all dates are plain YYYY-MM-DD strings, studio time) ----------
export const TZ = "America/New_York";
export function todayISO() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return p; // en-CA gives YYYY-MM-DD
}
const pad = (n) => String(n).padStart(2, "0");
export const iso = (d) => d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
export const addDays = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5);
export const dowOf = (s) => (new Date(s + "T12:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
export const fmtLong = (s) => new Date(s + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
export const fmtTime = (m) => { let h = Math.floor(m / 60); const mm = m % 60, ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return h + (mm ? ":" + pad(mm) : "") + " " + ap; };
export const rangeText = (a, b) => (a === b ? fmtLong(a) : fmtLong(a) + " to " + fmtLong(b));

export function occurs(s, date) {
  const r = s && s.regular;
  if (!r || dowOf(date) !== r.dow) return false;
  if (r.every === 2 && r.anchor) { const w = Math.round(daysBetween(r.anchor, date) / 7); return ((w % 2) + 2) % 2 === 0; }
  return true;
}

export const sameEmail = (a, b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
export const first = (n) => String(n || "").split(" ")[0];
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const rid = (p = "") => p + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");

// ---------- teachers (from env) ----------
// TEACHER_EMAILS = "sarah:you@gmail.com,other@gmail.com;mitchell:mitch@gmail.com"
export function teacherEmails() {
  const out = {};
  String(process.env.TEACHER_EMAILS || "").split(";").forEach((part) => {
    const [id, list] = part.split(":");
    if (!id || !list) return;
    out[id.trim().toLowerCase()] = list.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  });
  return out;
}
export function teacherFor(email) {
  const all = teacherEmails();
  for (const [id, list] of Object.entries(all)) if (list.includes(String(email || "").toLowerCase())) return id;
  return null;
}
