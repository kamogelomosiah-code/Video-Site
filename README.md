# Elysian

A simple video directory. Visitors search, browse and click a video to open it on its original website.
Admins sign in to manage every video, category, ad, user and setting. React + Vite front end, Express + MongoDB back end.

## Run locally

```bash
npm install
cp .env.example .env          # then put your APP_SECRET_KEY in it (see "Secrets")
npm run dev                   # http://localhost:3000
```

Without a database, local development uses a `data.json` file (git-ignored). Production never does; it refuses to start without MongoDB.

## Secrets (database URI and admin login)

The repo is public, so credentials are not in the code. They live in `secrets.sealed`, which is encrypted with AES-256-GCM and is safe to commit.
The only key that opens it is `APP_SECRET_KEY`, which stays in your host's environment and in your `.env` (git-ignored).

```bash
# 1. make a key (save it somewhere safe; you need the same value on your host)
npx tsx scripts/seal-secrets.ts --generate-key

# 2. seal your settings (run this whenever you change them)
APP_SECRET_KEY=<key> MONGODB_URI='mongodb+srv://…' MONGODB_DB=elysian \
ADMIN_USERNAME=administer ADMIN_PASSWORD='…' ADMIN_PIN='<your 6 digits>' npm run seal
```

Any setting also present as a normal environment variable overrides the sealed value.

## Deploy (e.g. Render)

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment variables: `APP_SECRET_KEY` (required), `APP_URL`, and one email option (`SMTP_*`, `RESEND_API_KEY` or `SENDGRID_API_KEY`).
- MongoDB Atlas → **Network Access**: allow your host's outbound IPs (or `0.0.0.0/0`).

## Checking the database

```bash
npm run check:db          # runs the database self-test (uses a temporary collection and removes it)
npm run dev               # in one terminal
npm run test:api          # in another: runs the whole site through its API and tidies up after itself
```

`check:db` uses your `MONGODB_URI` if one is set (from the environment or `secrets.sealed`), otherwise the local file.

## Admin (`/admin`)

| Section | What you can do |
| --- | --- |
| Overview | Counts, most-viewed videos, system status (database, email, sign-in) |
| Videos | Search, filter (shown / hidden / trending / category), add, edit, delete, show/hide, trending, move category — tick rows or select all matching; **Export** |
| Import | Upload a JSON or JSON-lines file of any size: it's checked first with row-by-row problems, then saved in batches of 500 with a progress bar and a downloadable problem list |
| Categories | Home-page categories, order, matching tags |
| Ads | Home-page banners (image, HTML or AdSense) with shown and click counts |
| Users | Roles, verified, suspend, reset password, delete |
| Site settings | Name, home headline, announcement bar, maintenance mode, sign-ups, 18+ gate, SEO, ads, legal pages |
| Activity log | Who changed what |
| My account | Your name, photo, password and PIN |

## Sign-in PIN and password reset

Set `ADMIN_PIN` to 6 digits to require a PIN after the password. Blank keeps the PIN already saved; only `off` removes it. A value set on the host wins over `secrets.sealed`.

Password reset emails a 6-digit code (15 minutes, 5 tries). Accounts with a PIN then sign in again with the new password and PIN. If `ADMIN_PASSWORD` is configured, it replaces the admin password at every restart, so update it there too.

## Importing videos

Each video needs a `title` and a `link` (the address of the original video). Accepted names include `url`, `thumbnail`, `name`, `creator`, `tags` (list or comma-separated), `duration` (seconds or `12:30`), `published`.

```json
[
  { "title": "Sunset Session", "link": "https://www.example.com/watch/sunset", "thumbnail": "https://…/t.jpg",
    "category": "Glamour", "tags": "sunset, beach", "duration": 750, "creator": "Studio K" }
]
```

Import modes: **Skip** videos already on the site (safe to repeat), **Update** them with the file's values, or **Add** everything again. Videos match by `id` or by the same link.

## Password reset

Users enter their email, receive a 6-digit code by email (valid 15 minutes, 5 tries, single use), then choose a new password and are signed in. Email is sent by `server/mail/mailer.js` through SMTP, Resend or SendGrid. Without one, codes are printed in the server log.

## Project layout

```
server/   Express API: auth, public routes, admin routes, storage, sealed secrets
shared/   Types, password rules and video validation shared by server and browser
src/      React app: pages/ (home, sign-in, account), admin/ (admin panel), components/, lib/
scripts/  seal-secrets, check-db, check-api
docs/     ENHANCEMENT_PLAN.md — roadmap
```
