// In-memory stand-in for @netlify/blobs (tests only), with etags and conditional writes.
const stores = (globalThis.__blobs ??= new Map());
let n = 0;
export const __fail = (globalThis.__blobFail ??= { read: false });
export function getStore(opts) {
  const name = typeof opts === "string" ? opts : opts.name;
  if (!stores.has(name)) stores.set(name, new Map());
  const m = stores.get(name);
  return {
    async get(key, o = {}) { if (__fail.read) throw new Error("network blip"); const v = m.get(key); if (!v) return null; return o.type === "json" ? JSON.parse(v.data) : v.data; },
    async getWithMetadata(key, o = {}) { if (__fail.read) throw new Error("network blip"); const v = m.get(key); if (!v) return null; return { data: o.type === "json" ? JSON.parse(v.data) : v.data, etag: v.etag, metadata: {} }; },
    async setJSON(key, val, o = {}) { const cur = m.get(key);
      if (o.onlyIfNew && cur) return { modified: false };
      if (o.onlyIfMatch && (!cur || cur.etag !== o.onlyIfMatch)) return { modified: false };
      m.set(key, { data: JSON.stringify(val), etag: "e" + ++n }); return { modified: true }; },
    async set(key, val, o) { return this.setJSON(key, JSON.parse(val), o); },
    async delete(key) { m.delete(key); },
    async list(o = {}) { return { blobs: [...m.keys()].filter((k) => !o.prefix || k.startsWith(o.prefix)).map((k) => ({ key: k, etag: m.get(k).etag })), directories: [] }; },
  };
}
