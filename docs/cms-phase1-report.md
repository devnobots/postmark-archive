# Postmark Archive back office, phase 1: report

Parts A, B and C are done, committed and pushed. Part D (accounts, keys, Vercel) was not started.
Everything below runs in **local mode** today: open the back office with `npm run dev`, then http://localhost:5173/admin/.

## 1. Done

- **A. The homepage reads `data/current.js`.** The drop and the 7 pieces moved out of `index.html` unchanged, and `?preview=edit` shows a stored draft with no access code. Before and after are pixel-identical in screenshots at 1280×880, at phone width, and on a sold piece's page, on desktop and phone. The access code is still asked. (`9b7b6db`)
- **B. The foundation files** were added as given, with two bug fixes (section 4). The seed SQL has the drop and 7 pieces. All checks pass, and the self-check says `SELFCHECK OK`. (`7ebdc8f`)
- **C baseline.** Playwright 1.64.1 is set up, and screenshots of the site at 1280×880 and 375×812 were taken before any part C code. (`8a6a299`)
- **C1. Modes and sign-in.** With both `VITE_SUPABASE_*` values set, the back office uses Supabase:
  - it uses refine's Supabase data provider,
  - sign-in is email and password,
  - after sign-in it checks `rpc('is_admin')`, and if the account isn't an admin it shows 「このアカウントには編集権限がありません」 with a sign-out button.

  Otherwise it runs in local mode: it starts from `data/current.js` and shows the 「ローカルモード」 banner with 「最初に戻す」. Routes are `/`, `/pieces/new` and `/pieces/:id` under `/admin`. (`0c1eca1`)
- **C2. The list.**
  - Pieces are grouped as: live drop, draft drops, pieces with no drop, then past drops collapsed.
  - Each row shows the color square, stamp label, title, `¥` price and status chip.
  - The red 「長すぎ」 chip comes from one title measurement per list load, cached by text.
  - ↑↓ reorder pieces within a drop, renumbering positions 1…n. (`1c3a638`)
- **C3. The editor.**
  - All 12 fields in the spec's order. Changing the category rebuilds the measurement rows and keeps matching values. The size line follows the measurements while 「自動」 is on.
  - Prices are whole yen with the number keypad. City, state and date all have inputs. There are nine ink swatches; brick sets cream price text. Photos are picked in order from the ones on the site.
  - Saving: the save bar is fixed at the bottom, and Ctrl/Cmd+S also saves. It shows 「未保存の変更があります」, and leaving the page asks first.
  - 完成 is refused until every required field is filled and the titles fit; what's missing is listed beside the button. A 下書き always saves.
  - A new piece goes into the live drop at its highest position plus one. (`fabcd44`)
- **C4. The preview.** The real `index.html?preview=edit` runs in three frames at real size, scaled down to fit:
  - **Frames:** desktop with the listing open, phone with the piece page, and the phone sheet.
  - **Choosing:** a segmented control picks the large one.
  - **Refresh:** 400 ms after typing stops, using `location.replace` so the frames' history doesn't grow.
  - **Other:** a 「別タブで開く」 link, and 「写真は仮です」 when no photo is picked.

  The title meter opens before the frames load. (`cce7621`)
- **C5. Fit checks.** The fit line (「スマホ 2行 ✓ · デスクトップ 2行 ✓ · 英語 1行 ✓ · ラベル ✓」) and the red problems update 150 ms after a title changes.
  - 「短い案を出す」 sends the bearer token in Supabase mode. Each idea is measured by its own part of the result, and only ideas that fit are shown, shortest first, each with 「使う」.
  - All the error messages the spec lists are in place.
  - When the stamp label is empty, a label idea is offered without any network call. (`dc5165a`)
- **C6. Publishing.** Every 完成 and 売約済 piece in the live drop is checked first; any failure is listed with links, and nothing is published.
  - **Supabase mode:** calls `/api/publish`, with the messages for `ok` and `no-hook`.
  - **Local mode:** downloads `current.js` and shows the replace-and-commit note.
  - **Empty drop:** the button is disabled, with 「完成したピースがありません」. (`17ae052`)
- **C7.** All eight required tests, plus a C1 smoke test and a reorder test, run with `npm --prefix admin test`.

## 2. Test results

All passed.

