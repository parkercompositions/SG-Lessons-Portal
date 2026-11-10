// Works out which emails a saved change should send, by comparing the database
// before and after. Only looks at what this save actually touched.
import { occurs, addDays, todayISO, fmtLong, fmtTime, rangeText, first, gcalLink } from "./util.mjs";

const studentTo = (s) => [s.email, s.guardianEmail].filter(Boolean);
const on = (t, k) => !!(t && t.email && t.email[k]);

export function emailsFor(before, after, results, who) {
  const out = [];
  const today = todayISO();
  const okIds = (type) => results.filter((r) => r.ok && r.type === type).map((r) => r.id);

  // Teacher added away dates -> students who have a lesson then
  for (const tid of okIds("teacher")) {
    const t = after.teachers[tid], b = before.teachers[tid];
    if (!on(t, "away")) continue;
    const had = new Set(((b && b.away) || []).map((a) => a.id));
    for (const a of (t.away || []).filter((x) => !had.has(x.id) && x.to >= today)) {
      for (const s of after.students.filter((x) => !x.archived && x.teacher === tid)) {
        const miss = [];
        for (let d = a.from; d <= a.to; d = addDays(d, 1)) if (d >= today && occurs(s, d)) miss.push(d);
        if (!miss.length) continue;
        out.push({ to: studentTo(s), replyTo: t.notifyEmail, subject: `No lesson ${miss.length === 1 ? "on " + fmtLong(miss[0]) : "on " + miss.length + " days"}: ${t.short} is away`,
          title: `${t.short} is away ${rangeText(a.from, a.to)}`,
          lines: [`Hi ${first(s.name)}! There's no lesson on ${miss.map(fmtLong).join(", ")}.`, a.note ? `Note from ${t.short}: ${a.note}` : "", "Want to make it up? Open times for extra lessons are on your calendar."].filter(Boolean) });
      }
    }
  }

  // Lesson switched to remote by the teacher (or the link changed) -> student
  for (const key of who.role === "teacher" ? okIds("session") : []) {
    const v = after.sessions[key], b = before.sessions[key];
    if (!v || v.mode !== "remote" || (b && b.mode === "remote" && b.link === v.link) || v.by === "student" && !v.link) continue;
    const [sid, date] = key.split("|"), s = after.students.find((x) => x.id === sid);
    if (!s || date < today) continue;
    const t = after.teachers[s.teacher];
    if (!on(t, "remote")) continue;
    out.push({ to: studentTo(s), replyTo: t.notifyEmail, subject: `Your lesson on ${fmtLong(date)} is remote`,
      title: `Your lesson on ${fmtLong(date)} is remote`,
      lines: [`Hi ${first(s.name)}! Your ${s.regular ? fmtTime(s.regular.start) + " " : ""}lesson with ${t.short} will be online this time.`, v.link ? "Join here:" : `${t.short} will send the link before the lesson.`],
      link: v.link ? { href: v.link } : null });
  }

  // Extra lesson requests: new (to teacher) and answered (to student)
  for (const id of okIds("request")) {
    const r = after.requests.find((x) => x.id === id), b = before.requests.find((x) => x.id === id);
    if (!r) continue;
    const s = after.students.find((x) => x.id === r.studentId), t = after.teachers[r.teacher];
    if (!s || !t) continue;
    const when = `${fmtLong(r.date)} at ${fmtTime(r.start)}`;
    if (!b && r.status === "pending" && who.role === "student" && on(t, "request") && t.notifyEmail) {
      out.push({ to: [t.notifyEmail], replyTo: s.email, subject: `Extra lesson request from ${s.name}`, title: `${s.name} asked for an extra lesson`,
        lines: [`${when}, ${r.mins} minutes.`, r.note ? `"${r.note}"` : "", "Accept or decline it under Schedule."].filter(Boolean), button: "Answer the request" });
    }
    if (b && b.status !== r.status && on(t, "answer")) {
      if (r.status === "accepted") out.push({ to: studentTo(s), replyTo: t.notifyEmail, subject: `Extra lesson confirmed: ${when}`, title: `You're booked: ${when}`, lines: [`${t.short} confirmed your extra lesson (${r.mins} minutes).`, r.reply ? `"${r.reply}"` : "See you then!"] });
      if (r.status === "declined") out.push({ to: studentTo(s), replyTo: t.notifyEmail, subject: `${t.short} can't do ${when}`, title: `${t.short} can't do ${when}`, lines: [r.reply ? `"${r.reply}"` : "", "Pick another open time on your calendar."].filter(Boolean) });
      if (r.status === "cancelled") out.push({ to: studentTo(s), replyTo: t.notifyEmail, subject: `Extra lesson on ${fmtLong(r.date)} cancelled`, title: `Your extra lesson on ${when} was cancelled`, lines: ["Pick another open time on your calendar, or reply to this email."] });
    }
  }

  // Student cancels or switches a lesson to remote -> teacher
  if (who.role === "student") {
    const me = after.students.find((x) => x.id === who.id), t = me && after.teachers[me.teacher];
    const tell = (subject, title, lines) => { if (on(t, "cancel") && t.notifyEmail) out.push({ to: [t.notifyEmail], replyTo: me.email || me.guardianEmail, subject, title, lines, button: "Open your schedule" }); };
    for (const key of okIds("session")) {
      const v = after.sessions[key], b = before.sessions[key], date = key.split("|")[1], when = `${fmtLong(date)} at ${fmtTime(me.regular.start)}`;
      if (v && v.mode === "cancelled" && (!b || b.mode !== "cancelled")) tell(`${me.name} cancelled ${fmtLong(date)}`, `${me.name} cancelled their lesson`, [when + ".", "They cancelled more than 24 hours ahead, as the policy allows."]);
      else if (v && v.mode === "remote" && (!b || b.mode !== "remote")) tell(`${me.name} switched ${fmtLong(date)} to remote`, `${me.name} switched to remote`, [when + ".", "Add the video link under Schedule so they get it."]);
      else if (!v && b && b.mode === "cancelled") tell(`${me.name}'s ${fmtLong(date)} lesson is back on`, `${me.name}'s lesson is back on`, [when + ".", "They undid their cancellation."]);
    }
    for (const id of okIds("request")) {
      const r = after.requests.find((x) => x.id === id), b = before.requests.find((x) => x.id === id);
      if (!r || !b) continue;
      const when = `${fmtLong(r.date)} at ${fmtTime(r.start)}`;
      if (r.status === "cancelled" && b.status !== "cancelled") tell(`${me.name} cancelled their extra lesson`, `${me.name} cancelled their extra lesson`, [when + "."]);
      else if (r.mode === "remote" && b.mode !== "remote") tell(`${me.name} switched their extra lesson to remote`, `${me.name} switched to remote`, [when + ".", "Send them a video link."]);
    }
  }

  // Get to Know sessions from the music store
  const store = after.store || {};
  for (const id of okIds("trial")) {
    const x = after.trials.find((y) => y.id === id), b = before.trials.find((y) => y.id === id);
    const t = x && after.teachers[x.teacher];
    if (!x || !t) continue;
    const when = `${fmtLong(x.date)} at ${fmtTime(x.start)}`, hello = `Hi ${first(x.guardian || x.name)}!`, cc = store.email ? [store.email] : [];
    if (!b && who.role === "store" && on(t, "request") && t.notifyEmail) {
      out.push({ to: [t.notifyEmail], replyTo: x.email, subject: `Get to Know session booked: ${x.name}, ${when}`, title: `${store.name || "The store"} booked a Get to Know session`,
        lines: [`${x.name}${x.age ? " (" + x.age + ")" : ""}, ${x.instrument}. ${when}, ${x.mins} minutes.`, `Contact: ${x.guardian ? x.guardian + ", " : ""}${x.email}${x.phone ? ", " + x.phone : ""}.`, x.note ? `"${x.note}"` : "", x.bookedBy ? `Booked by ${x.bookedBy}.` : "", "Confirm it under Schedule."].filter(Boolean), button: "Confirm it" });
    }
    if (b && b.status === "pending" && x.status === "cancelled" && who.role === "store" && on(t, "request") && t.notifyEmail) {
      out.push({ to: [t.notifyEmail], subject: `Get to Know session cancelled: ${x.name}`, title: `${store.name || "The store"} cancelled ${x.name}'s Get to Know session`, lines: [when + "."] });
    }
    if (b && b.status !== x.status && who.role === "teacher" && on(t, "answer")) {
      if (x.status === "accepted") out.push({ to: [x.email, ...cc], replyTo: t.notifyEmail, subject: `Confirmed: Get to Know session with ${t.name}, ${when}`, title: `You're all set for ${when}`,
        lines: [`${hello} ${t.name} is looking forward to meeting ${x.guardian ? first(x.name) : "you"}. It's a free ${x.mins}-minute Get to Know session.`, x.reply ? `"${x.reply}"` : "", "Questions or need to change it? Just reply to this email."].filter(Boolean),
        link: { href: gcalLink(`Get to Know session with ${t.name}`, x.date, x.start, x.mins, `${x.instrument}. Booked through ${store.name || "the store"}.`), label: "Add it to Google Calendar" }, button: false });
      if (x.status === "declined") out.push({ to: [x.email, ...cc], replyTo: t.notifyEmail, subject: `${t.name} can't make ${when}`, title: `${t.short} can't make ${when}`,
        lines: [`${hello} Sorry, that time doesn't work after all.`, x.reply ? `"${x.reply}"` : "", `${store.name || "The store"} can help you pick another time, or just reply to this email.`].filter(Boolean), button: false });
      if (x.status === "cancelled" && b.status === "accepted") out.push({ to: [x.email, ...cc], replyTo: t.notifyEmail, subject: `Get to Know session on ${fmtLong(x.date)} cancelled`, title: `Your Get to Know session on ${when} was cancelled`,
        lines: [`${hello} ${t.short} had to cancel. Reply to this email or ask ${store.name || "the store"} to pick a new time.`], button: false });
    }
  }

  // Student says "I've sent it"
  if (who.role === "student") {
    for (const id of okIds("student")) {
      const s = after.students.find((x) => x.id === id), b = before.students.find((x) => x.id === id);
      const t = s && after.teachers[s.teacher];
      if (!s || !b || !on(t, "paid") || !t.notifyEmail) continue;
      const newly = s.lessons.filter((l) => l.status === "reported" && (b.lessons.find((x) => x.id === l.id) || {}).status === "unpaid");
      if (!newly.length) continue;
      const total = newly.reduce((a, l) => a + (+l.amount || 0), 0), method = newly[0].method === "zelle" ? "Zelle" : "PayPal";
      out.push({ to: [t.notifyEmail], replyTo: s.email, subject: `${s.name} sent $${total} by ${method}`, title: `${s.name} says they sent $${total}`,
        lines: [`By ${method}, for ${newly.map((l) => fmtLong(l.date)).join(", ")}.`, "Check that it arrived, then confirm it under Payments."], button: "Confirm the payment" });
    }
  }
  return out;
}
