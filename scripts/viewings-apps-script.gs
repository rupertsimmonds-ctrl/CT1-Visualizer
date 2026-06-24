/* ⚠️ MIRROR OF THE DEPLOYED v9 SCRIPT — reference only, NOT the source of truth.
 * The live logger is the standalone Apps Script project "Calendar Booking via
 * visualizer" in Google Drive. This file is kept in step so the repo documents
 * what actually runs. Two IDs are REDACTED here and exist only in the deployed
 * project: the shared viewings-sheet ID and the City Tower calendar ID.
 * To deploy a change: paste into the Apps Script editor, fill the two redacted
 * IDs, then bump BOTH /exec deployments (see docs/viewings-calendar.md).
 * (Last synced from deployment on 2026-06-24.)
 */

/**
 * CT1 Viewings logger — Google Apps Script web app.
 *
 * Receives a JSON POST from /api/booking (the Next.js proxy on the broker
 * hub AND the internal visualiser) and, for each viewing request:
 *   1. appends the FULL machine row — including external broker email and
 *      company — to the private master log: the `Viewings Log` tab of the
 *      CT1 Leasing Control Centre. Internal eyes only.
 *   2. appends a human row to the shared team tracker (Sheet1 of the shared
 *      viewings sheet, which H&H can see):
 *        • visualiser bookings → full row (bh agent name + email);
 *        • external broker hub, or anything untagged → SLIM row: broker
 *          name only — no email, no company. External brokers' contact
 *          details never reach the shared sheet.
 *   3. creates a 30-minute event on the shared "City Tower" calendar and
 *      invites the requesting broker (so it lands on their diary too).
 * All three steps are best-effort and independent — each failure is reported
 * in the response without blocking the others.
 *
 * Payload keys the apps send (every request):
 *   timestamp · unit_id · unit_label · bedroom_type · viewing_date ·
 *   viewing_time · engage_ref · company · broker · broker_email ·
 *   applicant_name · mobile_last4 · source
 */

// Private master log: CT1 Leasing Control Centre → `Viewings Log` tab.
const CONTROL_CENTRE_ID = '1FOofWcGkSXXnBWZ70dB7tix9T5lHjV3BL8evePp-URk';
const MASTER_SHEET_NAME = 'Viewings Log';

// Shared viewings sheet (visible to H&H) — Sheet1 is the human tracker.
const SPREADSHEET_ID = 'REDACTED_SHARED_VIEWINGS_SHEET_ID'; // real value in the deployed project only

// The shared "City Tower" calendar ID (…@group.calendar.google.com).
const CALENDAR_ID = 'REDACTED_SHARED_CALENDAR_ID'; // held server-side only — never commit (see docs/viewings-calendar.md)
const VIEWING_DURATION_MIN = 30;

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ status: 'error', message: 'no body' });
    }
    const data = JSON.parse(e.postData.contents);

    // All targets are best-effort + independent — wrap each so one failing
    // (e.g. no sheet) never blocks the others (e.g. the calendar).
    let master = { ok: false, message: 'not attempted' };
    try {
      master = appendToMasterLog(data);
    } catch (err) {
      master = { ok: false, message: String(err) };
    }
    let sheet = { ok: false, message: 'not attempted' };
    try {
      sheet = appendToSheet(data);
    } catch (err) {
      sheet = { ok: false, message: String(err) };
    }
    let calendar = { ok: false, message: 'not attempted' };
    try {
      calendar = createViewingEvent(data);
    } catch (err) {
      calendar = { ok: false, message: String(err) };
    }

    // `status` keys off the surfaces the booking chip cares about (tracker +
    // calendar); the master result rides along for the proxy's log.
    return jsonOut({
      status: sheet.ok || calendar.ok ? 'ok' : 'error',
      master: master,
      sheet: sheet,
      calendar: calendar,
    });
  } catch (err) {
    return jsonOut({ status: 'error', message: String(err) });
  }
}

// Every booking from both apps → full-fidelity machine row in the private
// master log. This is the ONLY place external broker emails/companies are
// stored. Creates + seeds the tab if it's ever missing.
function appendToMasterLog(data) {
  const FIELDS = ['timestamp', 'unit_id', 'unit_label', 'bedroom_type', 'viewing_date', 'viewing_time', 'engage_ref', 'company', 'broker', 'broker_email', 'applicant_name', 'mobile_last4', 'source'];
  const ss = SpreadsheetApp.openById(CONTROL_CENTRE_ID);
  let sheet = ss.getSheetByName(MASTER_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(MASTER_SHEET_NAME);
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, FIELDS.length).setValues([FIELDS]);
  }
  const row = FIELDS.map(function (k) {
    const v = data[k];
    return v == null ? '' : String(v);
  });
  sheet.appendRow(row);
  return { ok: true, sheet: sheet.getName(), appended: row.length };
}

// Shared tracker router: visualiser bookings (source contains "visualiser"/
// "visualizer") keep their full row. Everything else — the external broker
// hub, or anything untagged — is treated as external and slimmed, so the
// privacy default is to strip.
function appendToSheet(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss) {
    return { ok: false, message: 'no spreadsheet — set SPREADSHEET_ID at the top of the script' };
  }
  const src = String(data.source || '').toLowerCase();
  const fromVisualiser = src.indexOf('visualiser') !== -1 || src.indexOf('visualizer') !== -1;
  return appendToTracker(ss, data, !fromVisualiser);
}

