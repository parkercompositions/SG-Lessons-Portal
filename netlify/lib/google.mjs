// Google: verify sign-in tokens, and the read-only Google Classroom connection.
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (one OAuth "Web application" client)
import { SITE } from "./util.mjs";
import { readGoogleToken, writeGoogleToken, readClassroom, writeClassroom } from "./store.mjs";

// Read-only Classroom access. Nothing here can post, edit or delete anything in Classroom.
export const CLASSROOM_SCOPES = [
  "openid", "email",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.profile.emails",
  "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
  "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
  "https://www.googleapis.com/auth/classroom.topics.readonly",
];
export const redirectUri = () => `${SITE()}/api/classroom/callback`;

// Sign in with Google: check the ID token Google gave the browser.
export async function verifyIdToken(credential) {
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
  if (!r.ok) throw new Error("Google didn't accept that sign-in. Try again.");
  const t = await r.json();
  if (t.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error("That sign-in was for a different app.");
  if (String(t.email_verified) !== "true" || !t.email) throw new Error("That Google account has no verified email.");
  if (+t.exp * 1000 < Date.now()) throw new Error("That sign-in expired. Try again.");
  return { email: String(t.email).toLowerCase(), name: t.name || "" };
}

export function authUrl(state) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(), response_type: "code",
    scope: CLASSROOM_SCOPES.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + q;
}

async function tokenCall(params) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, ...params }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error_description || j.error || "Google token error"); e.code = j.error; throw e; }
  return j;
}

export async function exchangeCode(code) {
  const j = await tokenCall({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!j.refresh_token) throw new Error("Google didn't send a long-term key. Remove the app at myaccount.google.com/permissions and connect again.");
  let email = "";
  try { email = JSON.parse(Buffer.from(String(j.id_token).split(".")[1], "base64url").toString()).email || ""; } catch (e) {}
  await writeGoogleToken({ refresh_token: j.refresh_token, email, at: Date.now() });
  return email;
}

export async function revoke() {
  const t = await readGoogleToken();
  if (t && t.refresh_token) { try { await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(t.refresh_token), { method: "POST" }); } catch (e) {} }
}

async function api(path, access, params = {}) {
  const out = []; let pageToken = "";
  for (let i = 0; i < 40; i++) {
    const q = new URLSearchParams({ ...params, ...(pageToken ? { pageToken } : {}) });
    const r = await fetch(`https://classroom.googleapis.com/v1/${path}?${q}`, { headers: { authorization: "Bearer " + access } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || `Classroom said ${r.status}`);
    const key = Object.keys(j).find((k) => Array.isArray(j[k]));
    if (key) out.push(...j[key]);
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  return out;
}

const ymd = (d) => (d && d.year ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}` : "");
function attachments(materials) {
  return (materials || []).map((m) => {
    if (m.driveFile) { const f = m.driveFile.driveFile || {}; return { type: /\.pdf$/i.test(f.title || "") ? "pdf" : "doc", label: f.title || "File", href: f.alternateLink || "" }; }
    if (m.youtubeVideo) return { type: "video", label: m.youtubeVideo.title || "YouTube", href: m.youtubeVideo.alternateLink || "" };
    if (m.link) return { type: "link", label: m.link.title || m.link.url, href: m.link.url || "" };
    if (m.form) return { type: "form", label: m.form.title || "Form", href: m.form.formUrl || "" };
    return null;
  }).filter(Boolean);
}

// Pull classes, rosters and posts into the cache. Never writes to Classroom.
export async function syncClassroom() {
  const tok = await readGoogleToken();
  const cache = await readClassroom();
  if (!tok) { const v = { ...cache, connected: false }; await writeClassroom(v); return v; }
  let access;
  try { access = (await tokenCall({ refresh_token: tok.refresh_token, grant_type: "refresh_token" })).access_token; }
  catch (e) {
    const v = { ...cache, connected: e.code !== "invalid_grant", error: e.code === "invalid_grant" ? "Google ended the connection. Connect again from Settings." : e.message };
    await writeClassroom(v); return v;
  }
  const courses = await api("courses", access, { teacherId: "me", courseStates: "ACTIVE", pageSize: "50" });
  const classes = [], roster = {}, items = [];
  for (const c of courses) {
    classes.push({ id: c.id, name: c.name, section: c.section || "", link: c.alternateLink || "", teacherGuess: /trumpet/i.test(c.name) ? "mitchell" : "sarah" });
    const [studs, topics, work, mats] = await Promise.all([
      api(`courses/${c.id}/students`, access, { pageSize: "100" }),
      api(`courses/${c.id}/topics`, access, { pageSize: "100" }).catch(() => []),
      api(`courses/${c.id}/courseWork`, access, { pageSize: "100" }).catch(() => []),
      api(`courses/${c.id}/courseWorkMaterials`, access, { pageSize: "100" }).catch(() => []),
    ]);
    roster[c.id] = studs.map((s) => ({ name: (s.profile && s.profile.name && s.profile.name.fullName) || "", email: (s.profile && s.profile.emailAddress) || "" }));
    const topicName = Object.fromEntries(topics.map((t) => [t.topicId, t.name]));
    work.forEach((w) => items.push({ cls: c.id, kind: "assignment", topic: topicName[w.topicId] || "General", title: w.title || "Untitled", posted: (w.creationTime || "").slice(0, 10), due: ymd(w.dueDate), link: w.alternateLink || "", att: attachments(w.materials) }));
    mats.forEach((m) => items.push({ cls: c.id, kind: "material", topic: topicName[m.topicId] || "General", title: m.title || "Untitled", posted: (m.creationTime || "").slice(0, 10), link: m.alternateLink || "", att: attachments(m.materials) }));
  }
  const v = { connected: true, account: tok.email || "", synced: Date.now(), error: "", classes, roster, items };
  await writeClassroom(v);
  return v;
}
