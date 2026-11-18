// Open times (weekly and one date only), trial vs. extra bookings from the store,
// and the direct Google Calendar connection, against a fake Google.
import test from "node:test";
import assert from "node:assert/strict";
import { setup, call, signIn, route } from "./harness.mjs";
import { addDays, todayISO, dowOf } from "../netlify/lib/util.mjs";

const H = await setup();
const { busyToDays } = await import("../netlify/lib/gcal.mjs"); // after setup, so storage is the test fake

// ---------- a tiny fake Google (token + Calendar API) ----------
const G = { calendars: new Map(), busy: [], scopes: "openid email https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar.freebusy", n: 0 };
const ok = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { "content-type": "application/json" } });
const idTok = (email) => "h." + Buffer.from(JSON.stringify({ email })).toString("base64url") + ".s";
globalThis.__fakeGoogle = async (u, opts = {}) => {
  const method = (opts.method || "GET").toUpperCase();
  if (u === "https://oauth2.googleapis.com/token") {
    const p = new URLSearchParams(String(opts.body));
    if (p.get("grant_type") === "authorization_code") return ok({ access_token: "A", refresh_token: "R-" + p.get("code"), scope: G.scopes, id_token: idTok(p.get("code") + "@x.com") });
    return ok({ access_token: "A" });
  }
  if (u.startsWith("https://oauth2.googleapis.com/revoke")) return ok({});
  if (!u.startsWith("https://www.googleapis.com/calendar/v3")) return null;
  const url = new URL(u), path = url.pathname.replace("/calendar/v3", ""), body = opts.body ? JSON.parse(opts.body) : null;
  if (path === "/freeBusy") return ok({ calendars: { primary: { busy: G.busy } } });
  if (path === "/calendars" && method === "POST") { const id = "cal" + ++G.n; G.calendars.set(id, new Map()); return ok({ id, summary: body.summary }); }
  const m = path.match(/^\/calendars\/([^/]+)(?:\/events(?:\/([^/]+))?)?$/);
  if (!m) return ok({ error: { message: "no route " + path } }, 404);
  const cal = G.calendars.get(decodeURIComponent(m[1]));
  if (!cal) return ok({ error: { message: "Not Found" } }, 404);
  if (!path.includes("/events")) return method === "DELETE" ? (G.calendars.delete(decodeURIComponent(m[1])), new Response(null, { status: 204 })) : ok({ id: m[1] });
  const id = m[2];
  if (!id && method === "GET") return ok({ items: [...cal.values()] });
  if (!id && method === "POST") { if (cal.has(body.id)) return ok({ error: { message: "dup" } }, 409); cal.set(body.id, body); return ok(body); }
  if (method === "PUT") { cal.set(id, body); return ok(body); }
  if (method === "DELETE") { if (!cal.has(id)) return ok({}, 410); cal.delete(id); return new Response(null, { status: 204 }); }
  return ok({ error: { message: "?" } }, 400);
};
const events = () => [...[...G.calendars.values()][0]?.values() || []];
const until = async (fn, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 20)); } return false; };

// A one-off date 10 days out, with 1-2 PM busy in Google (EST, so 18:00-19:00 UTC).
const ONE = addDays(todayISO(), 10);
let sarah, code;

test("open times can repeat weekly or be one date only", async () => {
  sarah = await signIn("sarah@x.com");
  const d = (await call("GET", "/api/data", null, sarah)).body;
  code = d.store.code;
  const r = await call("POST", "/api/data", { puts: [{ type: "teacher", value: { ...d.teachers.sarah, open: [{ dow: (dowOf(ONE) + 1) % 7, start: 600, end: 720 }, { date: ONE, start: 720, end: 900 }, { date: "bad", start: 0, end: 10 }] } }] }, sarah);
  assert.equal(r.body.results[0].ok, true);
  assert.deepEqual(r.body.results[0].value.open, [{ dow: (dowOf(ONE) + 1) % 7, start: 600, end: 720 }, { date: ONE, start: 720, end: 900 }], "bad blocks are dropped");
});

