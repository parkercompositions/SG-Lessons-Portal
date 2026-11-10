// Runs once a day: keeps a dated copy of the whole studio (30 days kept) and
// refreshes Google Classroom so new posts show up even if nobody taps Sync.
import { readDb, snapshot, pruneBackups } from "../lib/store.mjs";
import { syncClassroom } from "../lib/google.mjs";
import { todayISO } from "../lib/util.mjs";

export default async () => {
  try {
    const { db, etag } = await readDb();
    if (etag) { await snapshot(db, `daily/${todayISO()}`); await pruneBackups("daily/", 30); }
  } catch (e) { console.error("[daily] backup", e.message); }
  try { if (process.env.GOOGLE_CLIENT_SECRET) await syncClassroom(); } catch (e) { console.error("[daily] classroom", e.message); }
};

export const config = { schedule: "@daily" };
