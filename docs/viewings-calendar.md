# Viewings calendar — Apps Script hold

When a broker books a viewing, the app POSTs the booking to `/api/booking`,
which forwards it to the Google Apps Script web app (`CT1_BOOKING_URL`). That
script writes the viewings sheet row **and** should drop a **30-minute hold**
on the shared City Tower viewings calendar:

```
c_a17ebcd799c894eb25ad44fc2916ce387d58fe8d9f97610660d772cfadfa8ac4@group.calendar.google.com
```

The app side is already wired. Paste the snippet below into the same Apps
Script project so the event actually gets created. Until then nothing breaks —
the booking still logs to the sheet and opens WhatsApp; the app simply omits
the "slot added" confirmation.

## Payload the app sends

The booking JSON now includes everything the script needs to build the event:

| field           | example          | use                                  |
| --------------- | ---------------- | ------------------------------------ |
| `viewing_date`  | `2026-06-10`     | event start date (`YYYY-MM-DD`)      |
| `viewing_time`  | `11:00`          | event start time (`HH:MM`, 24h)      |
| `duration_min`  | `30`             | event length in minutes              |
| `unit_label`    | `07-01 · 1 Bed`  | event title                          |
| `applicant_name`| `Sarah`          | event title + description            |
| `mobile_last4`  | `0000`           | description                          |
| `engage_ref`    | `123456`         | description                          |
| `bedroom_type`  | `1 Bed`          | description                          |
| `broker`        | `Rupert`         | description                          |

## What the app expects back

Merge these keys into the JSON your `doPost` already returns. The app shows
`· 30-min slot on City Tower calendar` only when it sees `calendar: 'created'`
(or an `event_id`):

```json
{ "status": "ok", "sheet": "…", "row": 42, "calendar": "created", "event_id": "…" }
```

## Snippet (V8 runtime)

> **Set the project timezone to `Asia/Dubai`** (Project Settings → Time zone)
> so the slot lands at the local time the broker entered.

```javascript
var CT1_VIEWINGS_CALENDAR_ID =
  'c_a17ebcd799c894eb25ad44fc2916ce387d58fe8d9f97610660d772cfadfa8ac4@group.calendar.google.com';

// Creates a 30-min hold on the shared viewings calendar. Returns the keys the
// CT1 Visualiser app surfaces. Never throws — failures degrade to the sheet log.
function addViewingToCalendar(data) {
  try {
    var cal = CalendarApp.getCalendarById(CT1_VIEWINGS_CALENDAR_ID);
    if (!cal) return { calendar: 'no-access' };

    var dp = String(data.viewing_date).split('-');   // YYYY-MM-DD
    var tp = String(data.viewing_time).split(':');    // HH:MM
    var start = new Date(+dp[0], +dp[1] - 1, +dp[2], +tp[0], +tp[1], 0);
    var mins = Number(data.duration_min) || 30;
    var end = new Date(start.getTime() + mins * 60000);

    var unit = data.unit_label || data.unit_id || 'unit';
    var who = data.applicant_name || 'applicant';
    var title = 'City Tower 1 viewing — ' + unit + ' · ' + who;

    var desc = [
      'Unit: ' + unit,
      'Applicant: ' + who + (data.mobile_last4 ? ' (mobile ends ' + data.mobile_last4 + ')' : ''),
      data.bedroom_type ? 'Bedroom: ' + data.bedroom_type : '',
      data.engage_ref ? 'Engage ref: ' + data.engage_ref : '',
      data.broker ? 'Broker: ' + data.broker : '',
      'Logged via CT1 Visualiser',
    ].filter(String).join('\n');

    var ev = cal.createEvent(title, start, end, {
      description: desc,
      location: 'City Tower 1, Business Bay, Dubai',
    });

    return { calendar: 'created', event_id: ev.getId() };
  } catch (err) {
    return { calendar: 'error', calendar_error: String(err) };
  }
}
```

## Wiring it into `doPost`

After you append the sheet row, call the helper and fold its result into the
response you already return — for example:

```javascript
function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  // … your existing code that appends the row to the viewings sheet …
  // (keep returning whatever sheet/row keys you already return)

  var cal = addViewingToCalendar(data);

  var out = { status: 'ok', sheet: SHEET_NAME, row: rowNumber };
  for (var k in cal) out[k] = cal[k];   // merge calendar keys

  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
```

After pasting: **deploy a new version** of the web app (Deploy → Manage
deployments → edit → new version) so the live `CT1_BOOKING_URL` runs the
updated code. The Apps Script account must have **edit access** to the shared
calendar (add it under the calendar's *Share with specific people* settings).
