// Get to Know sessions through the music store, the 24-hour cancel rule, remote
// switching, and calendar feeds.
import test from "node:test";
import assert from "node:assert/strict";
import { setup, call, signIn, route } from "./harness.mjs";
import { todayISO, addDays, dowOf, nowMinNY } from "../netlify/lib/util.mjs";

const H = await setup();
let sarah, kid, code, db;
const FAR = "2099-01-05"; // a Monday, far away

test("setup: Sarah, open times, two students", async () => {
  sarah = await signIn("sarah@x.com");
  db = (await call("GET", "/api/data", null, sarah)).body;
  code = db.store.code;
  assert.equal(db.store.name, "Rhapsody Music");
  assert.ok(code && code.length >= 6);
  assert.ok(db.teachers.sarah.calToken, "teacher calendar link exists");
  const t = db.teachers.sarah;
  // Within 24 hours: tomorrow, an hour earlier than now (or today, an hour from now just after midnight)
  const now = nowMinNY(), soonDate = now >= 60 ? addDays(todayISO(), 1) : todayISO(), soonStart = now >= 60 ? now - 60 - ((now - 60) % 15) : now + 60;
  const r = await call("POST", "/api/data", { puts: [
    { type: "teacher", value: { ...t, open: [{ dow: 0, start: 540, end: 780 }, { dow: 4, start: 540, end: 720 }] } },
    { type: "student", value: { id: "s_far", name: "Kid Far", teacher: "sarah", email: "far@x.com", regular: { dow: 0, start: 1020, mins: 60 }, rate: 70, grid: {}, rep: [], lessons: [] } },
    { type: "student", value: { id: "s_soon", name: "Kid Soon", teacher: "sarah", email: "soon@x.com", regular: { dow: dowOf(soonDate), start: soonStart, mins: 30 }, rate: 40, grid: {}, rep: [], lessons: [], _soonDate: soonDate } },
  ] }, sarah);
  assert.ok(r.body.results.every((x) => x.ok), JSON.stringify(r.body.results));
});

test("the store link works only with the right code and shows no students", async () => {
  assert.equal((await call("GET", "/api/store?code=wrong")).status, 404);
  const v = (await call("GET", "/api/store?code=" + code)).body;
  assert.equal(v.me.role, "store");
  assert.ok(v.students.every((s) => s.anon && !s.name && !s.email));
  assert.equal(v.teachers.sarah.zelle, undefined, "no payment details");
  assert.equal(v.teachers.sarah.calToken, undefined);
});

test("the store books a Get to Know session; taken or closed times are refused", async () => {
  let r = await call("POST", "/api/store", { code, puts: [{ type: "trial", value: { id: "t1", teacher: "sarah", date: FAR, start: 600, name: "Ella R", email: "rosa@x.com", guardian: "Rosa R", instrument: "Saxophone", bookedBy: "Jake", status: "accepted" } }] });
  assert.equal(r.body.results[0].ok, true);
  assert.equal(r.body.results[0].value.status, "pending", "always waits for the teacher");
  assert.equal(r.body.results[0].value.mins, 30);
  assert.ok(H.lastEmails().some((m) => m.to.includes("sarah@x.com") && /Get to Know session booked/.test(m.subject)));
  r = await call("POST", "/api/store", { code, puts: [{ type: "trial", value: { id: "t2", teacher: "sarah", date: FAR, start: 615, name: "Clash", email: "c@x.com" } }] });
  assert.equal(r.body.results[0].ok, false, "overlaps the first booking");
  r = await call("POST", "/api/store", { code, puts: [{ type: "trial", value: { id: "t3", teacher: "sarah", date: FAR, start: 1020, name: "Late", email: "l@x.com" } }] });
  assert.equal(r.body.results[0].ok, false, "outside open times (and Kid Far's lesson)");
  r = await call("POST", "/api/store", { code: "wrong", puts: [{ type: "trial", value: { id: "t4", teacher: "sarah", date: FAR, start: 660, name: "X", email: "x@x.com" } }] });
  assert.equal(r.status, 404);
});

