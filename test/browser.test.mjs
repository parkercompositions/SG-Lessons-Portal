// Browser tests: the real page and app.js in a simulated browser, saving through the
// real functions (with in-memory storage). Covers the teacher and student sides.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { setup, call, signIn, route } from "./harness.mjs";

const H = await setup();
const html = fs.readFileSync(new URL("../site/index.html", import.meta.url), "utf8")
  .replace(/<script src="https:\/\/accounts\.google\.com[^>]*><\/script>/, "")
  .replace('<script src="/app.js"></script>', "<script>" + fs.readFileSync(new URL("../site/app.js", import.meta.url), "utf8") + "</script>");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const opened = [];
test.after(() => opened.forEach((w) => w.close()));

async function open(cookie, path = "/") {
  const errors = [];
  const dom = new JSDOM(html, { url: "https://lessons.test" + path, runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addEventListener() {} });
      w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {};
      w.fetch = async (url, opts = {}) => {
        const res = await route(opts.method || "GET", String(url).replace("https://lessons.test", ""), opts.body, cookie);
        const text = await res.text();
        return { ok: res.ok, status: res.status, json: async () => JSON.parse(text) };
      };
      w.addEventListener("error", (e) => errors.push(e.message));
    } });
  opened.push(dom.window);
  await wait(300);
  const w = dom.window, d = w.document, $ = (s) => d.querySelector(s);
  const click = (el) => { if (!el) throw new Error("missing element"); el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); };
  const submit = (f) => f.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  const change = (el) => el.dispatchEvent(new w.Event("change", { bubbles: true }));
  const nav = (k) => { if (!$(".menu-panel")) click($("[data-menu]")); click($(`.menu-panel [data-nav="${k}"]`)); };
  return { w, d, $, click, submit, change, nav, errors, settle: () => wait(700) };
}
const server = async (cookie) => (await call("GET", "/api/data", null, cookie)).body;

let sarah;
test("signed out: the sign-in screen shows", async () => {
  const p = await open(null);
  assert.equal(p.$("#gate").hidden, false);
  assert.equal(p.$("#appRoot").hidden, true);
});

