// Server tests: sign-in, who sees what, conflict-safe saves, emails, restore.
// Run with: npm test   (storage and Google are faked; nothing leaves this machine)
import test from "node:test";
import assert from "node:assert/strict";
import { setup, call, signIn } from "./harness.mjs";

const H = await setup();

test("signed-out visitors get the sign-in client ID", async () => {
  const r = await call("GET", "/api/auth");
  assert.equal(r.body.signedIn, false);
  assert.equal(r.body.clientId, "test-client");
});

test("someone not on the roster is turned away", async () => {
  const r = await call("POST", "/api/auth", { credential: "stranger@x.com" });
  assert.equal(r.status, 403);
  assert.equal(r.body.error, "not_on_roster");
});

let sarah, mitch;
test("teachers sign in and get the seeded studio", async () => {
  sarah = await signIn("sarah@x.com");
  mitch = await signIn("mitch@x.com");
  const d = (await call("GET", "/api/data", null, sarah)).body;
  assert.equal(d.me.role, "teacher"); assert.equal(d.me.owner, true);
  assert.deepEqual(d.teachers.sarah.rates, { 30: 40, 60: 70 });
  assert.deepEqual(d.teachers.mitchell.rates, { 30: 30, 60: 50 });
  assert.equal(d.teachers.sarah.zelle, "(505) 999-0671");
});

const maya = { id: "s_maya", name: "Maya Chen", teacher: "sarah", instrument: "Alto sax", email: "maya@x.com", guardianEmail: "mom@x.com", regular: { dow: 1, start: 990, mins: 60 }, rate: 70, grid: {}, rep: [],
  lessons: [{ id: "l1", date: "2026-11-02", amount: 0, status: "paid", method: "free" }, { id: "l2", date: "2026-11-09", amount: 70, status: "unpaid" }] };
const ava = { id: "s_ava", name: "Ava Brooks", teacher: "mitchell", instrument: "Trumpet", email: "ava@x.com", regular: { dow: 1, start: 900, mins: 30 }, rate: 30, grid: {}, rep: [], lessons: [] };

test("teachers add their own students; conflicts are caught", async () => {
  let r = await call("POST", "/api/data", { puts: [{ type: "student", value: maya }] }, sarah);
  assert.equal(r.body.results[0].ok, true); assert.equal(r.body.results[0].value.rev, 1);
  r = await call("POST", "/api/data", { puts: [{ type: "student", value: ava }] }, mitch);
  assert.equal(r.body.results[0].ok, true);
  // an edit based on an old copy is refused and the saved copy comes back
  r = await call("POST", "/api/data", { puts: [{ type: "student", value: { ...maya, instrument: "Tenor" } }] }, sarah);
  assert.equal(r.body.results[0].ok, false); assert.equal(r.body.results[0].error, "conflict"); assert.equal(r.body.results[0].value.rev, 1);
  // Mitchell can't touch Sarah's student
  r = await call("POST", "/api/data", { puts: [{ type: "student", value: { ...maya, rev: 1, instrument: "Trumpet" } }] }, mitch);
  assert.equal(r.body.results[0].ok, false);
});

test("Mitchell only sees his own students", async () => {
  const d = (await call("GET", "/api/data", null, mitch)).body;
  assert.deepEqual(d.students.map((s) => s.id), ["s_ava"]);
  assert.equal(d.teachers.sarah.email, undefined, "other teacher's private settings hidden");
});

let mayaC, momC;
test("students (and parents) sign in and see only their own record", async () => {
  mayaC = await signIn("maya@x.com"); momC = await signIn("mom@x.com");
  const d = (await call("GET", "/api/data", null, mayaC)).body;
  assert.equal(d.me.role, "student"); assert.equal(d.me.id, "s_maya");
  assert.equal(d.students[0].id, "s_maya");
  assert.ok(d.students.slice(1).every((s) => s.anon && !s.name && !s.email), "other students are anonymous busy times only");
  assert.deepEqual(Object.keys(d.teachers), ["sarah"]);
  assert.equal((await call("GET", "/api/data", null, momC)).body.me.id, "s_maya");
});

test("a student can request an extra lesson and report a payment, nothing else", async () => {
  const st = (await call("GET", "/api/data", null, sarah)).body.teachers.sarah;
  await call("POST", "/api/data", { puts: [{ type: "teacher", value: { ...st, open: [{ dow: 0, start: 540, end: 780 }] } }] }, sarah);
  H.lastEmails();
  let r = await call("POST", "/api/data", { puts: [{ type: "request", value: { id: "q1", studentId: "s_maya", teacher: "mitchell", date: "2099-01-05", start: 600, mins: 60, note: "Scale test prep", status: "accepted" } }] }, mayaC);
  assert.equal(r.body.results[0].ok, true);
  assert.equal(r.body.results[0].value.status, "pending", "students can't approve their own request");
  assert.equal(r.body.results[0].value.teacher, "sarah", "always goes to their own teacher");
  assert.equal(r.body.mail.sent, 1); assert.ok(H.lastEmails().some((m) => m.to.includes("sarah@x.com") && /Maya Chen/.test(m.subject)), "Sarah gets an email");
  const me = (await call("GET", "/api/data", null, mayaC)).body.students[0];
  const tampered = { ...me, rate: 1, grid: { g0r0: { 0: { s: "p", d: "2026-01-01" } } }, lessons: me.lessons.map((l) => (l.id === "l2" ? { ...l, status: "reported", method: "zelle", amount: 1 } : { ...l, status: "paid" })) };
  r = await call("POST", "/api/data", { puts: [{ type: "student", value: tampered }] }, mayaC);
  const saved = r.body.results[0].value;
  assert.equal(saved.rate, 70); assert.deepEqual(saved.grid, {});
  assert.equal(saved.lessons.find((l) => l.id === "l2").status, "reported");
  assert.equal(saved.lessons.find((l) => l.id === "l2").amount, 70);
  // can't edit someone else's request or approve via teacher fields
  r = await call("POST", "/api/data", { puts: [{ type: "session", key: "s_maya|2099-01-05", value: { mode: "remote" } }] }, mayaC);
  assert.equal(r.body.results[0].ok, false);
});

