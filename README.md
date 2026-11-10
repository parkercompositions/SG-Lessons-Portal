# Sarah Griego Lesson Studio

Private lessons portal for Sarah and Mitchell: rosters, the scale sheet, repertoire,
lessons and payments (PayPal / Zelle), a weekly calendar with extra-lesson requests,
away and remote-lesson notices, a read-only Google Classroom connection, email
notices, and an end-of-year review for each student.

Site: https://sgmusiclessonsportal.netlify.app (once created)

## How it's built

No build step. `site/` is served as-is; everything else is Netlify Functions.

    site/index.html              the page and all styles
    site/app.js                  the app (plain JavaScript)
    netlify/functions/
      auth.mjs                   /api/auth            Sign in with Google, sign out
      data.mjs                   /api/data            load and save, backups, restore
      classroom.mjs              /api/classroom/*     read-only Classroom connect + sync
      daily.mjs                  scheduled daily      backup copy + Classroom sync
    netlify/lib/                 storage, sessions, permissions, emails, Google
    test/                        npm test (fake storage and Google; nothing is sent)

### Who sees what
- **Sarah** (owner): everything, including Mitchell's side, Classroom setup and backups.
- **Mitchell**: his own students, requests and Classroom classes.
- **Students and parents**: their own record only. Other students appear on the
  calendar as anonymous busy times so open slots are right. A student can only
  request an extra lesson, cancel their own pending request, and say "I've sent it"
  for an unpaid lesson; the server ignores any other change they send.

Teachers are recognised by email (`TEACHER_EMAILS`). Students and parents sign in
with the Google email saved in their details. Removing a student ends their sign-in.

### Safety, learned from the Green Room
- A failed read **throws**; only a truly empty store starts fresh. A network blip can
  never be saved back over real data.
- Every save is a conditional write on the copy that was read (Blobs etag), retried if
  someone else saved first. Each record has a `rev`; an edit based on an older copy is
  refused and the newer copy is shown instead of silently overwriting.
- A dated copy of the whole studio is kept daily for 30 days (`sg-lessons-backups`),
  and every restore saves a "before restore" copy first. Backups are stamped
  `origin: "real"` and anything else is refused on restore.

## Environment variables (Netlify → Site configuration → Environment variables)

| Name | What |
|---|---|
| `AUTH_SECRET` | long random string; signs sign-in cookies |
| `GOOGLE_CLIENT_ID` | OAuth client ID (Google Cloud → Clients) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret (only needed for Classroom) |
| `TEACHER_EMAILS` | `sarah:sarah@gmail.com,other@gmail.com;mitchell:mitch@gmail.com` |
| `GMAIL_USER` | same as the Green Room |
| `GMAIL_APP_PASSWORD` | same as the Green Room |

Set them for **all deploy contexts** (not Production only) so branch previews work.
Branch preview URLs also need adding to the Google client's JavaScript origins.

## Google Cloud setup (one time)

1. https://console.cloud.google.com → create a project, e.g. "SG Lesson Studio".
2. APIs & Services → Library → enable **Google Classroom API**.
3. Google Auth Platform → **Branding**: app name "Sarah Griego Lesson Studio", support email.
   **Audience**: External, then **Publish app** (In production). Students only ask for
   name and email, which needs no Google review.
   **Data access**: add the Classroom scopes listed in `netlify/lib/google.mjs`
   (all read-only). Only the shared Classroom account ever grants these; it sees an
   "unverified app" screen once (Advanced → continue).
4. **Clients** → Create client → Web application:
   - Authorized JavaScript origins: `https://sgmusiclessonsportal.netlify.app`
   - Authorized redirect URIs: `https://sgmusiclessonsportal.netlify.app/api/classroom/callback`
5. Put the client ID and secret into Netlify as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

Then sign in as Sarah → Settings → Google Classroom → Connect, and pick the shared
Classroom account. Map each class to Sarah or Mitchell; "Add to roster" pulls students in.

## Tests

    npm install
    npm test
