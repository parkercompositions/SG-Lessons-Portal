// Email notices, sent through the same Gmail account and app password the Green Room uses.
//   GMAIL_USER, GMAIL_APP_PASSWORD
import nodemailer from "nodemailer";
import { SITE } from "./util.mjs";

export const mailConfigured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// lines: array of strings (plain text); link: optional { href, label }
export function compose({ title, lines = [], link, button = "Open the Lesson Studio" }) {
  const site = SITE();
  const html = `<div style="background:#0A0A0A;padding:28px 12px;font-family:Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#151515;border:1px solid #262626;border-top:3px solid #E3261F;padding:26px 24px">
    <div style="font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#E3261F;font-weight:bold">Sarah Griego · Lesson Studio</div>
    <h1 style="font-size:21px;line-height:1.35;color:#FBFAF8;margin:14px 0 12px;font-weight:600">${esc(title)}</h1>
    ${lines.map((l) => `<p style="font-size:15px;line-height:1.6;color:#C9C3B8;margin:0 0 10px">${esc(l)}</p>`).join("")}
    ${link ? `<p style="font-size:15px;line-height:1.6;margin:0 0 10px"><a href="${esc(link.href)}" style="color:#7FB8E6">${esc(link.label || link.href)}</a></p>` : ""}
    ${site ? `<p style="margin:22px 0 0"><a href="${esc(site)}" style="display:inline-block;background:#E3261F;color:#0A0A0A;padding:11px 18px;text-decoration:none;font-weight:bold;letter-spacing:.12em;text-transform:uppercase;font-size:12px">${esc(button)}</a></p>` : ""}
  </div>
  <p style="max-width:520px;margin:14px auto 0;font-size:11px;color:#6F6A62;text-align:center">You get these because you take lessons with Sarah Griego Music. Questions? Just reply.</p>
</div>`;
  const text = [title, "", ...lines, link ? link.href : "", "", site ? `Open the Lesson Studio: ${site}` : ""].filter((x) => x !== undefined).join("\n");
  return { html, text };
}

// messages: [{ to: [emails], subject, title, lines, link, replyTo }]
export async function sendAll(messages) {
  const list = messages.map((m) => ({ ...m, to: [...new Set((m.to || []).filter(Boolean).map((e) => e.trim()))] })).filter((m) => m.to.length);
  if (!list.length) return { sent: 0, failed: 0, errors: [] };
  if (!mailConfigured()) return { sent: 0, failed: list.length, errors: ["Email isn't set up on the server yet"] };
  const transport = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
  let sent = 0; const errors = [];
  await Promise.race([
    Promise.all(list.map(async (m) => {
      const { html, text } = compose(m);
      try {
        await transport.sendMail({ from: `"Sarah Griego Lesson Studio" <${process.env.GMAIL_USER}>`, to: m.to.join(", "), replyTo: m.replyTo || undefined, subject: m.subject, text, html });
        sent++;
      } catch (e) { errors.push(e.message); console.error("[mail]", e.message); }
    })),
    new Promise((r) => setTimeout(r, 9000)),
  ]);
  return { sent, failed: list.length - sent, errors };
}
