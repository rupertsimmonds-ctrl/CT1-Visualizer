# CT1 Visualizer

Live availability and unit detail for City Tower 1, served as a single responsive web app.

- **Stack:** Next.js 15 (App Router) + React 19 + Tailwind + TypeScript
- **Data source:** Google Sheets `07_HTML_Export` tab, fetched server-side via the gviz endpoint with 30-second ISR
- **Read-only.** Every refresh of the page (or every 30s on the server) re-pulls the sheet — no Apps Script, no auth, no writebacks
- **Mobile first**, responsive desktop layout above `lg`

## Local dev

```bash
npm install
npm run dev
# http://localhost:3000
```

## Deploy to Vercel

1. Go to https://vercel.com/new and import `rupertsimmonds-ctrl/ct1-visualizer`
2. Framework Preset: **Next.js** (auto-detected)
3. No environment variables needed — the sheet ID is constant and the sheet is public
4. Click **Deploy**

Default URL: `ct1-visualizer.vercel.app`. Custom domain: add it in Vercel Project Settings → Domains.

## How live updates work

- The page is rendered on the server (Vercel) and cached for 30 seconds (ISR)
- Within 30s of someone editing the Google Sheet, every visitor sees the new data
- If the sheet is unreachable, the app falls through to `public/snapshot.json` (a baked-in copy of the last known state) so the page never breaks

## Data contract

Reads only from the `07_HTML_Export` tab. Required columns:

`unit_id`, `floor`, `unit_no`, `bedroom_type`, `is_duplex`, `view_code`, `total_sqft`, `asking_rent_aed`, `current_asking_aed`, `asking_psf`, `status`, `agency_won`, `tranche`

Optional: `balcony`, `balcony_sqft`

Status classification (`status` + `agency_won` → internal code) and bedroom mapping live in `lib/classify.ts` and `lib/constants.ts`.

## Files

- `app/page.tsx` — server component, fetches the sheet
- `components/AppShell.tsx` — client shell, manages tab state and unit detail modal
- `components/Overview.tsx`, `Available.tsx`, `Info.tsx` — three tabs
- `components/UnitDetailModal.tsx` + `RentCalculator.tsx`
- `lib/sheet.ts` — gviz fetcher with snapshot fallback
- `lib/aggregate.ts` — KPI rollups and filters
- `public/snapshot.json` — fallback dataset
- `public/qr.png` — BH Brokers QR