test("the store books a trial (30 min) or an extra lesson (30, 45 or 60 min)", async () => {
  let r = await call("POST", "/api/store", { code, puts: [{ type: "trial", value: { id: "tx1", kind: "extra", mins: 45, teacher: "sarah", date: ONE, start: 780, name: "Walk In", email: "w@x.com", instrument: "Saxophone" } }] });
  assert.equal(r.body.results[0].ok, true); assert.equal(r.body.results[0].value.kind, "extra"); assert.equal(r.body.results[0].value.mins, 45);
  assert.ok(H.lastEmails().some((m) => /Extra lesson booked/.test(m.subject) && /45 minutes/.test(m.html + m.text)), "teacher hears it's an extra lesson");
  r = await call("POST", "/api/store", { code, puts: [{ type: "trial", value: { id: "tt1", teacher: "sarah", date: ONE, start: 720, mins: 60, name: "New Kid", email: "n@x.com", instrument: "Saxophone" } }] });
  assert.equal(r.body.results[0].value.kind, "trial"); assert.equal(r.body.results[0].value.mins, 30, "trials use the store length, whatever is sent");
  r = await call("POST", "/api/store", { code, puts: [{ type: "trial", value: { id: "tx2", kind: "extra", mins: 60, teacher: "sarah", date: ONE, start: 870, name: "Too Long", email: "t@x.com", instrument: "Saxophone" } }] });
  assert.equal(r.body.results[0].ok, false, "a 60-minute lesson at 2:30 runs past the 3 PM close");
  // A weekly block is open on its day too
  const wk = addDays(ONE, 1);
  r = await call("POST", "/api/store", { code, puts: [{ type: "trial", value: { id: "tt2", teacher: "sarah", date: wk, start: 600, name: "Weekly Kid", email: "k@x.com", instrument: "Saxophone" } }] });
  assert.equal(r.body.results[0].ok, true);
  // ...but a one-off date doesn't repeat a week later
  r = await call("POST", "/api/store", { code, puts: [{ type: "trial", value: { id: "tt3", teacher: "sarah", date: addDays(ONE, 7), start: 720, name: "Next Week", email: "q@x.com", instrument: "Saxophone" } }] });
  assert.equal(r.body.results[0].ok, false);
});

test("Google Calendar: connect, push the studio, and busy times block open slots", async () => {
  G.busy = [{ start: `${ONE}T19:15:00Z`, end: `${ONE}T19:45:00Z` }]; // 2:15-2:45 PM studio time
  let r = await route("GET", "/api/gcal/connect", undefined, sarah);
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get("location"));
  assert.match(loc.searchParams.get("scope"), /calendar\.app\.created/); assert.match(loc.searchParams.get("scope"), /calendar\.freebusy/);
  assert.equal(loc.searchParams.get("login_hint"), "sarah@x.com");
  r = await route("GET", `/api/gcal/callback?state=${encodeURIComponent(loc.searchParams.get("state"))}&code=sarah`, undefined, sarah);
  assert.equal(r.headers.get("location"), "/?gcal=connected");
  const titles = events().map((e) => e.summary);
  assert.ok(titles.some((t) => /^Extra lesson: Walk In/.test(t)), "store extra lesson is in Google");
  assert.ok(titles.some((t) => /^Get to Know: New Kid/.test(t)), "trial is in Google");
  assert.ok(events().some((e) => e.summary === "Open for extra lessons/trial lessons" && e.start.dateTime === `${ONE}T12:30:00` && e.transparency === "transparent"), "the open half hour between bookings shows");
  // Status for Sarah, busy times (only times) for the store
  const d = (await call("GET", "/api/data", null, sarah)).body;
  assert.equal(d.teachers.sarah.gcal.connected, true); assert.equal(d.teachers.sarah.gcal.account, "sarah@x.com");
  const s = (await call("GET", "/api/store?code=" + code)).body;
  assert.deepEqual(s.teachers.sarah.gbusy[ONE], [[855, 885]]);
  assert.equal(s.teachers.sarah.gcal, undefined, "the store never sees connection details");
  // The busy time in Google blocks a booking there
  r = await call("POST", "/api/store", { code, puts: [{ type: "trial", value: { id: "tt4", teacher: "sarah", date: ONE, start: 750, name: "Clash", email: "c@x.com", instrument: "Saxophone" } }] });
  assert.equal(r.body.results[0].ok, true, "12:30 is still open");
  assert.ok(await until(() => events().some((e) => /Clash/.test(e.summary)) && !events().some((e) => e.summary.startsWith("Open") && e.start.dateTime === `${ONE}T12:30:00`)), "a new booking replaces the open time in Google right away");
});

test("teachers can't save Google status into the database; disconnect removes the calendar", async () => {
  const d = (await call("GET", "/api/data", null, sarah)).body;
  const r = await call("POST", "/api/data", { puts: [{ type: "teacher", value: { ...d.teachers.sarah, name: "Sarah Griego" } }] }, sarah);
  assert.equal(r.body.results[0].value.gcal, undefined); assert.equal(r.body.results[0].value.gbusy, undefined);
  const out = await call("POST", "/api/gcal/disconnect", {}, sarah);
  assert.equal(out.body.gcal.connected, false);
  assert.equal(G.calendars.size, 0, "the Lesson Studio calendar is taken away");
  const s = (await call("GET", "/api/store?code=" + code)).body;
  assert.deepEqual(s.teachers.sarah.gbusy, {}, "busy times stop applying");
});

test("students and the store can't use Google Calendar endpoints", async () => {
  assert.equal((await call("POST", "/api/gcal/sync", {})).status, 403);
  assert.equal((await route("GET", "/api/gcal/connect")).headers.get("location"), "/?gcal=teachers");
});

test("busy times split across midnight in studio time", () => {
  const days = busyToDays([{ start: "2026-12-01T03:00:00Z", end: "2026-12-01T06:00:00Z" }]); // 10 PM - 1 AM EST
  assert.deepEqual(days, { "2026-11-30": [[1320, 1440]], "2026-12-01": [[0, 60]] });
});
