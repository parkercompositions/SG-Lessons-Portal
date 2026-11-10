// Applies a batch of changes from the browser to the database, enforcing who may
// change what. Each record carries a "rev"; a change based on an older rev than the
// one saved is refused as a conflict and the saved copy is sent back instead, so two
// people editing the same student can't silently undo each other.
//
// Roles: teacher (Sarah owns everything, Mitchell his own), student (or parent),
// and store (Rhapsody Music, through its private link).
import { todayISO, addDays, rid, occurs, hoursUntil, dowOf } from "./util.mjs";

const str = (v, max = 2000) => String(v == null ? "" : v).slice(0, max);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const LIVE = ["pending", "accepted", "logged"];
const TLIVE = ["pending", "accepted", "enrolled"];

const awayOn = (db, tid, date) => (db.teachers[tid].away || []).some((a) => date >= a.from && date <= a.to);

// Is [start, start+mins) inside one of the teacher's open blocks and clear of everything booked?
export function slotFree(db, tid, date, start, mins, ignoreId) {
  if (awayOn(db, tid, date)) return false;
  const end = start + mins;
  if (!(db.teachers[tid].open || []).some((b) => b.dow === dowOf(date) && start >= b.start && end <= b.end)) return false;
  const busy = [];
  db.students.filter((s) => !s.archived && s.teacher === tid && occurs(s, date) && (db.sessions[s.id + "|" + date] || {}).mode !== "cancelled")
    .forEach((s) => busy.push([s.regular.start, s.regular.start + s.regular.mins]));
  db.requests.filter((r) => r.teacher === tid && r.date === date && LIVE.includes(r.status) && r.id !== ignoreId).forEach((r) => busy.push([r.start, r.start + r.mins]));
  db.trials.filter((x) => x.teacher === tid && x.date === date && TLIVE.includes(x.status) && x.id !== ignoreId).forEach((x) => busy.push([x.start, x.start + x.mins]));
  return !busy.some(([a, b]) => start < b && end > a);
}

