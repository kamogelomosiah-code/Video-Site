# Elysian

An 18+ video and creator site with a full admin panel. React + Vite front end, Express + MongoDB back end.

## Run it locally

```bash
npm install
cp .env.example .env     # optional for local dev — without MONGODB_URI it uses data.json
npm run dev              # http://localhost:3000
```

Sign in at `/login` with `ADMIN_USERNAME` and `ADMIN_PASSWORD` from your `.env` (plus the PIN if `ADMIN_PIN` is a 6-digit number), then open **/admin**.

## Deploy (e.g. Render)

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment: `MONGODB_URI`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_PIN`, `APP_URL`, and email settings (`SMTP_*` or `RESEND_API_KEY` / `SENDGRID_API_KEY`) so reset codes reach users.
- MongoDB Atlas → **Network Access**: allow your host's outbound IPs (or `0.0.0.0/0`), otherwise the app can't connect. In production the server refuses to start without a working database rather than silently using a local file.

The app reads and writes the same MongoDB collections as the previous version of the site, so existing users, passwords, videos, creators, events, ads and settings carry over without migration.

## Admin panel (`/admin`)

| Section | What you can do |
| --- | --- |
| Overview | Counts, most-viewed videos, recent activity |
| Videos | Add / edit / delete, upload thumbnails, set category & tags, publish or keep as draft, ★ feature on the homepage; **Import JSON** / **Export JSON**; tick rows to publish, unpublish, move category or delete in bulk |
| Categories | The homepage filter chips; order, show/hide, matching tags |
| Creators | Directory profiles with photo, bio, rates, verified badge and offerings |
| Events | Schedule events, mark one **Live now** |
| Ads | Image, HTML or AdSense ads per placement, with views and clicks |
| Users | Change roles (incl. admin), verify, suspend, reset passwords, delete |
| Comments | Read and delete comments |
| Site settings | Site name, homepage spotlight, announcement bar, maintenance mode, sign-ups on/off, 18+ gate text, SEO, ads, ads.txt, privacy policy and terms |
| Activity log | Who changed what |
| My account | Your name, photo, password and admin PIN |

Every setting is used by the public site immediately after saving.

## Videos

Paste a **video link**. YouTube and Vimeo links and embed URLs (containing `/embed`) play on the page; any other link shows a "Watch full video" button that opens it on its own site. A direct `.mp4`/`.webm` file URL plays in the built-in player. Uploads are limited to images (thumbnails, photos, banners), max 10 MB.

## Password reset

Users enter their email at `/forgot-password`, receive a **6-digit code** by email (valid 15 minutes, 5 tries), enter it, then choose a new password and are signed in.
Email is sent by `server/mail/mailer.js` (plain JavaScript module) using SMTP, Resend or SendGrid — whichever is configured. Without one, codes are printed in the server log (and shown on screen in development).

## Importing videos from JSON

Admin → Videos → **Import JSON**. Paste or choose a file containing a list like:

```json
[
  { "title": "Sunset Session", "externalUrl": "https://www.youtube.com/watch?v=…", "thumbnailUrl": "https://…/thumb.jpg",
    "category": "glamour", "tags": ["sunset", "beach"], "duration": "12:30", "published": true }
]
```

Required: `title` plus `externalUrl` (any link) or `sourceUrl` (a direct .mp4/.webm). Also accepted: `url`, `link`, `thumbnail`, `image`, `name`, `creator`.
Click **Check** to validate without saving. Choose **Update by id** to edit videos from an **Export JSON** file and re-import them.

See `docs/ENHANCEMENT_PLAN.md` for the roadmap.

## Project layout

```
server/   Express API (auth, public routes, admin routes, storage)
shared/   Types and password rules used by both server and browser
src/      React app — pages/, admin/, components/, lib/
```
