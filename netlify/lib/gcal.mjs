// Direct Google Calendar connection, one per teacher.
//
// What it can do, and nothing more (two narrow Google permissions):
//  * calendar.app.created: make ONE calendar called "Lesson Studio" in the teacher's
//    Google account and manage the events in it. It can't see or change any other calendar.
//  * calendar.freebusy: read only the busy/free times of the teacher's main calendar
//    (no titles, no details), so a doctor's appointment there hides that open time here.
//
// Every save in the studio pushes the next 8 weeks (lessons, extra lessons, store
// bookings, open times, away dates) into the Lesson Studio calendar right away.
import crypto from "node:crypto";
import { SITE, TZ, todayISO, addDays, toHM } from "./util.mjs";
import { tokenCall } from "./google.mjs";
import { feedEvents } from "./feed.mjs";
import { readGcalToken, writeGcalToken, deleteGcalToken, readGcalState, writeGcalState, listGcalStates } from "./store.mjs";

export const GCAL_SCOPES = ["openid", "email",
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.freebusy"];
export const gcalRedirect = () => `${SITE()}/api/gcal/callback`;
const API = "https://www.googleapis.com/calendar/v3";
const WEEKS = 8;
const BUSY_MAX_AGE = 10 * 60 * 1000;

// After a save, bring each connected Google Calendar up to date without making the page wait.
export const later = (context, work) => { const p = Promise.resolve().then(work).catch((e) => console.error("[gcal] push", e.message)); if (context && context.waitUntil) context.waitUntil(p); return p; };

// Only what shows on a calendar. A scale-sheet tap or a payment doesn't need a push.
export const calSig = (db) => JSON.stringify([
  Object.values(db.teachers).map((t) => [t.id, t.name, t.short, t.open, t.away, t.rates]),
  db.students.map((x) => [x.id, x.name, x.teacher, x.regular, !!x.archived]), db.requests, db.trials, db.sessions, db.store && db.store.name]);

export const gcalConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function gcalAuthUrl(state, loginHint) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: gcalRedirect(), response_type: "code",
    scope: GCAL_SCOPES.join(" "), access_type: "offline", prompt: "consent", state, ...(loginHint ? { login_hint: loginHint } : {}),
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + q;
}

export async function gcalExchange(tid, code) {
  const j = await tokenCall({ code, grant_type: "authorization_code", redirect_uri: gcalRedirect() });
  const granted = String(j.scope || "");
  if (!GCAL_SCOPES.slice(2).every((s) => granted.includes(s))) {
    const e = new Error("Google didn't give both permissions. Connect again and tick both boxes."); e.code = "scopes"; throw e;
  }
  if (!j.refresh_token) throw new Error("Google didn't send a long-term key. Remove the app at myaccount.google.com/permissions and connect again.");
  let email = "";
  try { email = JSON.parse(Buffer.from(String(j.id_token).split(".")[1], "base64url").toString()).email || ""; } catch (e) {}
  const old = await readGcalToken(tid);
  await writeGcalToken(tid, { refresh_token: j.refresh_token, email, calendarId: old && old.email === email ? old.calendarId || "" : "", at: Date.now() });
  return email;
}

async function accessFor(tid) {
  const tok = await readGcalToken(tid);
  if (!tok) return { tok: null };
  try { return { tok, access: (await tokenCall({ refresh_token: tok.refresh_token, grant_type: "refresh_token" })).access_token }; }
  catch (e) {
    const gone = e.code === "invalid_grant";
    await writeGcalState(tid, { ...(await readGcalState(tid)), connected: !gone, error: gone ? "Google ended the connection. Connect again in Settings." : e.message });
    return { tok, error: e };
  }
}

