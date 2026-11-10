// Rhapsody Music's booking page, through a private link (/store/<code>). No sign-in:
// the code in the link is the key, and Sarah can replace it any time in Settings.
//   GET  /api/store?code=...            -> open times, anonymous busy times, sessions the store booked
//   POST /api/store { code, puts }      -> book a Get to Know session, or cancel one still waiting
import { json } from "../lib/util.mjs";
import { readDb, updateDb } from "../lib/store.mjs";
import { viewForStore } from "../lib/view.mjs";
import { applyPuts } from "../lib/apply.mjs";
import { emailsFor } from "../lib/events.mjs";
import { sendAll } from "../lib/mail.mjs";

const codeOk = (db, code) => !!code && !!db.store && db.store.code === String(code);

export default async (req) => {
  try {
    if (req.method === "GET") {
      const code = new URL(req.url).searchParams.get("code");
      const { db } = await readDb();
      if (!codeOk(db, code)) return json(404, { error: "This booking link has been replaced. Ask Sarah Griego Music for the new one." });
      return json(200, viewForStore(db));
    }
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });
    const raw = await req.text();
    if (raw.length > 50_000) return json(413, { error: "Too big" });
    let body; try { body = JSON.parse(raw); } catch (e) { return json(400, { error: "Bad request" }); }
    const puts = (Array.isArray(body.puts) ? body.puts : []).filter((p) => p && p.type === "trial").slice(0, 10);
    let results = [], bad = false;
    const who = { role: "store" };
    const { before, db: after, wrote } = await updateDb((d) => {
      if (!codeOk(d, body.code)) { bad = true; return { noWrite: true }; }
      results = applyPuts(d, puts, who);
      return results.some((r) => r.ok) ? null : { noWrite: true };
    });
    if (bad) return json(404, { error: "This booking link has been replaced. Ask Sarah Griego Music for the new one." });
    let mail = { sent: 0, failed: 0, errors: [] };
    if (wrote) { try { mail = await sendAll(emailsFor(before, after, results, who)); } catch (e) { mail = { sent: 0, failed: 1, errors: [e.message] }; } }
    return json(200, { results, mail });
  } catch (e) {
    console.error("[store]", e);
    return json(503, { error: e.message || "Couldn't reach the studio. Nothing was saved." });
  }
};

export const config = { path: "/api/store" };
