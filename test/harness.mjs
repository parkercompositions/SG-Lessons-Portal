// Runs the real Netlify functions against in-memory storage and a fake Google.
import "./register.mjs";
let fns, mail, blobs, seen = 0;
const realFetch = globalThis.fetch;

export async function setup() {
  Object.assign(process.env, { AUTH_SECRET: "test-secret", GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret-2",
    TEACHER_EMAILS: "sarah:sarah@x.com;mitchell:mitch@x.com", URL: "https://lessons.test", GMAIL_USER: "studio@x.com", GMAIL_APP_PASSWORD: "pw" });
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.startsWith("https://oauth2.googleapis.com/tokeninfo")) {
      const email = decodeURIComponent(u.split("id_token=")[1]);
      return new Response(JSON.stringify({ aud: "test-client", email, email_verified: "true", exp: String(Math.floor(Date.now() / 1000) + 3600) }), { status: 200 });
    }
    if (u.startsWith("https://lessons.test/")) return route(opts?.method || "GET", u.replace("https://lessons.test", ""), opts?.body, opts?.headers?.cookie);
    return realFetch ? realFetch(url, opts) : new Response("{}", { status: 404 });
  };
  fns = {
    auth: (await import("../netlify/functions/auth.mjs")).default,
    data: (await import("../netlify/functions/data.mjs")).default,
    classroom: (await import("../netlify/functions/classroom.mjs")).default,
    store: (await import("../netlify/functions/store.mjs")).default,
    calendar: (await import("../netlify/functions/calendar.mjs")).default,
  };
  mail = await import("./mock-nodemailer.mjs");
  blobs = await import("./mock-blobs.mjs");
  return {
    lastEmails: () => { const out = mail.outbox.slice(seen); seen = mail.outbox.length; return out; },
    failReads: (on) => (blobs.__fail.read = on),
    backupKeys: () => [...(globalThis.__blobs.get("sg-lessons-backups") || new Map()).keys()],
  };
}

async function route(method, path, body, cookie) {
  const req = new Request("https://lessons.test" + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: method === "GET" || method === "DELETE" ? undefined : body });
  const p = path.split("?")[0];
  if (p === "/api/auth") return fns.auth(req, {});
  if (p === "/api/data") return fns.data(req, {});
  if (p.startsWith("/api/classroom/")) return fns.classroom(req, { params: { action: p.split("/").pop() } });
  if (p === "/api/store") return fns.store(req, {});
  if (p.startsWith("/api/calendar/")) return fns.calendar(req, { params: { file: p.split("/").pop() } });
  return new Response("not found", { status: 404 });
}

export async function call(method, path, body, cookie) {
  const res = await route(method, path, body == null ? undefined : JSON.stringify(body), cookie);
  let b = null; try { b = await res.clone().json(); } catch (e) {}
  return { status: res.status, body: b, headers: res.headers };
}

export async function signIn(email) {
  const res = await route("POST", "/api/auth", JSON.stringify({ credential: email }));
  if (res.status !== 200) throw new Error("sign-in refused: " + res.status);
  return res.headers.get("set-cookie").split(";")[0];
}
export { route };