async function gapi(access, method, path, body) {
  const r = await fetch(API + path, { method, headers: { authorization: "Bearer " + access, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { status: r.status, ok: r.ok, j };
}
const fail = (res, what) => new Error(`${what}: ${(res.j.error && res.j.error.message) || "Google said " + res.status}`);

async function ensureCalendar(tid, tok, access, T) {
  if (tok.calendarId) {
    const got = await gapi(access, "GET", `/calendars/${encodeURIComponent(tok.calendarId)}`);
    if (got.ok) return tok.calendarId;
    if (got.status !== 404 && got.status !== 410) throw fail(got, "Couldn't open the Lesson Studio calendar");
  }
  const made = await gapi(access, "POST", "/calendars", { summary: "Lesson Studio", description: `${T.name}'s lessons, extra lessons, trial lessons and open times from the Sarah Griego Lesson Studio. Changes here are replaced by the studio.`, timeZone: TZ });
  if (!made.ok) throw fail(made, "Couldn't make the Lesson Studio calendar");
  await writeGcalToken(tid, { ...tok, calendarId: made.j.id });
  return made.j.id;
}

// Google gives busy times as instants; turn them into studio dates and minutes.
const nyParts = (ms) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
};
export function busyToDays(list) {
  const days = {};
  for (const b of list || []) {
    let s = Date.parse(b.start); const e = Date.parse(b.end);
    for (let guard = 0; s < e && guard < 60; guard++) {
      const a = nyParts(s), z = nyParts(e);
      const endMin = z.date === a.date ? z.min : 1440;
      if (endMin > a.min) (days[a.date] = days[a.date] || []).push([a.min, endMin]);
      if (z.date === a.date) break;
      s += (1440 - a.min) * 60000; // next studio midnight (nudged back onto it on daylight-saving days)
      const n = nyParts(s).min; if (n) s += (n < 720 ? -n : 1440 - n) * 60000;
    }
  }
  return days;
}

async function pullBusy(access) {
  const from = new Date(), to = new Date(Date.now() + WEEKS * 7 * 864e5);
  const r = await gapi(access, "POST", "/freeBusy", { timeMin: from.toISOString(), timeMax: to.toISOString(), timeZone: TZ, items: [{ id: "primary" }] });
  if (!r.ok) throw fail(r, "Couldn't read your busy times");
  const cal = (r.j.calendars || {}).primary || {};
  if (cal.errors && cal.errors.length) throw new Error("Couldn't read your busy times: " + cal.errors[0].reason);
  return busyToDays(cal.busy || []);
}

// ---------- events ----------
const eventId = (uid) => "ls" + crypto.createHash("sha1").update(uid).digest("hex"); // Google ids: a-v and 0-9
const dtAt = (date, min) => (min >= 1440 ? `${addDays(date, 1)}T${toHM(min - 1440)}:00` : `${date}T${toHM(min)}:00`);
export function eventBody(e) {
  const body = {
    summary: e.title, description: e.desc || "",
    start: e.allDay ? { date: e.date } : { dateTime: dtAt(e.date, e.start), timeZone: TZ },
    end: e.allDay ? { date: addDays(e.endDate || e.date, 1) } : { dateTime: dtAt(e.date, e.start + e.mins), timeZone: TZ },
    transparency: e.open || e.cancelled || e.allDay ? "transparent" : "opaque",
    ...(e.open ? { colorId: "2", reminders: { useDefault: false } } : e.cancelled ? { colorId: "8", reminders: { useDefault: false } } : {}),
  };
  const h = crypto.createHash("sha1").update(JSON.stringify(body)).digest("hex").slice(0, 16);
  return { id: eventId(e.uid), ...body, extendedProperties: { private: { ls: "1", h } } };
}

async function listOurs(access, cal, from, to) {
  const out = []; let pageToken = "";
  for (let i = 0; i < 20; i++) {
    const q = new URLSearchParams({ timeMin: `${addDays(from, -1)}T00:00:00Z`, timeMax: `${addDays(to, 2)}T00:00:00Z`, privateExtendedProperty: "ls=1", maxResults: "2500", singleEvents: "true", showDeleted: "false", ...(pageToken ? { pageToken } : {}) });
    const r = await gapi(access, "GET", `/calendars/${encodeURIComponent(cal)}/events?${q}`);
    if (!r.ok) throw fail(r, "Couldn't read the Lesson Studio calendar");
    out.push(...(r.j.items || []));
    if (!r.j.nextPageToken) break;
    pageToken = r.j.nextPageToken;
  }
  return out;
}

async function pool(tasks, n = 4) {
  const errs = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) { const t = tasks[i++]; try { await t(); } catch (e) { errs.push(e); } } }));
  return errs;
}