test("teacher answers the request; emails are composed for student and parent", async () => {
  const d = (await call("GET", "/api/data", null, sarah)).body;
  const q = d.requests.find((x) => x.id === "q1");
  const r = await call("POST", "/api/data", { puts: [{ type: "request", value: { ...q, status: "accepted", reply: "See you then!" } }] }, sarah);
  assert.equal(r.body.results[0].ok, true);
  const sent = H.lastEmails();
  assert.ok(sent.some((m) => m.to.includes("maya@x.com") && m.to.includes("mom@x.com") && /confirmed/i.test(m.subject)));
});

test("away dates email students who lose a lesson", async () => {
  const d = (await call("GET", "/api/data", null, sarah)).body;
  const t = d.teachers.sarah;
  const r = await call("POST", "/api/data", { puts: [{ type: "teacher", value: { ...t, away: [{ id: "a1", from: "2099-01-05", to: "2099-01-06", note: "Clinic" }] } }] }, sarah);
  assert.equal(r.body.results[0].ok, true);
  const m = H.lastEmails().find((x) => /away/i.test(x.subject));
  assert.ok(m && m.to.includes("maya@x.com"), "Maya has Mondays; Jan 5 2099 is a Monday");
});

test("a failed read never saves over real data", async () => {
  H.failReads(true);
  const r = await call("POST", "/api/data", { puts: [{ type: "student", value: { ...ava, id: "s_x" } }] }, sarah);
  H.failReads(false);
  assert.equal(r.status, 503);
  const d = (await call("GET", "/api/data", null, sarah)).body;
  assert.ok(d.students.some((s) => s.id === "s_maya"), "data intact");
  assert.ok(!d.students.some((s) => s.id === "s_x"));
});

test("two saves at the same moment both land", async () => {
  const d = (await call("GET", "/api/data", null, sarah)).body;
  const m1 = d.students.find((s) => s.id === "s_maya");
  const [a, b] = await Promise.all([
    call("POST", "/api/data", { puts: [{ type: "student", value: { ...m1, instrument: "Soprano sax" } }] }, sarah),
    call("POST", "/api/data", { puts: [{ type: "student", value: { ...ava, id: "s_new", teacher: "mitchell", name: "New Kid", email: "newkid@x.com" } }] }, mitch),
  ]);
  assert.equal(a.body.results[0].ok, true); assert.equal(b.body.results[0].ok, true);
  const after = (await call("GET", "/api/data", null, sarah)).body;
  assert.equal(after.students.find((s) => s.id === "s_maya").instrument, "Soprano sax");
  assert.ok(after.students.some((s) => s.id === "s_new"));
});

test("removing a student ends their sign-in", async () => {
  const d = (await call("GET", "/api/data", null, mitch)).body;
  const s = d.students.find((x) => x.id === "s_ava");
  await call("POST", "/api/data", { puts: [{ type: "student", value: { ...s, archived: true } }] }, mitch);
  const avaC = await signIn("ava@x.com").catch((e) => e);
  assert.ok(avaC instanceof Error);
});

test("backups: Sarah only, and a test-copy backup can't be restored", async () => {
  assert.equal((await call("GET", "/api/data?backup=1", null, mitch)).status, 403);
  const b = (await call("GET", "/api/data?backup=1", null, sarah)).body;
  assert.equal(b.app, "sg-lessons"); assert.equal(b.origin, "real");
  let r = await call("POST", "/api/data", { restore: { ...b, origin: "demo" } }, sarah);
  assert.equal(r.status, 400);
  r = await call("POST", "/api/data", { restore: b }, sarah);
  assert.equal(r.body.ok, true);
  assert.ok(H.backupKeys().some((k) => k.startsWith("before-restore/")), "copy saved before restoring");
});

test("Classroom connect is Sarah only and goes to Google with read-only scopes", async () => {
  let r = await call("GET", "/api/classroom/connect", null, mitch);
  assert.equal(r.status, 302); assert.match(r.headers.get("location"), /gc=owner/);
  r = await call("GET", "/api/classroom/connect", null, sarah);
  const loc = r.headers.get("location");
  assert.match(loc, /^https:\/\/accounts\.google\.com/);
  const scopes = new URL(loc).searchParams.get("scope");
  assert.ok(scopes.split(" ").filter((s) => s.includes("classroom")).every((s) => s.endsWith(".readonly") || s.endsWith("profile.emails")), scopes);
});
