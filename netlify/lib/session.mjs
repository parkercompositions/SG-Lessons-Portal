// Signed session cookie. Holds only the Google email and an expiry; who that email
// belongs to (teacher, student, nobody) is looked up fresh on every request, so
// removing a student from the roster ends their access right away.
import crypto from "node:crypto";

const COOKIE = "sgls";
const MAX_AGE = 30 * 24 * 3600; // 30 days

const b64 = (s) => Buffer.from(s).toString("base64url");
const unb64 = (s) => Buffer.from(s, "base64url").toString();
const mac = (v) => crypto.createHmac("sha256", process.env.AUTH_SECRET || "").update(v).digest("base64url");

export function authConfigured() {
  return !!(process.env.AUTH_SECRET && process.env.GOOGLE_CLIENT_ID && process.env.TEACHER_EMAILS);
}

export function makeCookie(email) {
  const v = b64(JSON.stringify({ e: String(email).toLowerCase(), x: Date.now() + MAX_AGE * 1000 }));
  return `${COOKIE}=${v}.${mac(v)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function readCookie(req) {
  if (!process.env.AUTH_SECRET) return null;
  const raw = (req.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!raw) return null;
  const [v, sig] = raw.slice(COOKIE.length + 1).split(".");
  if (!v || !sig) return null;
  const good = mac(v);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const o = JSON.parse(unb64(v));
    if (!o.e || !o.x || o.x < Date.now()) return null;
    return { email: o.e };
  } catch (e) { return null; }
}

// Short signed tokens (Classroom OAuth "state")
export function signToken(obj, ttlSec = 600) {
  const v = b64(JSON.stringify({ ...obj, x: Date.now() + ttlSec * 1000 }));
  return v + "." + mac(v);
}
export function readToken(tok) {
  const [v, sig] = String(tok || "").split(".");
  if (!v || !sig || sig !== mac(v)) return null;
  try { const o = JSON.parse(unb64(v)); return o.x > Date.now() ? o : null; } catch (e) { return null; }
}