// Make the Lesson Studio calendar match the studio for the next 8 weeks.
async function pushEvents(db, tid, access, cal, gbusy) {
  const from = addDays(todayISO(), -7), to = addDays(todayISO(), WEEKS * 7);
  const want = new Map(feedEvents(db, { teacherId: tid, from, to, withOpen: true, gbusy }).map((e) => { const b = eventBody(e); return [b.id, b]; }));
  const have = await listOurs(access, cal, from, to);
  const haveById = new Map(have.map((e) => [e.id, e]));
  const path = (id) => `/calendars/${encodeURIComponent(cal)}/events${id ? "/" + id : ""}`;
  const tasks = [];
  for (const [id, b] of want) {
    const cur = haveById.get(id);
    if (!cur) tasks.push(async () => {
      const r = await gapi(access, "POST", path(), b);
      if (r.status === 409) { const u = await gapi(access, "PUT", path(id), { ...b, status: "confirmed" }); if (!u.ok) throw fail(u, "Couldn't update an event"); }
      else if (!r.ok) throw fail(r, "Couldn't add an event");
    });
    else if (((cur.extendedProperties || {}).private || {}).h !== b.extendedProperties.private.h) tasks.push(async () => {
      const r = await gapi(access, "PUT", path(id), b); if (!r.ok) throw fail(r, "Couldn't update an event");
    });
  }
  for (const e of have) {
    const day = (e.start && (e.start.date || String(e.start.dateTime || "").slice(0, 10))) || "";
    if (!want.has(e.id) && day >= from && day <= to) tasks.push(async () => {
      const r = await gapi(access, "DELETE", path(e.id)); if (!r.ok && r.status !== 404 && r.status !== 410) throw fail(r, "Couldn't remove an event");
    });
  }
  const errs = await pool(tasks);
  if (errs.length) throw errs[0];
  return tasks.length;
}

// Full sync for one teacher: busy times in, studio events out.
export async function syncTeacher(db, tid) {
  const T = db.teachers[tid];
  if (!T || !gcalConfigured()) return null;
  const { tok, access, error } = await accessFor(tid);
  if (!tok || error) return readGcalState(tid);
  const state = await readGcalState(tid);
  try {
    const cal = await ensureCalendar(tid, (await readGcalToken(tid)) || tok, access, T);
    const busy = await pullBusy(access);
    const gbusy = { ...(await readBusyMap()), [tid]: busy };
    await pushEvents(db, tid, access, cal, gbusy);
    const next = { connected: true, account: tok.email || "", synced: Date.now(), error: "", busy, busyAt: Date.now() };
    await writeGcalState(tid, next);
    return next;
  } catch (e) {
    console.error("[gcal] sync", tid, e.message);
    const next = { ...state, connected: true, account: tok.email || state.account || "", error: e.message };
    await writeGcalState(tid, next);
    return next;
  }
}

export async function syncAll(db) {
  const out = {};
  for (const tid of Object.keys(db.teachers)) if (await readGcalToken(tid)) out[tid] = await syncTeacher(db, tid);
  return out;
}

// Busy times for every connected teacher -> { tid: { date: [[start, end]] } }
export async function readBusyMap() {
  const out = {};
  for (const [tid, st] of Object.entries(await listGcalStates())) if (st && st.connected && st.busy) out[tid] = st.busy;
  return out;
}

// Before showing open times, refresh busy times that are more than 10 minutes old.
// Never makes a page wait more than a few seconds for Google.
export async function freshBusyMap(db, waitMs = 3500) {
  if (!gcalConfigured()) return {};
  const states = await listGcalStates();
  const stale = Object.keys(db.teachers).filter((tid) => states[tid] && states[tid].connected && Date.now() - (states[tid].busyAt || 0) > BUSY_MAX_AGE);
  if (stale.length) {
    const work = Promise.all(stale.map(async (tid) => {
      const { tok, access, error } = await accessFor(tid);
      if (!tok || error) return;
      try { const busy = await pullBusy(access); await writeGcalState(tid, { ...states[tid], busy, busyAt: Date.now(), error: "" }); }
      catch (e) { console.error("[gcal] busy", tid, e.message); }
    }));
    await Promise.race([work, new Promise((r) => setTimeout(r, waitMs))]);
  }
  return readBusyMap();
}

// Status for the teacher's own Settings (no tokens, no busy details).
export async function gcalStatus() {
  const out = {};
  for (const [tid, st] of Object.entries(await listGcalStates())) out[tid] = { connected: !!st.connected, account: st.account || "", synced: st.synced || 0, error: st.error || "" };
  return out;
}

export async function gcalDisconnect(tid) {
  const tok = await readGcalToken(tid);
  if (tok) {
    try {
      const access = (await tokenCall({ refresh_token: tok.refresh_token, grant_type: "refresh_token" })).access_token;
      if (tok.calendarId) await gapi(access, "DELETE", `/calendars/${encodeURIComponent(tok.calendarId)}`); // take the Lesson Studio calendar away too
    } catch (e) {}
    try { await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(tok.refresh_token), { method: "POST" }); } catch (e) {}
  }
  await deleteGcalToken(tid);
  await writeGcalState(tid, { connected: false, account: "", synced: 0, error: "" });
}
