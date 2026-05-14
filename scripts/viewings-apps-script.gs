/**
 * CT1 Viewings logger — Google Apps Script web app.
 *
 * Receives a JSON POST from /api/booking (the Next.js proxy on the
 * visualiser) and appends one row to the `Viewings` tab of this
 * spreadsheet. Adaptive to the sheet's header row, so renaming or
 * reordering columns in the sheet doesn't require any redeploy.
 *
 * How to deploy:
 *   1. Open the viewings spreadsheet
 *      → Extensions → Apps Script
 *   2. Paste this entire file into Code.gs (replacing whatever's there)
 *   3. Click Deploy → New deployment → Type: Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   4. Copy the Web app URL (looks like https://script.google.com/macros/s/AKfycb.../exec)
 *   5. In Vercel → Project Settings → Environment Variables, add:
 *      Name:  CT1_BOOKING_URL
 *      Value: <paste the Web app URL>
 *      Scope: Production (and Preview too if you want it live on preview deploys)
 *   6. Redeploy the Vercel project so the env var is picked up.
 *
 * Adding/renaming a column on the Viewings sheet later:
 *   - Just edit row 1 in the sheet. The script reads the live headers
 *     on every POST and writes whichever payload field matches (case
 *     and whitespace insensitive). Unknown headers stay blank.
 *
 * Payload keys the visualiser currently sends (every booking):
 *   timestamp · unit_id · unit_label · bedroom_type · viewing_date ·
 *   viewing_time · engage_ref · applicant_name · mobile_last4 · broker
 */

const SHEET_NAME = 'Viewings';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ status: 'error', message: 'no body' });
    }
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return jsonOut({ status: 'error', message: 'sheet not found: ' + SHEET_NAME });
    }
    const lastCol = sheet.getLastColumn();
    if (lastCol < 1) {
      return jsonOut({ status: 'error', message: 'sheet has no header row' });
    }
    // Normalise headers: lower-case, whitespace -> underscore, drop punctuation.
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
      return String(h == null ? '' : h)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
    });
    // Map each header to the matching payload field (with a few aliases
    // for column names brokers might prefer over the raw keys).
    const aliases = {
      timestamp:       ['timestamp', 'created_at', 'logged_at', 'date_logged'],
      unit_id:         ['unit_id', 'unit', 'uid'],
      unit_label:      ['unit_label', 'unit_description'],
      bedroom_type:    ['bedroom_type', 'bedroom', 'type'],
      viewing_date:    ['viewing_date', 'date', 'day'],
      viewing_time:    ['viewing_time', 'time'],
      engage_ref:      ['engage_ref', 'engage_ref_no', 'reference', 'ref'],
      applicant_name:  ['applicant_name', 'applicant', 'name', 'first_name'],
      mobile_last4:    ['mobile_last4', 'mobile', 'phone_last4', 'phone'],
      broker:          ['broker', 'broker_name', 'agent', 'agent_name'],
    };
    // Build reverse map: header -> payload key
    const headerToKey = {};
    Object.keys(aliases).forEach(function (k) {
      aliases[k].forEach(function (alias) {
        headerToKey[alias] = k;
      });
    });
    const row = headers.map(function (h) {
      const key = headerToKey[h];
      if (!key) return '';
      const v = data[key];
      return v == null ? '' : String(v);
    });
    sheet.appendRow(row);
    return jsonOut({ status: 'ok', appended: row.length });
  } catch (err) {
    return jsonOut({ status: 'error', message: String(err) });
  }
}

// GET handler is useful for sanity-checking the deployment from a browser.
function doGet() {
  return jsonOut({ status: 'ok', service: 'ct1-viewings-logger' });
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
