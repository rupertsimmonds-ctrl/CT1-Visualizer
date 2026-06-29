# CT1-Visualizer — project memory

## Related repo / data source
The floorplan + unit-type data this app reads is produced by a separate back-office
pipeline: **github.com/rupertsimmonds-ctrl/CT1-floorplan-mapping**. That repo audits
the architect drawings and WRITES the `01_Unit_Master`, `07_HTML_Export`, and
`08_Floorplans` tabs of the CT1 Leasing Control Centre sheet; this app only READS
that sheet. The read-path now resolves a unit's plan SOLELY from a single per-unit `floorplan_url`
column (authored on `01_Unit_Master`, mirrored to `07_HTML_Export` via VLOOKUP, which the
app reads). `floorplanFor()` reads it directly; a blank cell means "floorplan not available"
with NO fallback. The legacy `architectural_type` -> `08_Floorplans` path is retired: the
`08_Floorplans_OLD` tab was deleted in the 12 Jun 2026 Control Centre cleanup (recoverable via
sheet version history — see README "Floorplan data"), and the `/api/floorplans` route is kept
but dormant in case we ever rewire it. Product type A/B/C/D is not used here. For any floorplan/unit-data question,
start in the mapping repo (its README + OUTSTANDING_STATUS).

## Brand naming conventions

**Always lowercase**: `betterhomes` and `bh`. Never `Betterhomes`, `BetterHomes`, `BH`, or `B.H.` — even at the start of a sentence, even in headings, even in tile labels. The brand is consistently lowercase.

**Always uppercase**: `H&H` (the partner agency). Never `h&h` or `H&h`.

Examples:
- ✅ `bh let`, `H&H Let`, `betterhomes × H&H`, `Reserved · bh`, `Reserved · H&H`
- ❌ `Betterhomes`, `BH Let`, `h&h let`, `bh × h&h`

This applies to:
- HTML files (`CT1 Visualiser.html`, `CT1 Visualizer Mobile.html`)
- Status labels (`STATUS_LABEL.reserved_bh = 'Reserved · bh'`, `STATUS_LABEL.reserved_hh = 'Reserved · H&H'`)
- KPI card titles
- Comments and copy
- Any new code I write
- Commit messages and PR descriptions

## Stack
- Static HTML files served via Next.js + middleware on Vercel
- Two HTMLs: `CT1 Visualiser.html` (desktop), `CT1 Visualizer Mobile.html` (mobile)
- `prebuild` script copies them to `public/` on every Vercel deploy
- Middleware routes `/` to mobile or desktop based on user-agent
- Both HTMLs self-fetch live data from Google Sheet `07_HTML_Export` tab via gviz JSONP

## Sheet contract
The client reads the `07_HTML_Export` tab (via the `/api/units` proxy). Required columns:
`unit_id`, `floor`, `unit_no`, `bedroom_type`, `is_duplex`, `view_code`, `total_sqft`, `asking_rent_aed`, `current_asking_aed`, `asking_psf`, `status`, `agency_won`, `tranche`

Optional: `balcony`, `balcony_sqft`, `show_flat`, `floorplan_url`

Server-injected (not real `07_HTML_Export` columns — added by `app/api/units/route.ts`):
- `architectural_type` — joined from the `unit_level_bridge` tab.
- `parking` — joined from the `08_Parking_Allocation` tab on `Unit #` = `floor*100 + unit_no`. Value is the
  comma-joined bay list (e.g. `6/02,6/03`), or `""` for an allocated unit with no bays (studios). Both joins are
  best-effort: if a source tab fails to load the proxy still returns the units and the client falls back
  (parking falls back to `parkingForUnit`'s legacy derived estimate). The bay COUNT is derived from the non-empty
  bay cells (`Parking 1/2/3`), NOT the tab's `Parking spots` column, which is wrong on a couple of rows.

Status column values map to internal codes via `classifyJS` (mobile + desktop both use the same logic).

## Sheet status vocabulary

The `status` column on `01_Unit_master` / `07_HTML_Export` uses these exact strings (case-sensitive):

`Available` · `Listed` · `Reserved` · `Signed` · `Occupied` · `Lost`

(Plus `Show Flat` legacy support, though show-flatness is now driven by the separate `show_flat` column with `Y`/`Yes`/`TRUE`/`1`.)

There is **no** `Not Launched`, `Marketing`, `Viewing Booked`, `Viewing Held`, `Offer Received`, `Negotiating`, `Pipeline`, `Invoiced`. Old codes are tolerated as legacy fall-throughs in `classifyJS` for snapshot compatibility but the live sheet should not produce them.

## Status definitions (aligned mobile + desktop)

- `available` → "Available" — rentable, broker can show, NOT yet on portals
- `marketing` → **"Listed"** — actively on web portals (Bayut / Property Finder etc.) — also available
- `reserved_bh` → "Reserved · bh" — off the leasing pipeline, claimed by bh
- `reserved_hh` → "Reserved · H&H"
- `signed_bh` → "Signed · bh"
- `signed_hh` → "Signed · H&H"
- `occupied_bh` → "Occupied · bh"
- `occupied_hh` → "Occupied · H&H"
- `show_flat` → "Show flat" — legacy code; the canonical way to flag a show flat is the `show_flat` column on the sheet
- `lost` → "Lost"

The internal code `marketing` is preserved (instead of renamed to `listed`) so old snapshots and any external consumers keep working.

`AVAILABLE_STATES = ['available', 'marketing']` — both count toward the big "Available" KPI, since Listed is a sub-segment of Available promoted online.

A unit is treated as a show flat when `u.showFlat || u.s === 'show_flat'`.

## Tower colours

- `s-available`: powder-blue tint (`rgba(122,160,178,0.5)`) — subtle, signals "potential / in-house only"
- `s-marketing` (Listed): bronze (`#B39470`) — bolder, signals "actively promoted online"
- Reserved: white fill + bold bh-slate or H&H-powder inset border
- Signed/Occupied · bh: solid slate fill, with a sand center dot for occupied
- Signed/Occupied · H&H: solid powder-blue fill, with a slate center dot for occupied
- Show flat: white inset border on top of any underlying status colour
- Lost: salmon
- Duplex: gold outline

