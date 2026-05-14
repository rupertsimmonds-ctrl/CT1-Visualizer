/**
 * CT1 Viewings logger — Google Apps Script web app.
 *
 * Receives a JSON POST from /api/booking (the Next.js proxy on the
 * visualiser) and inserts one row immediately under the column-header
 * row of the configured tab. Adaptive to the sheet's headers — rename
 * or reorder columns without redeploying. Manually-typed rows lower
 * in the sheet are untouched; automated rows stack at the top in
 * submission order.
 *
 * How to deploy / update:
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
 *      Scope: Production (and Preview too if you want it on preview deploys)
 *   6. Redeploy the Vercel project so the env var is picked up.
 *
 *   On a subsequent code change: paste new code, save, then
 *   Deploy → Manage deployments → pencil icon → Version: New version
 *   → Deploy. The web app URL stays the same.
 *
 * Sheet layout assumptions:
 *   - The tab named SHEET_NAME contains the column headers on row
 *     HEADER_ROW (3 by default — rows 1-2 are the merged title cells
 *     'BETTER HOMES' / 'City Tower 1 | Viewing Feedback').
 *   - Data rows live at HEADER_ROW + 1 onwards. New automated rows
 *     are inserted at HEADER_ROW + 1, pushing everything else down.
 *   - Duplicate header text (e.g. two 'Mobile (Last 4)' columns for
 *     client + spouse) is handled: only the first occurrence is
 *     filled by the script — subsequent duplicates are left blank
 *     for the broker to fill manually (spouse details, etc.).
 *
 * Visualiser payload keys (every booking):
 *   timestamp · unit_id · unit_label · bedroom_type · viewing_date ·
 *   viewing_time · engage_ref · applicant_name · mobile_last4 · broker
 */

const SHEET_NAME = 'Viewings';
const HEADER_ROW = 3;

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ status: 'error', message: 'no body' });
    }
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // Prefer a tab named SHEET_NAME; fall back to the first tab so the
    // script works whatever the tab is called. The actual tab used is
    // returned in the response so it's visible from the proxy logs.
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    if (!sheet) {
      return jsonOut({ status: 'error', message: 'spreadsheet has no sheets' });
    }
    const lastCol = sheet.getLastColumn();
    if (lastCol < 1) {
      return jsonOut({ status: 'error', message: 'sheet has no columns' });
    }
    // Normalise headers: lower-case, whitespace -> underscore, drop punctuation.
    // 'Mobile (Last 4)' -> 'mobile_last_4' · 'Engage Lead Reference' ->
    // 'engage_lead_reference' · 'Number of Bed' -> 'number_of_bed'.
    const headers = sheet.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0].map(function (h) {
      return String(h == null ? '' : h)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
    });
    // Map sheet-header-strings -> payload-key. A payload key can have
    // multiple aliases so brokers don't have to match the raw JSON key.
    const aliases = {
      timestamp:       ['timestamp', 'created_at', 'logged_at', 'date_logged'],
      unit_id:         ['unit_id', 'unit', 'uid'],
      unit_label:      ['unit_label', 'unit_description'],
      bedroom_type:    ['bedroom_type', 'bedroom', 'type', 'number_of_bed', 'number_of_beds', 'beds', 'bedrooms'],
      viewing_date:    ['viewing_date', 'date', 'day'],
      viewing_time:    ['viewing_time', 'time'],
      engage_ref:      ['engage_ref', 'engage_ref_no', 'engage_lead_reference', 'lead_reference', 'reference', 'ref'],
      applicant_name:  ['applicant_name', 'applicant', 'client_name', 'name', 'first_name'],
      mobile_last4:    ['mobile_last4', 'mobile_last_4', 'mobile', 'phone_last4', 'phone'],
      broker:          ['broker', 'broker_name', 'agent', 'agent_name'],
    };
    const headerToKey = {};
    Object.keys(aliases).forEach(function (k) {
      aliases[k].forEach(function (alias) {
        // First alias to claim a header wins. If we ever have two payload
        // keys with overlapping aliases this is the deterministic resolution.
        if (headerToKey[alias] == null) headerToKey[alias] = k;
      });
    });
    // Build the row. Track which payload keys we've already written so that
    // a sheet with duplicate headers (e.g. 'Mobile (Last 4)' x2 for client +
    // spouse) only fills the first occurrence — the spouse column stays
    // blank for the broker to fill manually.
    const filled = {};
    const row = headers.map(function (h) {
      const key = headerToKey[h];
      if (!key) return '';
      if (filled[key]) return '';
      const v = data[key];
      filled[key] = true;
      return v == null ? '' : String(v);
    });
    // Insert the new row directly under the header. Manually-typed rows
    // lower in the sheet (and any previous automated rows) are shifted
    // down by one — they're never overwritten.
    const insertAt = HEADER_ROW + 1;
    sheet.insertRowBefore(insertAt);
    sheet.getRange(insertAt, 1, 1, row.length).setValues([row]);
    return jsonOut({ status: 'ok', inserted_at: insertAt, sheet: sheet.getName() });
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
