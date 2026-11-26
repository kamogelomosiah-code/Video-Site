# Enhancement plan — first base plan

A page-by-page review of the site as it stands, and a prioritised list of what to build next.
Phases are ordered so each one makes the next easier. Effort: S = under a day, M = 1–3 days, L = a week or more.

## Where we are

| Area | Today | Main gaps |
| --- | --- | --- |
| **Home** (`/`) | Featured spotlight, category chips, sort, search, load more, two ad slots | No "continue watching", no trending row, no per-category rows, thumbnails aren't size-optimised |
| **Watch** (`/watch/:id`) | Plays files / YouTube / Vimeo / embeds, else link-out; views, likes, comments, related | Premium videos aren't actually locked; no share button; no report button; comments have no replies or paging |
| **Creators** (`/creators`, `/creators/:id`) | Directory with search + verified filter, profile with offerings and videos | Creators can't edit their own profile; no follow/subscribe; offerings link out only |
| **Events** (`/events`) | Upcoming + live-now list | No calendar view, no reminders, no RSVP |
| **Sign in / up / reset** | Password rules, rate limits, email-code reset, admin optional PIN | No "remember this device", no email verification on sign-up, no 2FA for admins |
| **Account** (`/account`) | Name, photo, bio, password, admin PIN | Can't delete own account or download own data (needed for POPIA/GDPR) |
| **Admin** (`/admin`) | Full CRUD for videos, categories, creators, events, ads, users, comments; settings; activity; JSON import/export + bulk actions for videos | No charts/analytics, no scheduled publishing, no image library, no roles below full admin |
| **Platform** | Express + MongoDB, JSON fallback for dev | No automated tests in CI, no error monitoring, uploads stored in MongoDB (fine now, costly at scale) |

## Phase 1 — Go live safely (now) · S–M

1. **Deploy with real config** — `MONGODB_URI`, `ADMIN_USERNAME/PASSWORD`, SMTP (or Resend) and `APP_URL` on the host; allow the host's IP in Atlas → Network Access. *S*
2. **Stronger admin login** — the current admin password is 6 digits; switch to a long passphrase and turn the PIN back on (`ADMIN_PIN=<6 digits>`), or add authenticator-app 2FA. *S / M*
3. **Email verification on sign-up** — reuse the 6-digit code mailer so accounts are tied to a real inbox. *S*
4. **Automated tests in CI** — the browser checks used during development (admin CRUD, auth, JSON import) as a GitHub Action on every push. *M*
5. **Error monitoring + uptime check** — e.g. Sentry (free tier) and an uptime ping on `/api/health`. *S*
6. **Backups** — enable Atlas scheduled backups; keep the "Export JSON" for videos as a manual safety net. *S*

## Phase 2 — Content & admin productivity · M

1. **Scheduled publishing** — "publish at" date/time on videos and events. *S*
2. **Media library** — browse/reuse uploaded images; image resize + WebP on upload so pages load faster. *M*
3. **CSV import** alongside JSON (spreadsheets are easier for many people); bulk edit for creators and events like videos have now. *M*
4. **Editor role** — can manage content but not users/settings. *S*
5. **Draft preview link** — share an unpublished video with someone before it goes live. *S*
6. **Auto-fill from link** — paste a video URL and pull title/thumbnail/duration (oEmbed for YouTube/Vimeo). *M*

## Phase 3 — Viewer experience · M–L

1. **Home rows** — Trending (views in last 7 days), New this week, one row per category, Continue watching for signed-in users. *M*
2. **Real premium access** — lock premium videos behind a subscription or one-off purchase (PayFast / Paystack / Stripe), with an admin view of payments. *L*
3. **Favourites & watch later** lists. *S*
4. **Follow creators** and a "following" feed; notify on new uploads (email digest). *M*
5. **Comment replies, likes and reporting**, with a moderation queue in admin. *M*
6. **Share buttons** and proper link previews (server-rendered title/description/thumbnail per video for WhatsApp/X/Telegram). *M*
7. **Better search** — MongoDB Atlas Search for typo tolerance and relevance. *M*

## Phase 4 — Creators & growth · L

1. **Creator dashboard** — creators sign in, upload/edit their own videos (admin approval queue), edit their profile and offerings. *L*
2. **Analytics** — views over time, top videos, traffic sources, ad performance charts in admin. *M*
3. **Bookings / messages** — request a booking from a creator's offering with an inbox for both sides. *L*
4. **Video hosting** — move from link-outs to direct hosting via a video CDN (Bunny Stream / Cloudflare Stream / Mux) with adaptive streaming. *L*
5. **SEO** — per-video structured data (`VideoObject`), category landing pages, faster first load (server-side rendering or pre-rendering). *M*

## Compliance (adult site) — do alongside Phase 1–2

- Keep the 18+ gate on; consider an age-verification provider where required by law in your markets.
- Record 2257-style consent/age documentation for every performer (admin-only storage).
- Content reporting / takedown form and a documented response process.
- POPIA (South Africa) / GDPR: privacy policy reviewed, account deletion + data export, cookie consent (already in place for ads).
- Payment providers have adult-content rules — confirm before choosing one for Phase 3.

## Suggested next step

Phase 1 items 1–3 (deploy with real config, stronger admin login, email verification). They're small and make everything after them safer.