| Check | Result |
|---|---|
| `npm --prefix admin test` (13 tests) | **13 passed** (26.8 s) |
| 1. list shows today's pieces in order with prices and chips | pass |
| 2. edit price, save, reload; phone preview buy bar shows ¥15,400 | pass |
| 3. long title flagged within 1 s; 完成 refused; 下書き saves | pass |
| 4. stubbed ideas: only the one that fits is shown; 使う fills the field | pass |
| 5. new sock piece, 自動 off, `フリー · 23–27 cm` on the stamp | pass |
| 6. local 公開 downloads `current.js`; served as `data/current.js`, the site shows ¥15,400 | pass |
| 7. 375×812: no sideways scroll, every control ≥ 44 px (both tabs, existing and new piece) | pass |
| 8. site still asks for the code and matches the baseline at 1280×880 and 375×812 (0 differing pixels) | pass |
| extra: local mode banner and routes; ↑↓ reorder survives reload | pass |
| `node tools/tests/check_data.mjs` | `data ok: 7 pieces convert both ways; drafts stay off the site` |
| `node tools/tests/check_local.mjs` | `local mode ok; categories match the database file` |
| `node tools/tests/check_api.mjs` | `api ok: admins only, missing settings reported, answers cleaned` |
| `python3 tools/check_titles.py data/current.js drops.html` | `titles ok (14 checked)` |
| `/admin/selfcheck.html` | `SELFCHECK OK`, all 7 titles fit, long title flagged, `title ideas: waiting for the Anthropic key (step D)` |
| `npm run build` | `data/current.js: no database settings, using the committed file`, `site copied to dist/`, `✓ built in 473ms` |
| A5 `git diff --stat` | exactly as the spec says (44 lines, 15+/29−; check_titles 14) |

## 3. Not done or failing

Nothing is failing. Not done, as the spec says: part D (Supabase, Vercel, keys, publish hook, Anthropic key, moving off GitHub Pages).

**Not tested yet:** the Supabase mode screens (sign-in, admin check, `/api/publish`). They need a real project, so they can only be tried in step D2.

**Older tools no longer work.** The pieces moved out of `index.html` in part A, so these scripts can no longer find them:
- `tools/stamp_colors.py`: it reads the pieces and their photo paths from `index.html`. With `data/current.js` its photo paths would point into `data/`.
- `apply_listing_data.py` and `set_demo_prices.py`: same reason.

Phase 2 picks stamp colors in the back office anyway. Until then, see section 6.

## 4. Changes to tested files

1. **`admin/src/lib/measure.mjs`:**
   - **What was wrong:** the hidden measuring frames show a classic scrollbar in browsers set to always show scroll bars (headless Chrome, a Mac with a mouse, or with "Always" chosen). That made the 320px frame 305px wide, so three of today's titles measured 3 lines and the self-check failed: `SELFCHECK FAILED` on the tee, the bag and the neck warmer.
   - **Fix:** one line, `doc.documentElement.style.scrollbarWidth = 'none'` on each frame. Phones have no scrollbar gutter, so this measures what a phone shows.
2. **`tools/build_site.mjs`:**
   - **What was wrong:** `new URL(import.meta.url).pathname` keeps `%20`, so the build failed with `EACCES … mkdir '/Volumes/500GB%20External/…/dist'` in any folder whose path has a space. Vercel's folder has none, so it would have passed there.
   - **Fix:** `fileURLToPath(import.meta.url)`.

## 5. Decisions I made

- **Node:** npm 10.8.2 (with Node 20.20) crashed during `npm install` with `Cannot read properties of null (reading 'edgesOut')`, an npm bug. I installed Node 22.23 LTS with nvm and used it for this work. Your default Node is unchanged (20.20).
- **Forms:** I used react-hook-form's `useForm` directly, with refine's `useOne`, `useList`, `useCreate` and `useUpdate`, instead of refine's form wrapper. This keeps the editor's live preview and fit checks simple.
- **Fonts:** the back office adds the site's Google Fonts link from `main.jsx`, rather than editing the tested `admin/index.html`.
- **List groups:** live drop, then drafts (drops with status `draft`), then 「便なし」 (pieces with no drop, shown only if any), then past drops, collapsed.
- **Reordering:** moving a piece renumbers its drop 1…n, so gaps and ties never stick.
- **自動 switch:** it's a 44 px toggle button, not a small checkbox (the 44 px rule).
- **Measurements:** each value input takes a number and is stored as `"70 cm"`. `対応サイズ` is stored as typed. 「＋ 寸法を追加」 adds a row with a name field.
- **Custom rows:** changing the category drops any custom measurement rows, keeping only the category's labels with their existing values.
- **City:** shown and saved in capitals.
- **Price:** anything that isn't a digit is removed while typing, and 0 is refused.
- **A sold piece:** its status shows as 売約済 text, with no buttons (marking sold is phase 3).
- **Preview frames:** they are `inert` and ignore clicks. The site focuses its close button when a listing opens, which inside a frame would take the cursor out of the form, so the preview hands focus straight back. Typing is never interrupted; this is tested.
- **Preview size:** the large frame fits the pane width but is never taller than the window. The two smaller frames sit beside it or below it.
- **Preview scrollbars:** the frames hide their scrollbars, so the phone frames are exactly 375 px, as on a phone.
- **Reloading frames:** each preview reload adds `&r=N` to the address. Without it, a reload whose address only changed after the `#` would not reload the page.
- **Meter sample:** the title meter uses the piece being edited if it has an English title, otherwise the first piece of the live drop with one. A piece without an English title has no address to open in the meter.
- **Leaving the page:** with unsaved changes, links in the back office ask first, and closing the tab asks via the browser. React Router's leave-page blocker needs its data router, which the spec's setup doesn't use, so links are checked with a simple confirm instead.
- **Publish message:** a failed check lists each piece with a link and its problems: missing fields plus title problems.

