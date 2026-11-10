export async function resolve(spec, ctx, next) {
  if (spec === "@netlify/blobs") return { url: new URL("./mock-blobs.mjs", import.meta.url).href, shortCircuit: true };
  if (spec === "nodemailer") return { url: new URL("./mock-nodemailer.mjs", import.meta.url).href, shortCircuit: true };
  return next(spec, ctx);
}