test("Sarah confirms; the family (and the store, if it has an email) gets a calendar link", async () => {
  const d = (await call("GET", "/api/data", null, sarah)).body;
  await call("POST", "/api/data", { puts: [{ type: "store", value: { ...d.store, email: "desk@rhapsody.test" } }] }, sarah);
  const x = d.trials.find((t) => t.id === "t1");
  const r = await call("POST", "/api/data", { puts: [{ type: "trial", value: { ...x, status: "accepted", reply: "See you!" } }] }, sarah);
  assert.equal(r.body.results[0].ok, true);
  const m = H.lastEmails().find((e) => /Confirmed/.test(e.subject));
  assert.ok(m && m.to.includes("rosa@x.com") && m.to.includes("desk@rhapsody.test"));
  assert.match(m.html, /calendar\.google\.com\/calendar\/render\?action=TEMPLATE/);
  assert.doesNotMatch(m.html, /Open the Lesson Studio/, "families have no login, so no studio button");
});

test("a student cancels 24+ hours out, can undo, and can't cancel inside 24 hours", async () => {
  const far = await signIn("far@x.com"), soon = await signIn("soon@x.com");
  const key = "s_far|" + FAR;
  let r = await call("POST", "/api/data", { puts: [{ type: "session", key, value: { mode: "cancelled" } }] }, far);
  assert.equal(r.body.results[0].ok, true); assert.equal(r.body.results[0].value.by, "student");
  assert.ok(H.lastEmails().some((m) => m.to.includes("sarah@x.com") && /cancelled/.test(m.subject)));
  r = await call("POST", "/api/data", { puts: [{ type: "session", key, value: null }] }, far);
  assert.equal(r.body.results[0].ok, true, "undo while still 24+ hours away");
  const me = (await call("GET", "/api/data", null, soon)).body.students[0];
  const sk = "s_soon|" + me._soonDate;
  r = await call("POST", "/api/data", { puts: [{ type: "session", key: sk, value: { mode: "cancelled" } }] }, soon);
  assert.equal(r.body.results[0].ok, false); assert.match(r.body.results[0].error, /24 hours/);
  r = await call("POST", "/api/data", { puts: [{ type: "session", key: sk, value: { mode: "remote" } }] }, soon);
  assert.equal(r.body.results[0].ok, true, "switching to remote is still allowed");
  assert.ok(H.lastEmails().some((m) => /switched/.test(m.subject)));
  r = await call("POST", "/api/data", { puts: [{ type: "session", key: "s_far|" + FAR, value: { mode: "cancelled" } }] }, soon);
  assert.equal(r.body.results[0].ok, false, "can't touch someone else's lesson");
});

test("calendar feeds: student sees their lessons, teacher sees lessons and Get to Know sessions", async () => {
  const d = (await call("GET", "/api/data", null, sarah)).body;
  const st = d.students.find((s) => s.id === "s_far");
  let r = await call("GET", `/api/calendar/${st.calToken}.ics`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/calendar/);
  const ics = await (await route("GET", `/api/calendar/${st.calToken}.ics`)).text();
  assert.match(ics, /BEGIN:VCALENDAR/); assert.match(ics, /Lesson with Sarah Griego/); assert.doesNotMatch(ics, /Kid Soon/);
  const tics = await (await route("GET", `/api/calendar/${d.teachers.sarah.calToken}.ics`)).text();
  assert.match(tics, /Get to Know: Ella R/); assert.match(tics, /Kid Far · lesson/);
  assert.equal((await call("GET", "/api/calendar/nope.ics")).status, 404);
});

test("a new store link turns the old one off", async () => {
  const d = (await call("GET", "/api/data", null, sarah)).body;
  await call("POST", "/api/data", { puts: [{ type: "store", value: { ...d.store, code: "newcode12345" } }] }, sarah);
  assert.equal((await call("GET", "/api/store?code=" + code)).status, 404);
  assert.equal((await call("GET", "/api/store?code=newcode12345")).status, 200);
  const m = await signIn("mitch@x.com");
  const md = (await call("GET", "/api/data", null, m)).body;
  const r = await call("POST", "/api/data", { puts: [{ type: "store", value: { ...md.store, code: "mitchcode1234" } }] }, m);
  assert.equal(r.body.results[0].ok, false, "only Sarah manages the store link");
});