## 6. Site changes I'd suggest (not done)

- **Stamp-color tool:** let `tools/stamp_colors.py` read `data/current.js` and resolve photo paths from the site folder. Otherwise the stamp color rule can't run on new pieces until phase 2 adds it to the back office.
- **Older one-off tools:** update or retire `apply_listing_data.py`, `set_demo_prices.py` and `apply_drop_tie.py`, which still look for the pieces in `index.html`.
- **Close-button focus:** optional. When `SG_PREVIEW` is set, the site could skip focusing the listing's close button. The back office handles it today, so this is only for tidiness.

## 7. Ready for part D

`admin/.env.example` lists every setting the code reads:

| Setting | Read by |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | the back office in the browser (`admin/src/config.js`); both set = Supabase mode |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | `/api/suggest-titles` and `/api/publish` (admin check) |
| `SUPABASE_SECRET_KEY` | `tools/build_site.mjs` only (Vercel build) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | `/api/suggest-titles` |
| `VERCEL_DEPLOY_HOOK_URL` | `/api/publish` |

`LOCAL_DEV=1` is set by the dev server itself and is not a setting. No key is in any committed file, and no `.env.local` exists.

## 8. Screenshots

In `admin/tests/screenshots/` (retake with `cd admin && node tests/take-screenshots.mjs` while `npm run dev` is running):

- `list-375.png`, `list-1280.png`
- `editor-375-input.png`, `editor-375-preview.png`, `editor-1280.png`
- `editor-long-title.png`: the long test title from test 3, with its problems
- `editor-title-ideas.png`: the stubbed title ideas from test 4 (only the ones that fit)

## Update 2026-10-17: the back office is in English

The person running the back office reads English, so all of the back office's own text is now English (buttons, labels, status chips Draft / Ready / Sold, "Drop 12", messages, the fit line and its problems, sign-in). What shoppers see stays Japanese: the public site, and the content typed into the back office (Japanese title, stamp label, measurement names, condition notes). Category names show in English; each measurement name shows its English meaning beside it (着丈 · length). This also changed the problem messages in the tested `admin/src/lib/measure.mjs` (wording only) and the `<html lang>`/title of `admin/index.html`. All 13 Playwright tests, the three checks and the self-check pass; screenshots in `admin/tests/screenshots/` were retaken.

## Update 2026-10-17: stamp color tool works again

`tools/stamp_colors.py` now reads `data/current.js` (run `.venv-tools/bin/python tools/stamp_colors.py data/current.js --dry-run`, then without `--dry-run`). It reads both forms of the file: the hand-written JS list it has today and the JSON the back office publishes, and it finds photos from the site folder. The color rule itself is unchanged; a dry run gives all 7 pieces the colors they already have.

# Phases 2 and 3 (2026-10-17)

Everything below happens in the back office or on the hosting. Nothing needs a terminal while the store runs.

## What the back office does now

**Photos (phase 2)**
- **Add photo:** opens the phone's camera or photo library. The background is removed in the browser:
  - **How:** the backdrop's colors come from the photo's border. Texture stops the removal at white fabric, so white cuffs and white patches stay. A pair (socks) is kept whole. Soft shadows are removed.
  - **Tested:** on all 8 original photos, every result matches the site's existing cutout in shape.
