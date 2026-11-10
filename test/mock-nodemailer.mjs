// Records emails instead of sending them (tests only).
export const outbox = (globalThis.__outbox ??= []);
export default { createTransport: () => ({ sendMail: async (m) => { outbox.push({ ...m, to: m.to.split(", ") }); return { messageId: "x" }; } }) };
