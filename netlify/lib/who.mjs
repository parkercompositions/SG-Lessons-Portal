// Who is asking? Resolved fresh from the session email on every request.
import { readCookie } from "./session.mjs";
import { teacherFor, sameEmail, OWNER } from "./util.mjs";

// -> { role: "teacher", id, owner, email } | { role: "student", id, email } | { role: "none", email } | null
export function resolve(email, db) {
  if (!email) return null;
  const t = teacherFor(email);
  if (t && db.teachers[t]) return { role: "teacher", id: t, owner: t === OWNER, email };
  const s = db.students.find((x) => !x.archived && (sameEmail(x.email, email) || sameEmail(x.guardianEmail, email)));
  if (s) return { role: "student", id: s.id, email };
  return { role: "none", email };
}

export function sessionEmail(req) {
  const c = readCookie(req);
  return c ? c.email : null;
}
