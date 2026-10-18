# POSTMARK ARCHIVE

A shop selling one-of-a-kind American vintage clothing to buyers in Japan. Each piece is shown as a postage stamp. New pieces go up together in numbered "drops" (第12便), and a sold piece stays on the site with the name of who has it now.

The public site is in Japanese. The back office, where the shop is run, is in English.

## Addresses

| What | Where |
|---|---|
| Live site | https://www.postmarkarchive.com |
| Back office | https://www.postmarkarchive.com/admin |
| Vercel project (deploys, settings, domain) | https://vercel.com/stephens-projects-662cf6c0/postmark-archive |
| Supabase (database, logins, photos) | https://supabase.com/dashboard/project/bzssycsmpscoxnadzpvv |
| Domain DNS (GoDaddy) | https://dcc.godaddy.com/control/dnsmanagement?domainName=postmarkarchive.com |
| Code | https://github.com/devnobots/postmark-archive |

Visitors are asked for an access code (currently `1234`) before seeing the site. See TODO.md.

## How it works

1. The shop is run from the back office. Pieces, drops and photos are saved in Supabase.
2. **Publish** in the back office checks every piece, then asks Vercel to rebuild the site.
3. The build reads the database and writes `data/current.js` (the live drop) and `data/past.js` (past drops). It copies the photos in and publishes plain static pages.

Visitors never touch the database: they only get the built pages. Nobody needs to run a command to run the shop; everything happens in the back office or on Vercel.

## What's built

### Public site
- **Homepage:** the live drop as a fan of stamps. Hovering lifts a stamp, and clicking opens the piece.
- **Piece page:** photos with a magnifier (loupe with crosshair) for full-size images, measurements, a size line, price (shipping included), condition grade A/B/C with a note, and where and when it was found.
- **Sold pieces:** shown in black and white, marked 売約済, with a CONSIGNEE line giving the buyer's Instagram handle or PRIVATE COLLECTION (個人蔵).
- **Past drops page** (`drops.html`): every earlier drop and its sold pieces.
- **Phone layout:** a separate layout for narrow screens (`mobile.css`, `mobile.js`).
- **Stamp colors:** chosen by a fixed rule from each photo, never by eye.

### Back office (`/admin`)
- **Sign-in:** email and password. Only accounts listed as admins can edit, and public sign-ups are off.
- **Pieces:**
  - list, add, edit and delete;
  - reorder by dragging;
  - restore recently deleted pieces;
  - undo any change from a piece's history.
- **Piece editor:**
  - category templates decide which measurements are asked for;
  - a live preview in the real site at desktop and phone sizes;
  - fit checks warn when a title is too long, and **Suggest shorter titles** asks Claude for shorter ones;
  - the size line can be filled automatically.
- **Photos:**
  - upload, with a cutout tool that removes the background (or use the whole photo) and rotation;
  - web-size copies are made automatically, and 24MP photos are fine.
- **Sold:** mark a piece sold, with the buyer's Instagram handle or "Private collection".
- **Drops page:**
  - create a drop and set its release date;
  - preview it;
  - **Make this the live drop**: the old drop becomes a past drop, and its unsold pieces go back to Draft.
- **Publish:** rebuilds the live site.

## Where things are

| Folder or file | What it is |
|---|---|
| `index.html`, `drops.html`, `mobile.css`, `mobile.js` | the public site |
| `data/` | the published pieces (written by the build; don't edit by hand) |
| `assets/` | photos and images |
| `admin/` | the back office (React + refine, built with Vite) |
| `api/` | server functions on Vercel: `publish.js` (rebuild) and `suggest-titles.js` (title ideas) |
| `supabase/` | database setup (`migrations/`) and starting data (`seed.sql`) |
| `tools/` | the site build (`build_site.mjs`), the stamp color rule, and checks |
| `docs/cms-phase1-report.md` | the full build report for the back office |
| `TODO.md` | what's left to do |

## Settings

These live in Vercel → Settings → Environment Variables and are never in the code:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `VERCEL_DEPLOY_HOOK_URL`, `ANTHROPIC_API_KEY`.

## Rules the shop runs by

- Stamp colors come from the color rule only, never chosen by eye.
- Measurements come only from the category templates. A new kind of item needs a new template first.
- One piece, one drop. Unsold pieces leave the site when the next drop goes live.
- The site's name is POSTMARK ARCHIVE, always in English capitals, with no katakana name.

## For developers

- Use Node 22 for `npm`.
- `npm run dev` starts the back office in local mode at http://localhost:5173/admin/. It uses the files in `data/` and saves to the browser only, until Supabase settings are added.
- Tests:
  - `npm --prefix admin test` (Playwright, including pixel checks of the site);
  - `node tools/tests/check_*.mjs`, run from the repo root.