- **Check the cutout:** shows the cutout on the stamp color, a checkerboard or dark. Tap to zoom in on the edges. A "Background removal" slider adjusts how much is removed. Rotate left or right.
- **Choosing:** "Use cutout", or "Use whole photo", which fills the stamp.
- **Web sizes are made automatically:**
  - stamp photo: at most 640px, transparent WebP (PNG where the browser can't write WebP),
  - large photo: at most 2400px, JPEG, enough for the 3× loupe.

  24MP phone photos are scaled down while reading, so phones don't run out of memory.
- **Managing photos:** reorder with ↑↓, remove, or add a photo already on the site. The first photo is the stamp photo.

**Stamp colors (phase 2)**
- **Set by the rule only, never by eye:** the same 9 inks and scoring as `tools/stamp_colors.py`, running in the browser (`admin/src/lib/colors.mjs`).
  - **When:** the editor shows the rule's ink as soon as there's a stamp photo. Saving also updates any other piece in the drop the rule changes, and Publish applies the rule to the whole live drop.
  - **Too many pieces:** a drop with more pieces than inks is refused, with a message.
- **Stable results:** the browser version clusters colors from 8 starting points and keeps the best fit, so the same photos always give the same colors.
  - **The one difference:** for today's pieces it agrees with the Python tool on 5 of 7. The bag and the bucket hat are a near-tie (143.8 vs 142.2 points), and at the next publish they will swap mustard and peach. Python's own first run on these photos made the same choice the browser makes.

**Drops and archive (phase 3)**
- **Drops page:**
  - **New drop:** the number is filled in. Set the release date, add pieces to it, and preview the whole drop as the homepage and the phone list.
  - **"Make this the live drop":** the current drop becomes a past drop in the same step, and its unsold pieces move into the new drop and stay for sale.
- **Ordering:** drag pieces by the ⠿ handle (finger or mouse), or use ↑↓.
- **Sold:** with the buyer's Instagram handle, or as a private collection (個人蔵). The handle is shown as `CONSIGNEE: @handle` on desktop and in the 収蔵先 row on the phone.
- **History:** every save keeps the version before it, and "Restore" puts one back; a restore can itself be undone. Deleted pieces appear under "Recently deleted" and can be restored as a draft.
- **The past-drops page reads `data/past.js`.** It was tested pixel-identical on desktop, on phone, and on two sold piece pages. Publish writes both `data/current.js` and `data/past.js`.

**Hosting**
- **Data files:** the build writes both data files from the database.
- **Photos:** uploaded photos are copied into the site (`assets/u/`), so visitors only load the site's own files.

## Tests

- **Playwright:** `npm --prefix admin test` runs **29 tests, all passing**, including:
  - **Photos:** upload and the cutout check, a 24MP photo becoming 2400×1600 plus a 640px stamp photo, and using a whole photo.
  - **Colors:** the color rule in the editor and on save.
  - **Drops:** a full drop cycle (build, preview, make live, publish both files, then the homepage and past-drops page with those files).
  - **Pieces:** sold with a handle and with 個人蔵, history restore, delete and restore, drag to reorder.
  - **Phone fit:** no sideways scroll and 44px controls on the list, drops page and cutout check.
  - **Site unchanged:** the pixel checks of the homepage and the past-drops page still pass.
- **Check scripts, all passing:**
  - `node tools/tests/check_data.mjs`, `check_local.mjs`, `check_api.mjs`
  - `check_past.mjs`: past drops convert both ways
  - `check_build.mjs`: a build against a stand-in database writes both files and copies the uploaded photos
- **Other:** `python3 tools/check_titles.py data/current.js data/past.js` passes, and `npm run build` passes.

## Decisions I made

- **Cutouts run in the browser:** the phase 2 plan named rembg and BiRefNet running on a computer, which would mean running commands. The browser cutout needs nothing installed and works on a phone.
  - **Best with:** a plain backdrop (white paper, a wall, a sheet).
  - **Busy backgrounds:** "Use whole photo" is always available.
  - **Later:** a hosted AI cutout could be added if busy backgrounds become common.
- **No manual color override:** the phase 2 plan mentioned one, but you said colors must never be chosen by eye.
- **Releasing a drop:** unsold pieces move into the new live drop and stay for sale, so the past-drops page (「すべて売約済」) only shows sold pieces.
- **Restoring a deleted piece:** it comes back as a draft (sold pieces stay sold), so nothing reappears on the site by surprise.
- **Undo:** the change history is written by the back office for every save and delete, except reordering alone. Undo is "Restore" on any earlier version.

## Not done, or only testable at part D

- **Part D:** run `supabase/migrations/0002_photos_history.sql` after `0001_init.sql`, and use the new `supabase/seed.sql`, which now includes the 3 past drops and their 10 pieces. Photo storage is the public `photos` bucket that 0002 creates; only admins can add or remove photos.
- **Needs a real project to test:** uploads to storage, the history table and the publish button in Supabase mode. Their local-mode versions are tested.
- **Local mode:** photos uploaded in local mode stay in that browser and can't be published until the database is connected. Publish says so.
- **The jeans:** the title still says ブラックデニム / "Faded Black Denim" although the photo is blue jeans. This is content for whoever writes the Japanese titles.