export function applyPuts(db, puts, who) {
  const results = [];
  const ok = (type, id, value) => results.push({ type, id, ok: true, value });
  const no = (type, id, error, value) => results.push({ type, id, ok: false, error, value });
  const canTeach = (teacherId) => who.owner || teacherId === who.id;

  for (const p of (Array.isArray(puts) ? puts : []).slice(0, 200)) {
    try {
      if (who.role === "teacher") teacherPut(p);
      else if (who.role === "student") studentPut(p);
      else if (who.role === "store") storePut(p);
      else no(p.type, p.id, "Not signed in");
    } catch (e) { no(p.type, p.id || (p.value && p.value.id), e.message); }
  }
  return results;

  function revCheck(type, id, stored, value) {
    if (stored && (value.rev || 0) !== (stored.rev || 0)) { no(type, id, "conflict", stored); return false; }
    return true;
  }

  // ---------------- teachers ----------------
  function teacherPut(p) {
    const v = p.value;
    if (p.type === "teacher") {
      const stored = db.teachers[v && v.id];
      if (!stored) return no("teacher", v && v.id, "Unknown teacher");
      if (!canTeach(v.id)) return no("teacher", v.id, "Not allowed");
      if (!revCheck("teacher", v.id, stored, v)) return;
      const { photo, bio, teaches, photoCredit, ...clean } = v; // bios live in the page, not the database
      const next = { ...clean, id: stored.id, owner: stored.owner, calToken: stored.calToken, rev: (stored.rev || 0) + 1 };
      db.teachers[v.id] = next; return ok("teacher", v.id, next);
    }
    if (p.type === "student") {
      if (!v || !v.id || typeof v.id !== "string") return no("student", null, "Missing id");
      const i = db.students.findIndex((s) => s.id === v.id), stored = i >= 0 ? db.students[i] : null;
      if (stored && !canTeach(stored.teacher)) return no("student", v.id, "Not allowed");
      if (!db.teachers[v.teacher] || !canTeach(v.teacher)) return no("student", v.id, "Not allowed");
      if (!revCheck("student", v.id, stored, v)) return;
      const next = { ...v, calToken: (stored && stored.calToken) || rid("c"), rev: ((stored && stored.rev) || 0) + 1 };
      if (i >= 0) db.students[i] = next; else db.students.push(next);
      return ok("student", v.id, next);
    }
    if (p.type === "request" || p.type === "trial") {
      const list = p.type === "request" ? db.requests : db.trials;
      if (!v || !v.id) return no(p.type, null, "Missing id");
      const i = list.findIndex((r) => r.id === v.id), stored = i >= 0 ? list[i] : null;
      if (!canTeach(stored ? stored.teacher : v.teacher)) return no(p.type, v.id, "Not allowed");
      if (!revCheck(p.type, v.id, stored, v)) return;
      const next = { ...v, rev: ((stored && stored.rev) || 0) + 1 };
      if (i >= 0) list[i] = next; else list.push(next);
      return ok(p.type, v.id, next);
    }
    if (p.type === "delRequest") {
      const i = db.requests.findIndex((r) => r.id === p.id);
      if (i < 0) return ok("delRequest", p.id, null);
      if (!canTeach(db.requests[i].teacher)) return no("delRequest", p.id, "Not allowed");
      db.requests.splice(i, 1); return ok("delRequest", p.id, null);
    }
    if (p.type === "session") {
      const sid = String(p.key || "").split("|")[0], s = db.students.find((x) => x.id === sid);
      if (!s || !canTeach(s.teacher)) return no("session", p.key, "Not allowed");
      if (p.value) {
        const mode = ["remote", "cancelled"].includes(p.value.mode) ? p.value.mode : "inperson";
        db.sessions[p.key] = { mode, link: str(p.value.link, 500), by: str(p.value.by, 20) || "teacher", at: +p.value.at || Date.now(), reason: str(p.value.reason, 300) };
      } else delete db.sessions[p.key];
      return ok("session", p.key, db.sessions[p.key] || null);
    }
    if (p.type === "classMap") {
      if (!who.owner) return no("classMap", p.courseId, "Only Sarah can change this");
      if (!db.teachers[p.teacher]) return no("classMap", p.courseId, "Unknown teacher");
      db.classMap[str(p.courseId, 100)] = p.teacher; return ok("classMap", p.courseId, p.teacher);
    }
    if (p.type === "store") {
      if (!who.owner) return no("store", "store", "Only Sarah can change the store portal");
      if (!revCheck("store", "store", db.store, v || {})) return;
      db.store = { name: str(v.name, 80) || db.store.name, email: str(v.email, 200), trialMins: [30, 60].includes(+v.trialMins) ? +v.trialMins : 30,
        code: /^[a-z0-9]{6,40}$/i.test(String(v.code || "")) ? v.code : db.store.code, rev: (db.store.rev || 0) + 1 };
      return ok("store", "store", db.store);
    }
    no(p.type, p.id, "Unknown change");
  }

  // ---------------- students (and parents) ----------------
  function studentPut(p) {
    const me = db.students.find((s) => s.id === who.id);
    if (!me) return no(p.type, p.id, "Not on the roster");
    if (p.type === "request") {
      const v = p.value || {};
      const stored = db.requests.find((r) => r.id === v.id);
      if (stored) {
        // Their own confirmed extra lesson: cancel (24+ hours out) or switch to remote.
        if (stored.studentId !== me.id) return no("request", v.id, "Not allowed");
        const h = hoursUntil(stored.date, stored.start);
        if (v.status === "cancelled" && stored.status !== "cancelled") {
          if (!["accepted", "logged"].includes(stored.status) && stored.status !== "pending") return no("request", v.id, "Can't cancel this", stored);
          if (h < 24) return no("request", v.id, "It's less than 24 hours away. Switch to remote or reach out directly.", stored);
          stored.status = "cancelled"; stored.cancelledBy = "student"; stored.rev = (stored.rev || 0) + 1;
        } else if (v.mode === "remote" && stored.mode !== "remote") {
          if (h <= 0) return no("request", v.id, "That lesson has already started", stored);
          stored.mode = "remote"; stored.rev = (stored.rev || 0) + 1;
        }
        return ok("request", stored.id, stored);
      }
      const today = todayISO();
      if (!isDate(v.date) || v.date < addDays(today, -1)) return no("request", v.id, "Pick a date that hasn't passed");
      const mins = [30, 60].includes(+v.mins) ? +v.mins : 30, start = Math.max(0, Math.min(1410, Math.round(+v.start || 0)));
      if (!slotFree(db, me.teacher, v.date, start, mins)) return no("request", v.id, "That time was just taken. Pick another open time.");
      const next = { id: str(v.id, 60), studentId: me.id, teacher: me.teacher, date: v.date, start, mins, note: str(v.note, 500), status: "pending", rev: 1, createdAt: Date.now() };
      db.requests.push(next); return ok("request", next.id, next);
    }
    if (p.type === "delRequest") {
      const i = db.requests.findIndex((r) => r.id === p.id);
      if (i < 0) return ok("delRequest", p.id, null);
      const r = db.requests[i];
      if (r.studentId !== me.id || r.status !== "pending") return no("delRequest", p.id, "Only a request still waiting can be cancelled", r);
      db.requests.splice(i, 1); return ok("delRequest", p.id, null);
    }
    if (p.type === "session") {
      // Their own regular lesson: cancel 24+ hours out, undo that, or switch to remote.
      const [sid, date] = String(p.key || "").split("|");
      if (sid !== me.id || !isDate(date) || !occurs(me, date) || awayOn(db, me.teacher, date)) return no("session", p.key, "Not allowed");
      const stored = db.sessions[p.key], h = hoursUntil(date, me.regular.start), v = p.value;
      if (!v) {
        if (!stored || stored.mode !== "cancelled" || stored.by !== "student") return no("session", p.key, "Not allowed", stored || null);
        if (h < 24) return no("session", p.key, "It's less than 24 hours away now. Reach out directly.", stored);
        delete db.sessions[p.key]; return ok("session", p.key, null);
      }
      if (v.mode === "cancelled") {
        if (stored && stored.mode === "cancelled") return ok("session", p.key, stored);
        if (h < 24) return no("session", p.key, "It's less than 24 hours away. Switch to remote or reach out directly.", stored || null);
        db.sessions[p.key] = { mode: "cancelled", by: "student", at: Date.now(), reason: str(v.reason, 300), link: "" };
        return ok("session", p.key, db.sessions[p.key]);
      }
      if (v.mode === "remote") {
        if (stored && stored.mode === "remote") return ok("session", p.key, stored);
        if (h <= 0) return no("session", p.key, "That lesson has already started", stored || null);
        db.sessions[p.key] = { mode: "remote", by: "student", at: Date.now(), link: (stored && stored.link) || "", reason: "" };
        return ok("session", p.key, db.sessions[p.key]);
      }
      return no("session", p.key, "Not allowed", stored || null);
    }
    if (p.type === "student") {
      // A student can only say "I've sent payment" for their own unpaid lessons.
      const v = p.value || {};
      if (v.id !== me.id) return no("student", v.id, "Not allowed");
      let changed = false;
      (v.lessons || []).forEach((l) => {
        const stored = me.lessons.find((x) => x.id === l.id);
        if (stored && stored.status === "unpaid" && l.status === "reported" && ["zelle", "paypal"].includes(l.method)) {
          stored.status = "reported"; stored.method = l.method; stored.reportedAt = Date.now(); changed = true;
        }
      });
      if (changed) me.rev = (me.rev || 0) + 1;
      return ok("student", me.id, me);
    }
    no(p.type, p.id, "Not allowed");
  }

  // ---------------- the music store ----------------
  function storePut(p) {
    if (p.type !== "trial") return no(p.type, p.id, "Not allowed");
    const v = p.value || {};
    const stored = db.trials.find((x) => x.id === v.id);
    if (stored) {
      if (v.status === "cancelled" && stored.status === "pending") { stored.status = "cancelled"; stored.cancelledBy = "store"; stored.rev = (stored.rev || 0) + 1; }
      return ok("trial", stored.id, stored);
    }
    if (!db.teachers[v.teacher]) return no("trial", v.id, "Pick an instructor");
    if (!isDate(v.date) || v.date < todayISO()) return no("trial", v.id, "Pick a date that hasn't passed");
    if (!str(v.name).trim() || !/\S+@\S+\.\S+/.test(str(v.email))) return no("trial", v.id, "Add the student's name and a working email");
    const mins = db.store.trialMins || 30, start = Math.max(0, Math.min(1410, Math.round(+v.start || 0)));
    if (!slotFree(db, v.teacher, v.date, start, mins)) return no("trial", v.id, "That time was just taken. Pick another open time.");
    const next = { id: str(v.id, 60) || rid("t"), teacher: v.teacher, date: v.date, start, mins,
      name: str(v.name, 100).trim(), age: str(v.age, 30), instrument: str(v.instrument, 80), guardian: str(v.guardian, 100), email: str(v.email, 200).trim(),
      phone: str(v.phone, 40), note: str(v.note, 800), bookedBy: str(v.bookedBy, 60), status: "pending", rev: 1, createdAt: Date.now() };
    db.trials.push(next); return ok("trial", next.id, next);
  }
}
