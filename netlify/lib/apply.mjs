// Applies a batch of changes from the browser to the database, enforcing who may
// change what. Each record carries a "rev"; a change based on an older rev than the
// one saved is refused as a conflict and the saved copy is sent back instead, so two
// people editing the same student can't silently undo each other.
import { todayISO, addDays } from "./util.mjs";

const str = (v, max = 2000) => String(v == null ? "" : v).slice(0, max);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

export function applyPuts(db, puts, who) {
  const results = [];
  const ok = (type, id, value) => results.push({ type, id, ok: true, value });
  const no = (type, id, error, value) => results.push({ type, id, ok: false, error, value });
  const canTeach = (teacherId) => who.owner || teacherId === who.id;

  for (const p of (Array.isArray(puts) ? puts : []).slice(0, 200)) {
    try {
      if (who.role === "teacher") teacherPut(p);
      else if (who.role === "student") studentPut(p);
      else no(p.type, p.id, "Not signed in");
    } catch (e) { no(p.type, p.id || (p.value && p.value.id), e.message); }
  }
  return results;

  function revCheck(type, id, stored, value) {
    if (stored && (value.rev || 0) !== (stored.rev || 0)) { no(type, id, "conflict", stored); return false; }
    return true;
  }

  function teacherPut(p) {
    const v = p.value;
    if (p.type === "teacher") {
      const stored = db.teachers[v && v.id];
      if (!stored) return no("teacher", v && v.id, "Unknown teacher");
      if (!canTeach(v.id)) return no("teacher", v.id, "Not allowed");
      if (!revCheck("teacher", v.id, stored, v)) return;
      const next = { ...v, id: stored.id, owner: stored.owner, rev: (stored.rev || 0) + 1 };
      db.teachers[v.id] = next; return ok("teacher", v.id, next);
    }
    if (p.type === "student") {
      if (!v || !v.id || typeof v.id !== "string") return no("student", null, "Missing id");
      const i = db.students.findIndex((s) => s.id === v.id), stored = i >= 0 ? db.students[i] : null;
      if (stored && !canTeach(stored.teacher)) return no("student", v.id, "Not allowed");
      if (!db.teachers[v.teacher] || !canTeach(v.teacher)) return no("student", v.id, "Not allowed");
      if (!revCheck("student", v.id, stored, v)) return;
      const next = { ...v, rev: ((stored && stored.rev) || 0) + 1 };
      if (i >= 0) db.students[i] = next; else db.students.push(next);
      return ok("student", v.id, next);
    }
    if (p.type === "request") {
      if (!v || !v.id) return no("request", null, "Missing id");
      const i = db.requests.findIndex((r) => r.id === v.id), stored = i >= 0 ? db.requests[i] : null;
      if (!canTeach(stored ? stored.teacher : v.teacher)) return no("request", v.id, "Not allowed");
      if (!revCheck("request", v.id, stored, v)) return;
      const next = { ...v, rev: ((stored && stored.rev) || 0) + 1 };
      if (i >= 0) db.requests[i] = next; else db.requests.push(next);
      return ok("request", v.id, next);
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
      if (p.value) db.sessions[p.key] = { mode: p.value.mode === "remote" ? "remote" : "inperson", link: str(p.value.link, 500) };
      else delete db.sessions[p.key];
      return ok("session", p.key, db.sessions[p.key] || null);
    }
    if (p.type === "classMap") {
      if (!who.owner) return no("classMap", p.courseId, "Only Sarah can change this");
      if (!db.teachers[p.teacher]) return no("classMap", p.courseId, "Unknown teacher");
      db.classMap[str(p.courseId, 100)] = p.teacher; return ok("classMap", p.courseId, p.teacher);
    }
    no(p.type, p.id, "Unknown change");
  }

  function studentPut(p) {
    const me = db.students.find((s) => s.id === who.id);
    if (!me) return no(p.type, p.id, "Not on the roster");
    if (p.type === "request") {
      const v = p.value || {};
      if (db.requests.some((r) => r.id === v.id)) return no("request", v.id, "Already sent", db.requests.find((r) => r.id === v.id));
      const today = todayISO();
      if (!isDate(v.date) || v.date < addDays(today, -1)) return no("request", v.id, "Pick a date that hasn't passed");
      const mins = [30, 60].includes(+v.mins) ? +v.mins : 30, start = Math.max(0, Math.min(1410, Math.round(+v.start || 0)));
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
}
