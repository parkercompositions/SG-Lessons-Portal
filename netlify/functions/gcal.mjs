// Each teacher's own Google Calendar connection.
//   GET  /api/gcal/connect     (teacher) -> Google asks permission for the Lesson Studio calendar + busy times
//   GET  /api/gcal/callback    <- Google sends you back here
//   POST /api/gcal/sync        (teacher) -> push to Google and re-read busy times now
//   POST /api/gcal/disconnect  (teacher) -> remove the Lesson Studio calendar and forget the connection
import { json } from "../lib/util.mjs";
import { signToken, readToken } from "../lib/session.mjs";
import { readDb } from "../lib/store.mjs";
import { resolve, sessionEmail } from "../lib/who.mjs";
import { gcalAuthUrl, gcalExchange, gcalConfigured, syncTeacher, gcalDisconnect, gcalStatus } from "../lib/gcal.mjs";

const back = (q) => new Response(null, { status: 302, headers: { location: "/?" + q, "cache-control": "no-store" } });

export default async (req, context) => {
  const action = (context.params && context.params.action) || new URL(req.url).pathname.split("/").pop();
  try {
    const email = sessionEmail(req);
    const { db } = await readDb();
    const who = email ? resolve(email, db) : null;
    const teacher = who && who.role === "teacher";
    if (!gcalConfigured()) return req.method === "POST" ? json(503, { error: "Google Calendar isn't set up on the server yet." }) : back("gcal=notsetup");

    if (action === "connect") {
      if (!teacher) return back("gcal=teachers");
      return new Response(null, { status: 302, headers: { location: gcalAuthUrl(signToken({ c: "gcal", e: email, t: who.id }), email), "cache-control": "no-store" } });
    }
    if (action === "callback") {
      const url = new URL(req.url);
      const st = readToken(url.searchParams.get("state"));
      if (!st || st.c !== "gcal" || !teacher || st.e !== email || st.t !== who.id) return back("gcal=expired");
      if (url.searchParams.get("error")) return back("gcal=cancelled");
      try { await gcalExchange(who.id, url.searchParams.get("code")); }
      catch (e) { return back(e.code === "scopes" ? "gcal=scopes" : "gcal=error"); }
      const s = await syncTeacher(db, who.id);
      return back(s && s.error ? "gcal=partial" : "gcal=connected");
    }
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });
    if (!teacher) return json(403, { error: "Teachers only." });
    if (action === "sync") {
      await syncTeacher(db, who.id);
      return json(200, { gcal: (await gcalStatus())[who.id] || { connected: false } });
    }
    if (action === "disconnect") {
      await gcalDisconnect(who.id);
      return json(200, { gcal: { connected: false, account: "", synced: 0, error: "" } });
    }
    return json(404, { error: "Unknown action" });
  } catch (e) {
    console.error("[gcal]", e);
    return req.method === "POST" ? json(502, { error: e.message }) : back("gcal=error");
  }
};

export const config = { path: "/api/gcal/:action" };
