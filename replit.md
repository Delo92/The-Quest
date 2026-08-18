# HiFitComp — The Quest

A talent competition & voting platform where artists, models, bodybuilders, and performers compete for public votes. Dark entertainment theme with orange/amber accent (#FF5A09), Firebase auth, and Firestore as the sole database.

## Run & Operate

- **Start app:** Run the `The Quest App` workflow — it starts `NODE_ENV=development npx tsx server/index.ts` on port 5000
- `pnpm install` — install/sync all dependencies (uses pnpm, not npm)
- No SQL database — all data is in Firebase Firestore

## Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion, Wouter (routing)
- **Backend:** Express.js + TypeScript (ESM), tsx for dev
- **Auth:** Firebase Authentication (JWT Bearer tokens) — NOT Replit Auth
- **Database:** Firebase Firestore exclusively (no PostgreSQL)
- **Storage:** Firebase Storage → Google Drive sync → displayed from Drive URL (Firebase as fallback)
- **Video:** Vimeo
- **Payments:** Authorize.Net
- **Email:** Nodemailer via Gmail OAuth2

## Where Things Live

- `client/` — React frontend (Vite entry at `client/index.html`)
- `server/` — Express backend (entry: `server/index.ts`)
- `shared/` — shared types/schema between client and server
- `script/` — build scripts
- `client/public/images/template/` — template images (dark entertainment theme)

## Environment Variables (all stored as Replit env vars)

- `FIREBASE_API_KEY` — Firebase web API key
- `FIREBASE_SERVICE_ACCOUNT` — Firebase Admin SDK service account JSON
- `GOOGLE_DRIVE_CREDENTIALS` — Google Drive service account JSON (chronictv project)
- `GMAIL_CLIENT_ID` / `GMAIL_REFRESH_TOKEN` — Gmail OAuth2 for email sending
- `AUTHORIZE_NET_API_LOGIN_ID` / `AUTHORIZE_NET_TRANSACTION_KEY` / `AUTHORIZE_NET_PUBLIC_CLIENT_KEY` — payment processing
- `AUTHORIZE_NET_ENVIRONMENT` — `production`
- `VIMEO_ACCESS_TOKEN` — video uploads
- `SITE_URL` — `cbpublishing.live`

## Architecture Decisions

- **Firebase-only for auth:** Firebase Auth issues JWTs, server validates with Firebase Admin SDK. No Replit Auth, no passport-local sessions for the primary flow.
- **Image upload flow:** Firebase Storage first → Google Drive sync → display from Drive URL, with Firebase URL as fallback. `imageBackups` Firestore collection tracks `primaryUrl`, `firebaseUrl`, `storagePath`, `driveFileId` per image.
- **No SQL:** Firestore is the sole data store. The `drizzle-kit` script in `package.json` is unused/legacy.
- **pnpm for install:** npm install fails due to `websocket-driver` CVE block in Replit. Use `pnpm install` instead.

## User Roles

1. **Viewer** — public, can vote
2. **Talent** — can apply to competitions
3. **Host** — manages their own events
4. **Admin** — full platform control

## Test Accounts (seeded automatically on start)

- `viewer@test.com` — level 1 viewer
- `talent@test.com` — level 2 talent
- `host@test.com` — level 3 host
- `admin@test.com` — level 4 admin

## Gotchas

- Always use `pnpm install` not `npm install` — `websocket-driver` is blocked by Replit security policy via npm
- `nanoid` must be installed at workspace root (`pnpm add -w nanoid`) — it's imported from `server/vite.ts`
- The workflow command is `NODE_ENV=development npx tsx server/index.ts` (not `npm run dev`) since pnpm is used for installs

## User Preferences

- Dark entertainment theme matching "One Music" HTML template exactly
- Orange/amber accent (#FF5A09), black (#000) primary background
- Uppercase headings with wide letter-spacing throughout
- Firebase for all auth (NOT Replit Auth)