test("Sarah: empty studio, add a student, mark scales, log the free first lesson", async () => {
  sarah = await signIn("sarah@x.com");
  const p = await open(sarah);
  assert.equal(p.$("#appRoot").hidden, false);
  assert.match(p.$("#whereEm").textContent, /Sarah's studio/);
  p.click(p.$('[data-act="addStudent"]'));
  p.$("#nn").value = "Maya Chen"; p.$("#ne").value = "maya@x.com"; p.$("#nday").value = "1"; p.$("#ntime").value = "16:30"; p.$("#nmins").value = "60";
  p.submit(p.$('form[data-form="newStudent"]'));
  await p.settle();
  let db = await server(sarah);
  const m = db.students.find((s) => s.name === "Maya Chen");
  assert.ok(m, "student saved"); assert.equal(m.rate, 70); assert.equal(m.regular.start, 990);
  // scale grid: two taps = passed
  const cell = () => p.$('[data-cell="g0r0|0"]');
  p.click(cell()); p.click(cell());
  await p.settle();
  db = await server(sarah);
  assert.equal(db.students[0].grid.g0r0[0].s, "p");
  // first lesson is free
  p.click(p.$('[data-tab="lessons"]')); p.click(p.$('[data-act="openLesson"]'));
  assert.equal(p.$("#la").value, "0");
  p.submit(p.$('form[data-form="lesson"]'));
  await p.settle();
  db = await server(sarah);
  assert.equal(db.students[0].lessons[0].method, "free");
  // second lesson is charged
  p.click(p.$('[data-act="openLesson"]')); assert.equal(p.$("#la").value, "70");
  p.submit(p.$('form[data-form="lesson"]'));
  await p.settle();
  db = await server(sarah);
  assert.equal(db.students[0].lessons.filter((l) => l.status === "unpaid").length, 1);
  assert.match(p.$("#save").textContent, /Saved/);
  assert.deepEqual(p.errors, []);
});

test("Sarah: open times and an away date save to her settings", async () => {
  const p = await open(sarah);
  p.nav("schedule");
  const f = p.$('form[data-form="open"]');
  f.querySelector("[name=day]").value = "4"; f.querySelector("[name=start]").value = "09:00"; f.querySelector("[name=end]").value = "12:00";
  p.submit(f);
  await p.settle();
  const db = await server(sarah);
  assert.deepEqual(db.teachers.sarah.open, [{ dow: 4, start: 540, end: 720 }]);
  assert.deepEqual(p.errors, []);
});

test("Maya: dashboard, pay, request an extra lesson", async () => {
  const mc = await signIn("maya@x.com");
  const p = await open(mc);
  assert.match(p.$("#whereEm").textContent, /Maya's lessons/);
  assert.ok(p.$(".balance.due"), "owes for the second lesson");
  p.click(p.$('[data-act="openPay"]')); p.click(p.$('[data-method="paypal"]'));
  assert.match(p.$('a.btn[href*="paypal.com"]').href, /business=UWH7E6XQGNUZU&amount=70/);
  p.click(p.$('[data-method="zelle"]')); assert.equal(p.$(".copyline code").textContent, "(505) 999-0671");
  p.click(p.$('[data-act="reportPaid"]'));
  await p.settle();
  let db = await server(sarah);
  assert.equal(db.students[0].lessons.find((l) => l.status === "reported").method, "zelle");
  assert.ok(H.lastEmails().some((e) => e.to.includes("sarah@x.com") && /sent \$70/.test(e.subject)), "Sarah is emailed");
  // extra lesson: next week's Friday open block
  p.nav("calendar"); p.click(p.$('[data-week="7"]'));
  const free = p.$(".cal .ev-free");
  assert.ok(free, "open time shows");
  p.click(free); p.submit(p.$('form[data-form="request"]'));
  await p.settle();
  db = await server(sarah);
  assert.equal(db.requests.length, 1); assert.equal(db.requests[0].status, "pending");
  assert.deepEqual(p.errors, []);
});

test("Sarah: accept the request; view Maya's portal without saving anything", async () => {
  const p = await open(sarah);
  p.nav("schedule");
  p.click(p.$("[data-accept]"));
  await p.settle();
  let db = await server(sarah);
  assert.equal(db.requests[0].status, "accepted");
  assert.ok(H.lastEmails().some((e) => e.to.includes("maya@x.com") && /confirmed/i.test(e.subject)));
  p.nav("students"); p.click(p.$("[data-open]")); p.click(p.$("[data-viewas]"));
  assert.equal(p.$("#viewas").hidden, false);
  assert.match(p.$("#whereEm").textContent, /Viewing as/);
  p.click(p.$("[data-viewexit]"));
  await p.settle();
  assert.equal(p.$("#viewas").hidden, true);
  assert.deepEqual(p.errors, []);
});

test("Mitchell sees an empty roster of his own", async () => {
  const mc = await signIn("mitch@x.com");
  const p = await open(mc);
  assert.match(p.$("#whereEm").textContent, /Mitchell's studio/);
  assert.equal(p.d.querySelectorAll(".srow").length, 0);
  assert.deepEqual(p.errors, []);
});

test("Rhapsody's private page books a Get to Know session", async () => {
  const code = (await server(sarah)).store.code;
  const bad = await open(null, "/store/nope");
  assert.equal(bad.$("#gate").hidden, false, "a wrong link shows a message, not the studio");
  const p = await open(null, "/store/" + code);
  assert.equal(p.$("#appRoot").hidden, false);
  assert.match(p.$(".hero h1").textContent, /Get to Know/);
  assert.equal(p.$("#whereEm").textContent, "Rhapsody Music");
  assert.ok(!p.$("#app").textContent.includes("Maya"), "no student names");
  p.click(p.$('[data-week="7"]'));
  p.click(p.$(".cal .ev-free"));
  const f = p.$('form[data-form="trial"]');
  f.querySelector("[name=name]").value = "Ella Ramirez"; f.querySelector("[name=email]").value = "rosa@x.com"; f.querySelector("[name=bookedBy]").value = "Jake";
  p.submit(f);
  await p.settle();
  const db = await server(sarah);
  assert.equal(db.trials.length, 1); assert.equal(db.trials[0].status, "pending"); assert.equal(db.trials[0].bookedBy, "Jake");
  assert.ok(H.lastEmails().some((e) => e.to.includes("sarah@x.com") && /Get to Know/.test(e.subject)));
  p.nav("booked");
  assert.match(p.$("#app").textContent, /Ella Ramirez/);
  assert.deepEqual(p.errors, []);
});

test("Sarah confirms the session and adds Ella to the roster", async () => {
  const p = await open(sarah);
  p.nav("schedule");
  p.click(p.$("[data-taccept]"));
  await p.settle();
  let db = await server(sarah);
  assert.equal(db.trials[0].status, "accepted");
  assert.ok(H.lastEmails().some((e) => e.to.includes("rosa@x.com") && /Confirmed/.test(e.subject)));
  p.click(p.$('[data-week="7"]')); p.click(p.$(".cal .ev-trial")); p.click(p.$("[data-tenroll]"));
  await p.settle();
  db = await server(sarah);
  const ella = db.students.find((s) => s.name === "Ella Ramirez");
  assert.ok(ella); assert.equal(ella.lessons[0].method, "free");
  assert.equal(db.trials[0].status, "enrolled");
  assert.deepEqual(p.errors, []);
});

test("Maya cancels a lesson more than 24 hours out, then switches another to remote", async () => {
  const mc = await signIn("maya@x.com");
  const p = await open(mc);
  p.nav("calendar"); p.click(p.$('[data-week="7"]'));
  p.click(p.$(".cal .ev-lesson")); p.click(p.$("[data-scancel]")); p.click(p.$("[data-scancel]"));
  await p.settle();
  let db = await server(sarah);
  const k = Object.keys(db.sessions).find((x) => x.startsWith(db.students.find((s) => s.name === "Maya Chen").id));
  assert.equal(db.sessions[k].mode, "cancelled"); assert.equal(db.sessions[k].by, "student");
  p.click(p.$('[data-week="7"]'));
  p.click(p.$(".cal .ev-lesson")); p.click(p.$("[data-sremote]"));
  await p.settle();
  db = await server(sarah);
  assert.ok(Object.values(db.sessions).some((v) => v.mode === "remote" && v.by === "student"));
  assert.ok(p.$(".calapps a"), "subscribe links show");
  assert.match(p.$(".calapps a").href, /calendar\.google\.com/);
  assert.deepEqual(p.errors, []);
});
