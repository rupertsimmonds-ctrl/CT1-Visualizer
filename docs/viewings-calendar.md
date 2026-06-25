# Viewings → master log + shared tracker + calendar (wiring)

When a broker books a viewing, this app POSTs to `/api/booking`, which forwards
the JSON to a Google Apps Script web app (URL in the `CT1_BOOKING_URL` env var).
That script does three best-effort, independent things:

1. appends the **full machine row** — including external broker email and
   company — to the private master log: the **`Viewings Log`** tab of the CT1
   Leasing Control Centre (internal eyes only);
2. appends a **human row to `Sheet1`** of the shared viewings sheet (the
   tracker H&H can see) — see the slim rule below;
3. creates a **45-minute** event on the shared **City Tower** calendar (the
   calendar id is held server-side in the script — never in this repo),
   inviting the broker when an email is supplied.

## Routing + the slim rule

Both front-ends post to the same script; the **`source`** field decides how the
shared-tracker row is written:

- `source` contains `visualiser`/`visualizer` (this app sends
  `source: 'CT1 Visualiser'`) → **full row**: engage ref, bh agent name + email.
- anything else — the external broker hub (`source: 'broker-hub'`) or an
  untagged caller → **slim row**: broker **name only**. No email, no company,
  no engage ref. External brokers' contact details never reach the shared
  sheet; they live only in the Control Centre master log.

The legacy `Viewings` tab on the shared sheet was deleted on 12 June 2026 —
its rows were migrated into `Viewings Log`.

## Sheet1 layout contract (don't break this)

The shared tracker is a formatted human sheet: banner rows on top, the real
column headers a few rows down (**row 4** today), data below. The script:

- finds the header row by looking for a **"Client Name"** cell in the top 10
  rows — renaming that header breaks logging;
- maps payload fields onto the tracker's own headers by normalised name
  (`Date Requested`, `Engage Lead Reference`, `Client Name`, `Mobile (Last 4)`,
  `Date`, `Time`, `Agent`, `Number of Bed`, `Unit`, `Email`, `Source`), filling
  each header once;
- writes directly under the **last filled Client Name** (never `appendRow`,
  which can drop rows into a gap below stray content).

## One script, two front-ends, two deployments

The Apps Script ("Calendar Booking via visualizer", standalone, owned in
Google Drive) is **shared** with the external brokers hub:

| Front-end | Repo | Vercel project | Booking env |
| --- | --- | --- | --- |
| Broker visualiser (this repo) | `rupertsimmonds-ctrl/CT1-Visualizer` | `ct-1-visualizer-d27g` | `CT1_BOOKING_URL` |
| External brokers hub | `rupertsimmonds-ctrl/City-Tower-Broker-Hub` | `city-tower-broker-hub-ext` | (its own booking env) |

⚠️ The script project has **two** web-app `/exec` deployments (the two apps may
point at either). When the script changes, bump **both** deployments to the new
version — Deploy → Manage deployments → ✏️ → New version on each, or via the
Apps Script API. Both were pinned to the same version (v9) on 12 June 2026.

> The repo previously deployed as two Vercel projects; the spare
> (`ct-1-visualizer`) is retired — brokers use `ct-1-visualizer-d27g`.

## Wiring checklist

1. Get the shared web-app `…/exec` URL (Apps Script → Deploy → Manage
   deployments).
2. Set `CT1_BOOKING_URL` to that URL on the visualiser Vercel project
   (Production + Preview), then redeploy.
3. The shared sheet's `Sheet1` header row must keep the column names listed
   above (extra columns are fine — unknown headers are left blank).
4. The `Viewings Log` master tab is auto-created/seeded by the script if it's
   ever missing.
5. The script's Google account needs **"Make changes to events"** on the shared
   calendar; the script project timezone should be **Asia/Dubai**.

## Payload this app sends

`unit_id · unit_label · bedroom_type · viewing_date (YYYY-MM-DD) ·
viewing_time (HH:MM) · engage_ref · applicant_name · mobile_last4 · broker ·
broker_email (optional) · source: 'CT1 Visualiser' · duration_min: 45`

(The script uses its own 45-minute constant, so `duration_min` is
informational. The hub additionally sends `company`, which only ever lands in
the master log.)

## Response the app reads

The booking status chip keys off `sheet` + `calendar`; `master` rides along for
the proxy's diagnostic log:

```json
{ "status": "ok",
  "master":   { "ok": true, "sheet": "Viewings Log", "appended": 13 },
  "sheet":    { "ok": true, "sheet": "Sheet1", "row": 161, "matched": 12, "external": false },
  "calendar": { "ok": true, "event_id": "…", "invited": "broker@…" } }
```

It shows `✓ Logged to viewings sheet · 45-min slot on City Tower calendar
(invite sent)` — each clause appearing only when that part reports success.
