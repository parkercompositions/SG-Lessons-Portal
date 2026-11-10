// Sign in with Google.
//   GET    -> who am I (or the client ID the sign-in button needs)
//   POST   { credential } -> checks the Google token, signs in if the email is a teacher or on the roster
//   DELETE -> sign out
import { json } from "../lib/util.mjs";
import { authConfigured, makeCookie, clearCookie } from "../lib/session.mjs";
import { verifyIdToken } from "../lib/google.mjs";
import { readDb } from "../lib/store.mjs";
import { resolve, sessionEmail } from "../lib/who.mjs";

export default async (req) => {
  if (!authConfigured()) return json(503, { error: "Sign-in isn't set up yet (missing AUTH_SECRET, GOOGLE_CLIENT_ID or TEACHER_EMAILS)." });

  if (req.method === "GET") {
    const email = sessionEmail(req);
    if (!email) return json(200, { signedIn: false, clientId: process.env.GOOGLE_CLIENT_ID });
    const { db } = await readDb();
    const who = resolve(email, db);
    if (!who || who.role === "none") return json(200, { signedIn: false, clientId: process.env.GOOGLE_CLIENT_ID, notOnRoster: email }, { "set-cookie": clearCookie() });
    return json(200, { signedIn: true, ...who });
  }

  if (req.method === "POST") {
    let body = {};
    try { body = await req.json(); } catch (e) {}
    let g;
    try { g = await verifyIdToken(String(body.credential || "")); } catch (e) { return json(401, { error: e.message }); }
    const { db } = await readDb();
    const who = resolve(g.email, db);
    if (!who || who.role === "none") return json(403, { error: "not_on_roster", email: g.email });
    return json(200, { signedIn: true, ...who }, { "set-cookie": makeCookie(g.email) });
  }

  if (req.method === "DELETE") return json(200, { signedIn: false }, { "set-cookie": clearCookie() });
  return json(405, { error: "Method not allowed" });
};

export const config = { path: "/api/auth" };
