// Read-only Google Classroom connection.
//   GET  /api/classroom/connect     (Sarah) -> sends you to Google to approve read-only access
//   GET  /api/classroom/callback    <- Google sends you back here
//   POST /api/classroom/sync        (teachers) -> refresh classes, rosters and posts
//   POST /api/classroom/disconnect  (Sarah) -> forget the connection
import { json } from "../lib/util.mjs";
import { signToken, readToken } from "../lib/session.mjs";
import { readDb, readClassroom, writeClassroom, deleteGoogleToken } from "../lib/store.mjs";
import { resolve, sessionEmail } from "../lib/who.mjs";
import { classroomFor } from "../lib/view.mjs";
import { authUrl, exchangeCode, syncClassroom, revoke } from "../lib/google.mjs";

const back = (q) => new Response(null, { status: 302, headers: { location: "/?" + q, "cache-control": "no-store" } });

export default async (req, context) => {
  const action = (context.params && context.params.action) || new URL(req.url).pathname.split("/").pop();
  try {
    const email = sessionEmail(req);
    const { db } = await readDb();
    const who = email ? resolve(email, db) : null;
    const teacher = who && who.role === "teacher";
    if (!process.env.GOOGLE_CLIENT_SECRET) return action === "sync" ? json(503, { error: "Classroom isn't set up yet (missing GOOGLE_CLIENT_SECRET)." }) : back("gc=notsetup");

    if (action === "connect") {
      if (!teacher || !who.owner) return back("gc=owner");
      return new Response(null, { status: 302, headers: { location: authUrl(signToken({ c: "gc", e: email })), "cache-control": "no-store" } });
    }
    if (action === "callback") {
      const url = new URL(req.url);
      const st = readToken(url.searchParams.get("state"));
      if (!st || st.c !== "gc" || !teacher || !who.owner || st.e !== email) return back("gc=expired");
      if (url.searchParams.get("error")) return back("gc=cancelled");
      await exchangeCode(url.searchParams.get("code"));
      try { await syncClassroom(); } catch (e) { console.error("[classroom] first sync", e.message); }
      return back("gc=connected");
    }
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });
    if (!teacher) return json(403, { error: "Teachers only." });
    if (action === "sync") {
      const cache = await syncClassroom();
      return json(200, { classroom: classroomFor(cache, db, who) });
    }
    if (action === "disconnect") {
      if (!who.owner) return json(403, { error: "Only Sarah can disconnect Classroom." });
      await revoke(); await deleteGoogleToken();
      const cache = { ...(await readClassroom()), connected: false, account: "", error: "" };
      await writeClassroom(cache);
      return json(200, { classroom: classroomFor(cache, db, who) });
    }
    return json(404, { error: "Unknown action" });
  } catch (e) {
    console.error("[classroom]", e);
    return action === "sync" || req.method === "POST" ? json(502, { error: e.message }) : back("gc=error");
  }
};

export const config = { path: "/api/classroom/:action" };
