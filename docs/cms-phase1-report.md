# Standard Gauge back office, phase 1: report

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
