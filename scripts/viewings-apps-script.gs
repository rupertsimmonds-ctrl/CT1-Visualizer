/**
 * CT1 Viewings logger — Google Apps Script web app.
 *
 * Receives a JSON POST from /api/booking (the Next.js proxy on the
 * visualiser) and appends one row at the bottom of the configured
 * tab — same direction the broker has been typing manual entries.
 * Adaptive to the sheet's headers — rename or reorder columns
 * without redeploying. appendRow respects manual rows: it always
 * lands after the last non-empty row, so nothing gets overwritten.
 *
 * How to deploy (standalone — hosted on a personal Gmail to dodge
 * the Better Homes Workspace policy that blocks public web apps):
 *   1. Go to script.google.com signed in with a personal Gmail (NOT
 *      the Better Homes Workspace account).
 *   2. New project → paste this entire file over the default Code.gs.
 *      Save with a project name (e.g. 'CT1 Viewings Logger').
 *   3. Share the viewings spreadsheet with that personal Gmail as
 *      Editor (in the sheet: Share → add the email → Editor).
 *   4. Click Deploy → New deployment → cog → Web app.
 *      - Execute as: Me  (= the personal Gmail)
 *      - Who has access: Anyone  (last option, no qualifier)
 *   5. Copy the Web app URL (looks like https://script.google.com/macros/s/AKfycb.../exec).
 *   6. In Vercel → Project Settings → Environment Variables, add:
 *      Name:  CT1_BOOKING_URL
 *      Value: <paste the Web app URL>
 *      Scope: Production (and Preview if you want it on preview deploys)
 *   7. Redeploy the Vercel project so the env var is picked up.
 *
 *   On a subsequent code change: paste new code, save, then
 *   Deploy → New deployment (NOT 'Manage deployments' — Apps Script
 *   only lets you set the access level on first deploy). Copy the new
 *   URL into Vercel.
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

// ID of the viewings spreadsheet — extracted from the sheet URL,
// the long token between /d/ and /edit. Used by openById() so this
// script works as a standalone project (no container binding required).
// The hosting Google account must have Editor access on this sheet.
const SHEET_ID = '1j03Sg2Bux597b4Ze7mlAf1fYeTEnSNBZDVKzQUeMhvE';
const SHEET_NAME = 'Sheet1';
// Column headers live on row 4 in this sheet — rows 1-2 are the merged
// BETTER HOMES / City Tower 1 banner, row 3 is the gold divider strip.
// If you redesign the sheet so headers move, update this constant.
const HEADER_ROW = 4;

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ status: 'error', message: 'no body' });
    }
    const data = JSON.parse(e.postData.contents);
    // openById works whether the script is container-bound or standalone;
    // getActiveSpreadsheet only works for container-bound scripts, so we
    // pick openById to support hosting on a personal Gmail.
    const ss = SpreadsheetApp.openById(SHEET_ID);
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
      timestamp:       ['timestamp', 'created_at', 'logged_at', 'date_logged', 'date_requested'],
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
      filled[key] = true;
      const v = data[key];
      if (v == null) return '';

      // Dates → Date objects so the cell's existing date format ('D MMM YYYY')
      // applies. As strings the ISO form would show verbatim.
      if (key === 'timestamp') {
        const d = new Date(v);
        if (!isNaN(d.getTime())) return d;
      }
      if (key === 'viewing_date') {
        const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
      }

      // Time: visualiser sends 24-hour HH:MM. Convert to 12-hour with AM/PM
      // to match the bulk of existing manual entries ('11:00 AM', '2:00 PM').
      if (key === 'viewing_time') {
        const tm = String(v).match(/^(\d{1,2}):(\d{2})$/);
        if (tm) {
          let hh = parseInt(tm[1]);
          const mm = tm[2];
          const ampm = hh >= 12 ? 'PM' : 'AM';
          if (hh === 0) hh = 12;
          else if (hh > 12) hh -= 12;
          return hh + ':' + mm + ' ' + ampm;
        }
      }

      // Bedroom count: visualiser sends '1 Bedroom' / 'Studio'. The column
      // mostly uses bare numerals ('1', '2', '3') with 'Studio' kept as-is.
      // Strip the trailing 'Bedroom' suffix when present.
      if (key === 'bedroom_type') {
        const bm = String(v).match(/^(\d+)\s*bedroom/i);
        if (bm) return bm[1];
      }

      const s = String(v);
      // Preserve leading zeros on identifier-style fields ('0008' for the
      // mobile last 4, etc). Without the apostrophe Sheets coerces to a
      // number and drops the zeros — '0008' becomes 8. The apostrophe is
      // the Sheets-native marker for 'force this cell to plain text';
      // hidden in display.
      if (/^0\d+$/.test(s)) return "'" + s;
      return s;
    });
    // Append at the bottom of the data range. Apps Script's appendRow
    // skips any blank rows above existing data and lands the new row
    // after the last non-empty row, so manual entries are preserved
    // and the new row stacks at the natural 'next entry' position.
    sheet.appendRow(row);
    return jsonOut({ status: 'ok', appended_at: sheet.getLastRow(), sheet: sheet.getName() });
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