// The team tracker (the "Sheet1" tab, else the leftmost tab) is a formatted
// human sheet: banner rows on top, the real column headers a few rows down
// (row 4 today), data below. So instead of assuming headers live on row 1:
//   1. find the header row — the first of the top 10 rows containing a
//      "Client Name" cell;
//   2. map the payload onto those headers (each header filled once, so the
//      two "Mobile (Last 4)" columns don't both get the client number) —
//      external rows get broker name only: no email, no engage ref;
//   3. write the row directly under the last filled Client Name — NOT via
//      appendRow(), which appends below ANY content anywhere in the sheet and
//      can drop rows into an invisible gap far past the data.
function appendToTracker(ss, data, external) {
  const sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return { ok: false, message: 'tracker (' + sheet.getName() + ') is empty' };

  const norm = function (h) {
    return String(h == null ? '' : h).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  };

  const probeRows = Math.min(10, sheet.getMaxRows());
  const probe = sheet.getRange(1, 1, probeRows, lastCol).getValues();
  let headerRow = -1;
  for (let r = 0; r < probe.length; r++) {
    if (probe[r].some(function (c) { return norm(c) === 'client_name'; })) {
      headerRow = r + 1; // 1-based
      break;
    }
  }
  if (headerRow === -1) {
    return { ok: false, message: 'tracker: no "Client Name" header in the first ' + probeRows + ' rows of ' + sheet.getName() };
  }
  const headers = probe[headerRow - 1].map(norm);

  const tz = Session.getScriptTimeZone();
  const stamp = data.timestamp ? new Date(data.timestamp) : new Date();
  const niceStamp = isNaN(stamp.getTime())
    ? String(data.timestamp || '')
    : Utilities.formatDate(stamp, tz, 'd MMMM yyyy HH:mm');
  let niceDate = String(data.viewing_date || '');
  const dm = niceDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dm) niceDate = Utilities.formatDate(new Date(+dm[1], +dm[2] - 1, +dm[3]), tz, 'd MMMM yyyy');

  // Keyed by NORMALISED tracker header (lower-case, spaces→_, punctuation
  // dropped). External rows: broker NAME only — email/engage ref stay blank,
  // and company is never written to the shared sheet at all.
  const values = {
    date_requested:        niceStamp,
    engage_lead_reference: external ? '' : (data.engage_ref || ''),
    client_name:           data.applicant_name || '',
    mobile_last_4:         data.mobile_last4 || '',
    date:                  niceDate,
    time:                  data.viewing_time || '',
    agent:                 data.broker || '',
    number_of_bed:         data.bedroom_type || '',
    unit:                  data.unit_label || data.unit_id || '',
    email:                 external ? '' : (data.broker_email || ''),
    source:                data.source || (external ? 'external' : ''),
  };

  const used = {};
  let matched = 0;
  const row = headers.map(function (h) {
    if (!(h in values) || used[h]) return '';
    used[h] = true;
    matched++;
    return String(values[h]);
  });

  // Bottom of the real data = the last filled Client Name below the header
  // row (blank spacer rows in between don't fool it).
  const nameCol = headers.indexOf('client_name') + 1;
  const maxRows = sheet.getMaxRows();
  const nameVals = sheet.getRange(headerRow + 1, nameCol, maxRows - headerRow, 1).getValues();
  let lastDataRow = headerRow;
  for (let r = nameVals.length - 1; r >= 0; r--) {
    if (String(nameVals[r][0]).trim() !== '') {
      lastDataRow = headerRow + 1 + r;
      break;
    }
  }
  const target = lastDataRow + 1;
  if (target > maxRows) sheet.insertRowsAfter(maxRows, 1);
  sheet.getRange(target, 1, 1, row.length).setValues([row]);
  return { ok: true, sheet: sheet.getName(), row: target, matched: matched, external: !!external, appended: row.length };
}

// Create a calendar event for the requested slot and invite the broker.
// Returns {ok, event_id, invited} or {ok:false, message}.
function createViewingEvent(data) {
  const date = String(data.viewing_date || '').trim(); // YYYY-MM-DD
  const time = String(data.viewing_time || '').trim(); // HH:MM
  const dm = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = time.match(/^(\d{1,2}):(\d{2})/);
  if (!dm || !tm) return { ok: false, message: 'missing/invalid date or time' };

  const start = new Date(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2], 0);
  const end = new Date(start.getTime() + VIEWING_DURATION_MIN * 60 * 1000);

  const unit = data.unit_label || data.unit_id || 'unit';
  const company = data.company || '';
  const broker = data.broker || '';
  const brokerEmail = String(data.broker_email || '').trim();
  const client = data.applicant_name || '';
  const last4 = data.mobile_last4 || '';

  const title = 'City Tower 1 viewing — ' + unit + (company ? ' · ' + company : '');
  const description = [
    'City Tower 1 broker-hub viewing request',
    'Unit: ' + unit,
    'Brokerage: ' + company,
    'Broker: ' + broker + (brokerEmail ? ' <' + brokerEmail + '>' : ''),
    'Client: ' + client + (last4 ? ' (mobile ends ' + last4 + ')' : ''),
  ].join('\n');

  const cal = CALENDAR_ID
    ? CalendarApp.getCalendarById(CALENDAR_ID)
    : CalendarApp.getDefaultCalendar();
  if (!cal) return { ok: false, message: 'calendar not found: ' + (CALENDAR_ID || '(default)') };

  const options = {
    description: description,
    location: 'City Tower 1, Sheikh Zayed Road, Dubai',
  };
  // Invite the requesting broker so the viewing lands on their diary too.
  if (brokerEmail) {
    options.guests = brokerEmail;
    options.sendInvites = true;
  }

  const ev = cal.createEvent(title, start, end, options);
  return { ok: true, event_id: ev.getId(), invited: brokerEmail || null };
}

// GET handler is useful for sanity-checking the deployment from a browser.
function doGet() {
  return jsonOut({ status: 'ok', service: 'ct1-viewings-logger', version: 3 });
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
