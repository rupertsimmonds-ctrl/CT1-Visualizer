# CT1-Visualizer — project memory

## Brand naming conventions

**Always lowercase**: `betterhomes` and `bh`. Never `Betterhomes`, `BetterHomes`, `BH`, or `B.H.` — even at the start of a sentence, even in headings, even in tile labels. The brand is consistently lowercase.

Examples:
- ✅ `bh let`, `BH Let` *(only when paired with another acronym like H&H Let for visual symmetry — but prefer `bh let`)*
- ✅ `betterhomes`, `betterhomes × h&h`
- ❌ `Betterhomes`, `BH Let` (alone), `BH brokers`

This applies to:
- HTML files (`CT1 Visualiser.html`, `CT1 Visualizer Mobile.html`)
- Status labels (`STATUS_LABEL.reserved_bh = 'Reserved · bh'`)
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

## Status definitions (aligned mobile + desktop)
- `not_launched` → "Not launched" — pre-launch, NOT counted as available
- `marketing` → **"Listed"** — actively for lease (the primary KPI)
- `viewing` → "Viewing" — viewing booked/held
- `inflight` → "Pipeline" — offer received / negotiating
- `reserved_bh` → "Reserved · bh" — off the leasing pipeline, claimed by bh
- `reserved_hh` → "Reserved · h&h"
- `signed_bh` → "Signed · bh"
- `signed_hh` → "Signed · h&h"
- `occupied_bh` → "Occupied · bh"
- `occupied_hh` → "Occupied · h&h"
- `show_flat` → "Show flat" — designated show flat (can also overlap with Marketing)
- `lost` → "Lost"

`AVAILABLE_STATES = ['marketing', 'viewing', 'inflight']` — does NOT include `not_launched`.

A unit is treated as a show flat when `u.showFlat || u.s === 'show_flat'`.
