# Elysian

An 18+ video and creator site with a full admin panel. React + Vite front end, Express + MongoDB back end.

## Run it locally

```bash
npm install
cp .env.example .env     # optional for local dev — without MONGODB_URI it uses data.json
npm run dev              # http://localhost:3000
```

Sign in at `/login` with the admin email or username, password and 6-digit PIN, then open **/admin**.

## Deploy (e.g. Render)

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment: `MONGODB_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PIN`, `APP_URL`, and an email key (`RESEND_API_KEY` or `SENDGRID_API_KEY`) so password resets reach users.

The app reads and writes the same MongoDB collections as the previous version of the site, so existing users, passwords, videos, creators, events, ads and settings carry over without migration.

## Admin panel (`/admin`)

| Section | What you can do |
| --- | --- |
| Overview | Counts, most-viewed videos, recent activity |
| Videos | Add / edit / delete, upload thumbnails, set category & tags, publish or keep as draft, ★ feature on the homepage |
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

## Project layout

```
server/   Express API (auth, public routes, admin routes, storage)
shared/   Types and password rules used by both server and browser
src/      React app — pages/, admin/, components/, lib/
```
