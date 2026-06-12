# CT1 Visualizer

Live broker-facing site for City Tower 1, served on Vercel.

The site **is** the two HTML files at the repo root, served unchanged. A
tiny Next.js wrapper picks the right HTML based on user agent:

- iPhone / Android Mobile → `public/mobile.html` (= `CT1 Visualizer Mobile.html`)
- Everything else (laptop / desktop / iPad) → `public/desktop.html` (= `CT1 Visualiser.html`)

Both HTMLs already self-fetch from the Google Sheets `07_HTML_Export`
tab via gviz JSONP every 5 minutes — no server required.

## Routes

| URL | What you get |
|---|---|
| `/` | Auto-routed by user-agent (mobile or desktop) |
| `/m` or `/mobile` | Force the mobile HTML |
| `/d` or `/desktop` | Force the desktop HTML |
| `/mobile.html` / `/desktop.html` | Served directly from `public/` |

## Updating the site

When you tweak either HTML file, just commit and push. The build script
copies them into `public/` on every deploy via the `prebuild` step (or
copy them manually with `cp "CT1 Visualizer Mobile.html" public/mobile.html`).

## Deploy on Vercel

Already wired. Pushes to `main` auto-deploy.

## Floorplan data — record of the 12 Jun 2026 Control Centre cleanup

How floorplans resolve today: the `Floorplan_Catalog` tab of the CT1 Leasing
Control Centre maps `architectural_type` → `floorplan_url`; ~695 formulas on
`01_Unit_Master` look it up per unit, the result is mirrored to
`07_HTML_Export`, and both HTMLs read it from there. **Never delete
`Floorplan_Catalog`** — it is the live source of every plan link.

What the 12 Jun 2026 slim-down changed in the Control Centre:

- **Deleted**: `Backup of 01_Unit_Master`, `08_Floorplans_OLD` and
  `CT1_Unit_Level_Bridge_OLD`. The two `_OLD` tabs were the retired legacy
  path (`architectural_type` → `08_Floorplans` drive links). At deletion time
  they had zero formula references, and the mapping repo
  (`rupertsimmonds-ctrl/CT1-floorplan-mapping`, which historically WROTE
  them) had been dormant since 3 Jun — but its private code was not
  re-inspected first, hence this note.
- **Hidden, not deleted**: `Floorplan mapping rule` and the pin-instructions
  tab (doc tabs), plus an empty `Viewings` shim tab on the shared viewing
  sheet (kept so the H&H dashboard's two-tab reader can't break).

If floorplans break, check in this order:

1. `Floorplan_Catalog` still exists and `01_Unit_Master`'s `floorplan_url`
   column still holds formulas (not `#REF!`).
2. The mapping repo's README / OUTSTANDING_STATUS — if its pipeline ran again
   expecting the deleted tabs, it will have errored or recreated them empty.
3. To recover the deleted tabs: Control Centre → File → Version history →
   pick a version **before 21:31 Dubai time, 12 Jun 2026** → ⋮ → **Make a
   copy** → in the copy, right-click each tab → Copy to → Existing
   spreadsheet → the live Control Centre. Do **not** use "Restore this
   version" — that rolls back the entire sheet, including the `Viewings Log`
   master tab added the same day.
