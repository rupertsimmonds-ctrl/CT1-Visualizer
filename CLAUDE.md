# CT1-Visualizer — project memory

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
Reads only the `07_HTML_Export` tab. Required columns:
`unit_id`, `floor`, `unit_no`, `bedroom_type`, `is_duplex`, `view_code`, `total_sqft`, `asking_rent_aed`, `current_asking_aed`, `asking_psf`, `status`, `agency_won`, `tranche`

Optional: `balcony`, `balcony_sqft`, `show_flat`

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

