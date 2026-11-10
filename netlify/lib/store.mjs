// Netlify Blobs storage for the Lesson Studio.
//
// Lessons learned from the Green Room, built in from day one:
//  * A failed read THROWS. Only a genuine "nothing saved yet" returns the empty
//    starting state, so one network blip can never be saved back over real data.
//  * Every write is conditional on the copy we read (etag). If someone else saved
//    in between, we re-read and re-apply instead of overwriting their change.
//  * Strong consistency on every read, so a write is never based on a stale copy.
//  * A dated copy of the whole database is kept every day (see daily.mjs), and
//    every restore saves a "before restore" copy first.
import { getStore } from "@netlify/blobs";
import { teacherEmails, clone } from "./util.mjs";

const DB = "sg-lessons";
const CLASSROOM = "sg-lessons-classroom";
const SECRETS = "sg-lessons-secrets"; // never sent to the browser
const BACKUPS = "sg-lessons-backups";

const store = (name) => getStore({ name, consistency: "strong" });

export function defaultDb() {
  const emails = teacherEmails();
  const base = { open: [], away: [], firstFree: true, email: { away: true, remote: true, answer: true, request: true, paid: true } };
  return {
    app: "sg-lessons", v: 1,
    teachers: {
      sarah: { ...clone(base), id: "sarah", name: "Sarah Griego", short: "Sarah", owner: true, rates: { 30: 40, 60: 70 }, paypal: "UWH7E6XQGNUZU", zelle: "(505) 999-0671", notifyEmail: (emails.sarah || [])[0] || "", rev: 1 },
      mitchell: { ...clone(base), id: "mitchell", name: "Mitchell Weber", short: "Mitchell", owner: false, rates: { 30: 30, 60: 50 }, paypal: "UWH7E6XQGNUZU", zelle: "(361) 442-6508", notifyEmail: (emails.mitchell || [])[0] || "", rev: 1 },
    },
    students: [],
    requests: [],
    sessions: {},
    classMap: {},
  };
}

// -> { db, etag }   (etag null = nothing saved yet)
export async function readDb() {
  const got = await store(DB).getWithMetadata("db", { type: "json" }); // throws on failure: good
  if (got == null) return { db: defaultDb(), etag: null };
  if (!got.data || got.data.app !== "sg-lessons") throw new Error("The studio database looks damaged. Nothing was changed.");
  return { db: got.data, etag: got.etag || null };
}

// -> true if written, false if someone else saved first
export async function writeDb(db, etag) {
  const opts = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
  const res = await store(DB).setJSON("db", db, opts);
  return res ? res.modified !== false : true;
}

// Read, change, conditional write; retries if another save landed in between.
export async function updateDb(mutate, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const { db, etag } = await readDb();
    const before = clone(db);
    const out = await mutate(db);
    if (out && out.noWrite) return { db, before, out, wrote: false };
    if (await writeDb(db, etag)) return { db, before, out, wrote: true };
    await new Promise((r) => setTimeout(r, 120 * (i + 1)));
  }
  throw new Error("The studio is busy saving other changes. Try again in a moment.");
}

// ---------- Classroom cache + Google token ----------
export async function readClassroom() {
  const v = await store(CLASSROOM).get("cache", { type: "json" });
  return v || { connected: false, classes: [], roster: {}, items: [], synced: 0 };
}
export const writeClassroom = (v) => store(CLASSROOM).setJSON("cache", v);
export async function readGoogleToken() { return (await store(SECRETS).get("google", { type: "json" })) || null; }
export const writeGoogleToken = (v) => store(SECRETS).setJSON("google", v);
export const deleteGoogleToken = () => store(SECRETS).delete("google");

// ---------- backups ----------
export async function snapshot(db, key) { await store(BACKUPS).setJSON(key, { ...db, savedAt: new Date().toISOString() }); }
export async function pruneBackups(prefix, keepDays) {
  const cutoff = Date.now() - keepDays * 864e5;
  const { blobs } = await store(BACKUPS).list({ prefix });
  for (const b of blobs) {
    const d = Date.parse(b.key.slice(prefix.length, prefix.length + 10) + "T00:00:00Z");
    if (d && d < cutoff) await store(BACKUPS).delete(b.key);
  }
}
export async function listBackups() {
  const { blobs } = await store(BACKUPS).list();
  return blobs.map((b) => b.key).sort().reverse();
}
export const readBackup = (key) => store(BACKUPS).get(key, { type: "json" });
