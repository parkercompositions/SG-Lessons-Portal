// The studio's data.
//   GET                 -> everything this person may see
//   GET ?backup=1       -> (Sarah) the whole database, for Backup & Export
//   GET ?backups=1      -> (Sarah) list of automatic copies
//   POST { puts }       -> save changes (checked per person, conflict-safe) and send any email notices
//   POST { restore }    -> (Sarah) restore a backup; saves a "before restore" copy first
import { json, todayISO } from "../lib/util.mjs";
import { readDb, updateDb, readClassroom, snapshot, listBackups, readBackup } from "../lib/store.mjs";
import { resolve, sessionEmail } from "../lib/who.mjs";
import { viewFor } from "../lib/view.mjs";
import { applyPuts } from "../lib/apply.mjs";
import { emailsFor } from "../lib/events.mjs";
import { sendAll, mailConfigured } from "../lib/mail.mjs";

async function current(req) {
  const email = sessionEmail(req);
  if (!email) return { err: json(401, { error: "Signed out. Sign in again." }) };
  const { db } = await readDb();
  const who = resolve(email, db);
  if (!who || who.role === "none") return { err: json(403, { error: "This Google account isn't on the studio roster." }) };
  return { who, db };
}

export default async (req) => {
  try {
    const { who, db, err } = await current(req);
    if (err) return err;
    const url = new URL(req.url);

    if (req.method === "GET") {
      if (url.searchParams.get("backup")) {
        if (!who.owner) return json(403, { error: "Only Sarah can download backups." });
        return json(200, { ...db, exportedAt: new Date().toISOString(), origin: "real" });
      }
      if (url.searchParams.get("backups")) {
        if (!who.owner) return json(403, { error: "Only Sarah can see backups." });
        return json(200, { keys: await listBackups() });
      }
      return json(200, { ...viewFor(db, who, await readClassroom()), mail: mailConfigured() });
    }

    if (req.method !== "POST") return json(405, { error: "Method not allowed" });
    const raw = await req.text();
    if (raw.length > 3_000_000) return json(413, { error: "That change is too big to save." });
    let body; try { body = JSON.parse(raw); } catch (e) { return json(400, { error: "Bad request" }); }

    if (body.restore || body.restoreKey) {
      if (!who.owner) return json(403, { error: "Only Sarah can restore." });
      const incoming = body.restoreKey ? await readBackup(String(body.restoreKey)) : body.restore;
      if (!incoming || incoming.app !== "sg-lessons" || !incoming.teachers || !Array.isArray(incoming.students)) return json(400, { error: "That isn't a Lesson Studio backup." });
      if (incoming.origin && incoming.origin !== "real") return json(400, { error: "That backup came from a test copy, not the real studio. Nothing was changed." });
      await updateDb(async (live) => {
        await snapshot(live, `before-restore/${todayISO()}-${Date.now()}`);
        for (const k of Object.keys(live)) delete live[k];
        const { exportedAt, savedAt, origin, ...clean } = incoming;
        Object.assign(live, clean);
      });
      return json(200, { ok: true });
    }

    const puts = Array.isArray(body.puts) ? body.puts : [];
    if (!puts.length) return json(200, { results: [] });
    let results = [];
    const { before, db: after, wrote } = await updateDb((d) => {
      results = applyPuts(d, puts, who);
      return results.some((r) => r.ok) ? null : { noWrite: true };
    });
    let mail = { sent: 0, failed: 0, errors: [] };
    if (wrote) {
      try { mail = await sendAll(emailsFor(before, after, results, who)); } catch (e) { mail = { sent: 0, failed: 1, errors: [e.message] }; }
    }
    return json(200, { results, mail });
  } catch (e) {
    console.error("[data]", e);
    return json(503, { error: e.message || "Couldn't reach the studio's storage. Nothing was saved." });
  }
};

export const config = { path: "/api/data" };
