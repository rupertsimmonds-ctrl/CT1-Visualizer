# Viewings → shared calendar + sheet (wiring)

When a broker books a viewing, this app POSTs to `/api/booking`, which forwards
the JSON to a Google Apps Script web app (URL in the `CT1_BOOKING_URL` env var).
That script does two best-effort things:

1. appends a row to the **Viewings** sheet, and
2. creates a **30-minute** event on the shared **City Tower** calendar (the
   calendar id is held server-side in the script — never in this repo),
   inviting the broker when an email is supplied.

## One script, two front-ends

The Apps Script ("Calendar Booking via visualizer", owned in Google Drive) is
**shared** with the external brokers hub. Both apps post to the **same**
`/exec` deployment, so bookings land on the same calendar + sheet:

| Front-end | Repo | Vercel project(s) | Booking env |
| --- | --- | --- | --- |
| Broker visualiser (this repo) | `rupertsimmonds-ctrl/CT1-Visualizer` | `ct-1-visualizer` **and** `ct-1-visualizer-d27g` | `CT1_BOOKING_URL` |
| External brokers hub | `rupertsimmonds-ctrl/City-Tower-Broker-Hub` | `city-tower-broker-hub-ext` | (its own booking env) |

The script tells them apart via a **`source`** column — this app sends
`source: 'CT1 Visualiser'`.

> ⚠️ **This repo is imported as TWO Vercel projects** (`ct-1-visualizer` and
> `ct-1-visualizer-d27g`), both auto-deploying this repo's branch. They share
> code, but **env vars are per-project** — so `CT1_BOOKING_URL` must be set to
> the same `/exec` URL on **both**, or delete the spare project to avoid drift.

## Wiring checklist

1. Get the shared web-app `…/exec` URL (from the external hub's booking env, or
   the Apps Script → Deploy → Manage deployments).
2. Set `CT1_BOOKING_URL` to that URL on **both** visualiser Vercel projects
   (Production + Preview), then redeploy.
3. Make sure the **Viewings** sheet header row has columns for everything both
   apps send (the script maps by header, with aliases): at least `source`,
   `engage_ref`, `broker_email`, plus the shared unit/date/time/applicant fields.
4. The script's Google account needs **"Make changes to events"** on the shared
   calendar; the script project timezone should be **Asia/Dubai**.

## Payload this app sends

`unit_id · unit_label · bedroom_type · viewing_date (YYYY-MM-DD) ·
viewing_time (HH:MM) · engage_ref · applicant_name · mobile_last4 · broker ·
broker_email (optional) · source: 'CT1 Visualiser' · duration_min: 30`

(The script uses its own 30-minute constant, so `duration_min` is informational.)

## Response the app reads

The booking status chip is tolerant of both the shared script's shape and the
older logger's flat shape:

```json
{ "status": "ok",
  "sheet":    { "ok": true, "appended": 13 },
  "calendar": { "ok": true, "event_id": "…", "invited": "broker@…" } }
```

It shows `✓ Logged to viewings sheet · 30-min slot on City Tower calendar
(invite sent)` — each clause appearing only when that part reports success.
