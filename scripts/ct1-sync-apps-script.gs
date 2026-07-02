/**
 * ============================================================
 * CT1 — Sync from Kaye's tracker → Unit Master
 * ============================================================
 * One-way sync: Kaye's file (BrightStart) → Unit Master tab on this sheet.
 *
 * MAPPING:
 *   Kaye  Status                →  Master  Status                (overwrite when Kaye has a value)
 *   Kaye  Reserved By           →  Master  Agency Won            (overwrite when Kaye has a value)
 *   Kaye  Agreed Price (AED)    →  Master  Signed Rent (AED)     (overwrite when Kaye has a value)
 *   Kaye  Agreed Date           →  Master  Signed Date           (overwrite when Kaye has a value)
 *   Kaye  Tenant Name      ┐
 *   Kaye  Lease Term       ├─→  Master  Notes  (combined as "Tenant: X | Lease: Ymo | Move-in: dd-MMM-yyyy | <Tenant Notes>")
 *   Kaye  Move-in Date     │    Overwrites Master Notes only when Kaye has at least one of the four populated.
 *   Kaye  Tenant Notes     ┘
 *
 *   Kaye  UNIT TYPE             →  Master  Bedroom Type + Duplex   (normalised: "4 BEDROOM - D" -> "4 Bedroom" + Duplex Y)
 *   Kaye  PRICING POLICY        →  Master  Current Asking (AED)    (Asking PSF recomputed from Total (sqm))
 *
 * Asking Rent (AED) — the ORIGINAL asking — is NEVER touched. A pricing-policy
 * revision updates Current Asking only, so the apps keep showing "Price
 * reduced" against the original, and the deposit (5% of base rent) follows
 * the current asking. Stage column is NEVER touched.
 *
 * VALIDATION + READ-BACK: rows that fail validation (unknown unit, bad type
 * string, non-numeric price) are skipped and listed in the alert email; after
 * writing, every written column is re-read from the sheet and compared, so a
 * silent no-op or partial write is reported loudly instead of "no changes".
 *
 * ALERTS: An HTML email is sent to ALERT_RECIPIENTS whenever the sync detects changes.
 * Set ALERT_ENABLED = false (below) to silence.
 *
 * SETUP:
 *   1. Replace KAYE_FILE_ID below with the Drive ID of Kaye's file.
 *   2. Save (Ctrl/Cmd+S). Name the project "CT1 Sync".
 *   3. In the Apps Script editor sidebar: Services → + → Drive API → Add (this enables xlsx auto-conversion).
 *   4. Reload your Google Sheet. A "CT1 Sync" menu will appear at the top.
 *   5. CT1 Sync → "Test connection" once (grant permissions when prompted).
 *   6. CT1 Sync → "Refresh from Kaye's file" any time you want to pull updates.
 *
 * To run automatically: in Apps Script, Triggers (clock icon) → Add Trigger →
 * function: syncFromKaye, event: time-driven, e.g. every hour.
 */

// ============================================================
// CONFIG — edit this section
// ============================================================
const KAYE_FILE_ID = '1WfzFMifN6QjdYSeC-nwo2WL9CRMrD37_gtjTrczagEU';  // "CT1 — Kaye Source"
const KAYE_TAB_NAME = 'Unit Status Update';
const MASTER_TAB_NAME = '01_Unit_Master';
// Pinned file ID for the Control Centre — NEVER resolve by title: three
// "archived_old_CT1_-_Leasing_Control_Centre" copies exist in Drive and a
// title lookup can silently hit the wrong one.
const MASTER_FILE_ID = '1FOofWcGkSXXnBWZ70dB7tix9T5lHjV3BL8evePp-URk';

// Kaye's tracker uses her OWN column names (exact, case-sensitive). Unit ID is
// DERIVED from "UNIT #" + "FLOOR" (e.g. 501 -> 05-01) — her sheet has no
// hyphenated Unit ID column.
const KAYE_HEADERS = {
  unitNo:      'UNIT #',
  floor:       'FLOOR',
  status:      'STATUS',
  reservedBy:  'BROKER',
  moveInDate:  'CONTRACT START DATE',
  agreedPrice: 'APPROVED RENT',
  agreedDate:  'DATE OF APPROVAL',
  tenantNotes: 'REMARKS',
  tenantName:  'TENANT NAME',
  leaseTerm:   'LEASE TERM',
  unitType:    'UNIT TYPE',
  pricingPolicy: 'PRICING POLICY',
};

const MASTER_HEADERS = {
  unitId:     'Unit ID',
  status:     'Status',
  agencyWon:  'Agency Won',
  signedRent: 'Signed Rent (AED)',
  signedDate: 'Signed Date',
  notes:      'Notes',
  bhBroker:   'BH Broker Owner',
  bedroomType:   'Bedroom Type',
  duplex:        'Duplex',
  currentAsking: 'Current Asking (AED)',
  askingPsf:     'Asking PSF',
  totalSqm:      'Total (sqm)',
};

// Exact strings the apps' BEDROOM_CODE understands. Anything else on the
// master silently renders as a studio, so writes are whitelisted.
const BEDROOM_WHITELIST = ['Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom', '4 Bedroom'];
const SQFT_PER_SQM = 10.7639104167;

// Bright flag for a BH unit that still needs a broker name typed in. We use a
// bright fill PLUS a thick red border, because the Reserved row is already
// tinted yellow by conditional formatting — and CF overrides a plain cell
// background, so the border is what makes the prompt actually stand out.
const BH_BROKER_FLAG = '#FFFF00';     // bright yellow fill
const BH_BROKER_BORDER = '#CC0000';   // thick red border (renders over conditional formatting)

// ============================================================
// ALERT EMAIL CONFIG
// Set ALERT_ENABLED to false to disable alerts (sync still runs).
// ============================================================
const ALERT_ENABLED = true;

const ALERT_RECIPIENTS = [
  'rupert.simmonds@bhomes.com',        // Rupert Simmonds (Head of Leasing)
  'amanda.hourieh@bhomes.com',         // Amanda Hourieh (Portfolio Leasing)
  'maricris.pagdanganan@bhomes.com',   // Maricris Pagdanganan
  'darcy.buenviaje@bhomes.com',        // Darcy Buenviaje
];

// ============================================================
// MENU
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CT1 Sync')
    .addItem("Refresh from Kaye's file", 'syncFromKaye')
    .addItem('Test connection', 'testConnection')
    .addToUi();
}

// ============================================================
// MAIN
// ============================================================
function syncFromKaye() {
  const ui = SpreadsheetApp.getUi();
  const start = new Date();
  let tempFileId = null;

  try {
    const { rows, tempFileId: tid } = readKayeRows_();
    tempFileId = tid;

    if (rows.length === 0) {
      ui.alert('CT1 Sync', 'No data rows found in Kaye\'s file.', ui.ButtonSet.OK);
      return;
    }

    const result = applyToMaster_(rows);

    // Fire alert email if there were any changes
    let alertStatus = '';
    if (ALERT_ENABLED && result.changeLog && result.changeLog.length > 0) {
      try {
        const sentTo = sendAlertEmail_(result.changeLog, result);
        alertStatus = '\nAlert sent to: ' + sentTo.length + ' recipient' + (sentTo.length === 1 ? '' : 's');
      } catch (mailErr) {
        Logger.log('Alert email failed: ' + mailErr);
        alertStatus = '\n⚠ Alert email failed (sync still succeeded). See Executions for details.';
      }
    }

    const elapsed = ((new Date() - start) / 1000).toFixed(1);
    const lines = [
      '✓ Sync complete (' + elapsed + 's)',
      '',
      'Units updated:    ' + result.updated,
      'No changes:       ' + result.skipped,
      'Not in Master:    ' + result.notFound,
    ];
    if (result.brokerPrompts) {
      lines.push('BH broker to add: ' + result.brokerPrompts + ' (cells highlighted yellow)');
    }
    lines.push('Failed validation:  ' + (result.invalidRows ? result.invalidRows.length : 0));
    lines.push(result.verifyFailures && result.verifyFailures.length
      ? '⚠ READ-BACK MISMATCHES: ' + result.verifyFailures.length + ' (see email / Executions)'
      : 'Read-back verify:  OK');
    if (result.invalidRows && result.invalidRows.length) {
      lines.push('');
      lines.push('Validation failures (first 5):');
      result.invalidRows.slice(0, 5).forEach(function (r) { lines.push('  ' + r.unitId + ': ' + r.problem); });
    }
    if (result.notFoundIds.length) {
      lines.push('');
      lines.push('Unmatched Unit IDs (first 10):');
      lines.push(result.notFoundIds.slice(0, 10).join(', '));
    }
    if (alertStatus) lines.push(alertStatus);

    // Stamp last-sync into developer metadata (no impact on visible cells)
    PropertiesService.getDocumentProperties().setProperty('CT1_LAST_SYNC', new Date().toISOString());

    ui.alert('CT1 Sync', lines.join('\n'), ui.ButtonSet.OK);

  } catch (e) {
    Logger.log(e.stack);
    ui.alert('Sync failed', e.message + '\n\nSee Apps Script → Executions for full details.', ui.ButtonSet.OK);
  } finally {
    if (tempFileId) {
      try { DriveApp.getFileById(tempFileId).setTrashed(true); } catch (_) {}
    }
  }
}

function testConnection() {
  const ui = SpreadsheetApp.getUi();
  try {
    if (KAYE_FILE_ID === 'PASTE_KAYE_DRIVE_FILE_ID_HERE') {
      throw new Error('You need to set KAYE_FILE_ID at the top of the script first.');
    }
    const file = DriveApp.getFileById(KAYE_FILE_ID);
    ui.alert(
      'Connection OK',
      '✓ Found file: ' + file.getName() +
      '\nType: ' + file.getMimeType() +
      '\nLast modified: ' + file.getLastUpdated() +
      '\n\nReady to sync.',
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('Connection failed', e.message, ui.ButtonSet.OK);
  }
}

// ============================================================
// READ KAYE'S FILE
// ============================================================
function readKayeRows_() {
  if (KAYE_FILE_ID === 'PASTE_KAYE_DRIVE_FILE_ID_HERE') {
    throw new Error('Please set KAYE_FILE_ID at the top of the script.');
  }

  const file = DriveApp.getFileById(KAYE_FILE_ID);
  const mime = file.getMimeType();

  let spreadsheet;
  let tempFileId = null;

  if (mime === MimeType.GOOGLE_SHEETS) {
    spreadsheet = SpreadsheetApp.openById(KAYE_FILE_ID);

  } else if (mime === MimeType.MICROSOFT_EXCEL || mime === MimeType.MICROSOFT_EXCEL_LEGACY) {
    // xlsx → convert to a temp Google Sheet so SpreadsheetApp can read it. Deleted at the end.
    if (typeof Drive === 'undefined' || !Drive.Files) {
      throw new Error(
        'Drive Advanced Service is not enabled. In Apps Script: Services → + → Drive API → Add.'
      );
    }
    const blob = file.getBlob();
    const tempFile = Drive.Files.insert(
      { title: '__ct1_sync_temp_' + Date.now(), mimeType: MimeType.GOOGLE_SHEETS },
      blob,
      { convert: true }
    );
    tempFileId = tempFile.id;
    spreadsheet = SpreadsheetApp.openById(tempFileId);

  } else {
    throw new Error('Unsupported file type. Expected Google Sheet or xlsx, got: ' + mime);
  }

  const sheet = spreadsheet.getSheetByName(KAYE_TAB_NAME);
  if (!sheet) {
    const tabs = spreadsheet.getSheets().map(function (s) { return s.getName(); }).join(', ');
    throw new Error('Tab "' + KAYE_TAB_NAME + '" not found in Kaye\'s file. Available tabs: ' + tabs);
  }

  // Find header row by scanning first 20 rows for "Unit ID"
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const scan = sheet.getRange(1, 1, Math.min(20, lastRow), lastCol).getValues();

  let headerRowIdx = -1;
  let headerVals = null;
  for (let i = 0; i < scan.length; i++) {
    if (scan[i].some(function (v) { return String(v).trim() === KAYE_HEADERS.unitNo; })) {
      headerRowIdx = i;
      headerVals = scan[i].map(function (v) { return String(v).trim(); });
      break;
    }
  }
  if (headerRowIdx === -1) {
    throw new Error('Could not find "' + KAYE_HEADERS.unitNo + '" header in Kaye\'s file (scanned first 20 rows).');
  }

  const cIdx = {};
  Object.keys(KAYE_HEADERS).forEach(function (key) {
    const wanted = KAYE_HEADERS[key];
    const idx = headerVals.indexOf(wanted);
    if (idx === -1) {
      throw new Error('Header "' + wanted + '" not found in Kaye\'s file. Found: ' + headerVals.filter(Boolean).join(', '));
    }
    cIdx[key] = idx;
  });

  const dataStart = headerRowIdx + 2; // 1-indexed, +1 for header row, +1 to get to next row
  if (lastRow < dataStart) return { rows: [], tempFileId: tempFileId };

  const data = sheet.getRange(dataStart, 1, lastRow - dataStart + 1, lastCol).getValues();

  const rows = data
    .map(function (r) {
      return {
        unitId:      unitIdFromKaye_(r[cIdx.unitNo], r[cIdx.floor]),
        status:      r[cIdx.status],
        reservedBy:  r[cIdx.reservedBy],
        moveInDate:  r[cIdx.moveInDate],
        agreedPrice: r[cIdx.agreedPrice],
        agreedDate:  r[cIdx.agreedDate],
        tenantNotes: r[cIdx.tenantNotes],
        tenantName:  r[cIdx.tenantName],
        leaseTerm:   r[cIdx.leaseTerm],
        unitType:    r[cIdx.unitType],
        pricingPolicy: r[cIdx.pricingPolicy],
      };
    })
    .filter(function (r) { return r.unitId; });

  return { rows: rows, tempFileId: tempFileId };
}

// ============================================================
// APPLY TO MASTER (surgical column writes — preserves formulas in untouched columns)
// ============================================================
function applyToMaster_(kayeRows) {
  const ss = SpreadsheetApp.openById(MASTER_FILE_ID);
  const master = ss.getSheetByName(MASTER_TAB_NAME);
  if (!master) {
    const tabs = ss.getSheets().map(function (s) { return s.getName(); }).join(', ');
    throw new Error('Tab "' + MASTER_TAB_NAME + '" not found. Available tabs: ' + tabs);
  }

  const lastRow = master.getLastRow();
  const lastCol = master.getLastColumn();

  // Find header row by scanning first 20 rows for "Unit ID"
  const scan = master.getRange(1, 1, Math.min(20, lastRow), lastCol).getValues();
  let headerRowIdx = -1;
  let headerVals = null;
  for (let i = 0; i < scan.length; i++) {
    if (scan[i].some(function (v) { return String(v).trim() === MASTER_HEADERS.unitId; })) {
      headerRowIdx = i;
      headerVals = scan[i].map(function (v) { return String(v).trim(); });
      break;
    }
  }
  if (headerRowIdx === -1) {
    throw new Error('Could not find "' + MASTER_HEADERS.unitId + '" header in Master tab (scanned first 20 rows).');
  }

  // Unit ID + Status are required; the rest are optional — if the master lacks
  // that column we simply skip writing it (instead of failing the whole sync).
  const REQUIRED_MASTER = { unitId: true, status: true };
  const mIdx = {};
  Object.keys(MASTER_HEADERS).forEach(function (key) {
    const wanted = MASTER_HEADERS[key];
    const idx = headerVals.indexOf(wanted);
    if (idx === -1 && REQUIRED_MASTER[key]) {
      throw new Error('Required header "' + wanted + '" not found in Master tab. Found: ' + headerVals.filter(Boolean).join(', '));
    }
    mIdx[key] = idx; // 0-indexed, or -1 if an optional column is absent
  });

  const dataStart = headerRowIdx + 2; // 1-indexed
  const numRows = lastRow - headerRowIdx - 1;
  if (numRows <= 0) throw new Error('No data rows in Master tab.');

  // Read each target column individually (preserves any formulas in other columns)
  function readCol(colIdx0) {
    return master.getRange(dataStart, colIdx0 + 1, numRows, 1).getValues();
  }
  const col = {};
  ['unitId', 'status', 'agencyWon', 'signedRent', 'signedDate', 'notes', 'bhBroker',
   'bedroomType', 'duplex', 'currentAsking', 'askingPsf', 'totalSqm'].forEach(function (key) {
    col[key] = (mIdx[key] >= 0) ? readCol(mIdx[key]) : null;
  });

  // Build unit_id → row index map
  const rowByUnitId = {};
  col.unitId.forEach(function (r, i) {
    const id = String(r[0] || '').trim();
    if (id) rowByUnitId[id] = i;
  });

  let updated = 0, skipped = 0, notFound = 0;
  const notFoundIds = [];
  const dirty = { status: false, agencyWon: false, signedRent: false, signedDate: false, notes: false,
                  bedroomType: false, duplex: false, currentAsking: false, askingPsf: false };
  const invalidRows = []; // [{ unitId, problem }] — validation failures, skipped not written
  const changeLog = []; // [{ unitId, changes: [{ field, oldValue, newValue }] }]
  const bhNeedsBroker = [];  // sheet rows: BH unit, "BH Broker Owner" empty -> highlight yellow
  const bhHasBroker = [];    // sheet rows: BH unit, broker already filled -> clear highlight

  function isBlank(v) { return v === '' || v === null || v === undefined; }

  kayeRows.forEach(function (k) {
    const i = rowByUnitId[k.unitId];
    if (i === undefined) {
      notFound++;
      notFoundIds.push(k.unitId);
      return;
    }

    const unitChanges = [];

    // Status — overwrite if Kaye has a value, but NEVER downgrade Signed -> Reserved
    if (!isBlank(k.status) && col.status[i][0] !== k.status &&
        !(String(col.status[i][0]).trim() === 'Signed' && String(k.status).trim() === 'Reserved')) {
      unitChanges.push({ field: 'Status',       oldValue: col.status[i][0],     newValue: k.status });
      col.status[i][0] = k.status;
      dirty.status = true;
    }
    // Agency Won — overwrite if Kaye has a value (normalised: bh/Bh -> BH,
    // h&h -> H&H, so case drift can never break the apps' agency matching)
    const reservedBy = normalizeAgency_(k.reservedBy);
    if (col.agencyWon && !isBlank(reservedBy) && col.agencyWon[i][0] !== reservedBy) {
      unitChanges.push({ field: 'Agency Won',   oldValue: col.agencyWon[i][0],  newValue: reservedBy });
      col.agencyWon[i][0] = reservedBy;
      dirty.agencyWon = true;
    }
    // Signed Rent — only when the unit is Signed (the master column is "Signed Rent")
    if (col.signedRent && !isBlank(k.agreedPrice) && String(k.status).trim() === 'Signed' &&
        col.signedRent[i][0] !== k.agreedPrice) {
      unitChanges.push({ field: 'Signed Rent',  oldValue: col.signedRent[i][0], newValue: k.agreedPrice });
      col.signedRent[i][0] = k.agreedPrice;
      dirty.signedRent = true;
    }
    // Signed Date — only when the unit is Signed
    if (col.signedDate && !isBlank(k.agreedDate) && String(k.status).trim() === 'Signed' &&
        !sameDate_(col.signedDate[i][0], k.agreedDate)) {
      unitChanges.push({ field: 'Signed Date',  oldValue: col.signedDate[i][0], newValue: k.agreedDate });
      col.signedDate[i][0] = k.agreedDate;
      dirty.signedDate = true;
    }
    // Notes — combined tenant block. Overwrite Master Notes when Kaye has any tenant data.
    const notesBlock = buildNotesBlock_(k);
    if (col.notes && notesBlock !== null && col.notes[i][0] !== notesBlock) {
      unitChanges.push({ field: 'Notes',        oldValue: col.notes[i][0],      newValue: notesBlock });
      col.notes[i][0] = notesBlock;
      dirty.notes = true;
    }

    // Bedroom Type + Duplex — from Kaye's UNIT TYPE ("4 BEDROOM - D" etc.).
    // Whitelisted: an unparseable string is reported, never written (the apps
    // silently classify unknown strings as Studio).
    if (col.bedroomType && !isBlank(k.unitType)) {
      const parsed = parseKayeUnitType_(k.unitType);
      if (!parsed) {
        invalidRows.push({ unitId: k.unitId, problem: 'Unrecognised UNIT TYPE: "' + k.unitType + '"' });
      } else {
        if (col.bedroomType[i][0] !== parsed.label) {
          unitChanges.push({ field: 'Bedroom Type', oldValue: col.bedroomType[i][0], newValue: parsed.label });
          col.bedroomType[i][0] = parsed.label;
          dirty.bedroomType = true;
        }
        if (col.duplex) {
          const haveDup = String(col.duplex[i][0] || '').trim().toUpperCase() === 'Y';
          if (haveDup !== parsed.duplex) {
            unitChanges.push({ field: 'Duplex', oldValue: haveDup ? 'Y' : '', newValue: parsed.duplex ? 'Y' : '' });
            col.duplex[i][0] = parsed.duplex ? 'Y' : '';
            dirty.duplex = true;
          }
        }
      }
    }

    // Current Asking (AED) — from Kaye's PRICING POLICY. The ORIGINAL
    // Asking Rent (AED) is never touched (see header note). Asking PSF is
    // recomputed from Total (sqm) whenever the price changes.
    if (col.currentAsking && !isBlank(k.pricingPolicy)) {
      const price = Number(String(k.pricingPolicy).replace(/[^0-9.]/g, ''));
      if (!isFinite(price) || price < 10000) {
        invalidRows.push({ unitId: k.unitId, problem: 'Bad PRICING POLICY value: "' + k.pricingPolicy + '"' });
      } else if (Number(col.currentAsking[i][0]) !== price) {
        unitChanges.push({ field: 'Current Asking', oldValue: col.currentAsking[i][0], newValue: price });
        col.currentAsking[i][0] = price;
        dirty.currentAsking = true;
        if (col.askingPsf && col.totalSqm) {
          const psf = computePsf_(price, col.totalSqm[i][0]);
          if (psf !== null && Math.abs(Number(col.askingPsf[i][0]) - psf) > 0.005) {
            unitChanges.push({ field: 'Asking PSF', oldValue: col.askingPsf[i][0], newValue: psf });
            col.askingPsf[i][0] = psf;
            dirty.askingPsf = true;
          }
        }
      }
    }

    // BH broker prompt — Kaye's sheet has no BH broker name, so flag the cell
    // yellow to add it by hand in the Control Centre (auto-cleared once filled).
    if (mIdx.bhBroker >= 0 && col.bhBroker && String(reservedBy).trim() === 'BH') {
      if (isBlank(col.bhBroker[i][0])) bhNeedsBroker.push(dataStart + i);
      else bhHasBroker.push(dataStart + i);
    }

    if (unitChanges.length > 0) {
      updated++;
      changeLog.push({ unitId: k.unitId, changes: unitChanges });
    } else {
      skipped++;
    }
  });

  // Write back only the columns that actually changed (1 batched setValues per column)
  function writeCol(key) {
    if (!dirty[key] || mIdx[key] < 0 || !col[key]) return;
    master.getRange(dataStart, mIdx[key] + 1, numRows, 1).setValues(col[key]);
  }
  writeCol('status');
  writeCol('agencyWon');
  writeCol('signedRent');
  writeCol('signedDate');
  writeCol('notes');
  writeCol('bedroomType');
  writeCol('duplex');
  writeCol('currentAsking');
  writeCol('askingPsf');

  // READ-BACK VERIFICATION — re-read every written column from the sheet and
  // compare against what we intended to write. A silent no-op or partial
  // write surfaces here instead of hiding behind "no changes".
  const verifyFailures = [];
  Object.keys(dirty).forEach(function (key) {
    if (!dirty[key] || mIdx[key] < 0 || !col[key]) return;
    const now = master.getRange(dataStart, mIdx[key] + 1, numRows, 1).getValues();
    for (let i = 0; i < numRows; i++) {
      const want = col[key][i][0], got = now[i][0];
      const same = (want instanceof Date || got instanceof Date)
        ? sameDate_(want, got)
        : (typeof want === 'number' || typeof got === 'number')
          ? Math.abs(Number(want) - Number(got)) < 1e-6
          : String(want == null ? '' : want) === String(got == null ? '' : got);
      if (!same && verifyFailures.length < 20) {
        verifyFailures.push({ column: MASTER_HEADERS[key], row: dataStart + i, wanted: String(want), got: String(got) });
      }
    }
  });

  // BH broker prompt: bright fill + thick red border so it stands out on the
  // already-yellow Reserved row (CF overrides fills, so the border carries it);
  // both are cleared once a broker name is filled in.
  if (mIdx.bhBroker >= 0) {
    bhNeedsBroker.forEach(function (row) {
      var cell = master.getRange(row, mIdx.bhBroker + 1);
      cell.setBackground(BH_BROKER_FLAG);
      cell.setBorder(true, true, true, true, false, false, BH_BROKER_BORDER, SpreadsheetApp.BorderStyle.SOLID_THICK);
    });
    bhHasBroker.forEach(function (row) {
      var cell = master.getRange(row, mIdx.bhBroker + 1);
      cell.setBackground(null);
      cell.setBorder(false, false, false, false, false, false);
    });
  }

  return { updated: updated, skipped: skipped, notFound: notFound, notFoundIds: notFoundIds,
           changeLog: changeLog, brokerPrompts: bhNeedsBroker.length,
           invalidRows: invalidRows, verifyFailures: verifyFailures };
}

function sameDate_(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

/** Kaye's "UNIT #" (501, 1806…) + "FLOOR" -> master Unit ID ("05-01", "18-06"). */
function unitIdFromKaye_(unitNo, floor) {
  const digits = String(unitNo == null ? '' : unitNo).replace(/\D/g, '');
  if (digits.length < 3) return '';
  const unit = digits.slice(-2);
  let fl = String(floor == null ? '' : floor).replace(/\D/g, '');
  if (!fl) fl = digits.slice(0, -2);
  fl = String(parseInt(fl, 10));
  if (fl === 'NaN') return '';
  return (fl.length < 2 ? '0' + fl : fl) + '-' + unit;
}

/**
 * Builds the Notes cell content from Kaye's four tenant fields.
 * Skips any sub-field that's blank. Returns null if all four are blank
 * (so we don't overwrite Master Notes for units Kaye isn't tracking).
 *
 * Example outputs:
 *   "Tenant: John Smith | Lease: 24mo | Move-in: 01-Jun-2026 | VIP referral"
 *   "Tenant: Acme Holdings"  (only name populated)
 *   null                       (all four blank)
 */
function buildNotesBlock_(k) {
  const parts = [];

  if (!(k.tenantName === '' || k.tenantName == null)) {
    parts.push('Tenant: ' + String(k.tenantName).trim());
  }
  if (!(k.leaseTerm === '' || k.leaseTerm == null)) {
    parts.push('Lease: ' + String(k.leaseTerm).replace(/\s*months?\s*$/i, '').trim() + 'mo');
  }
  if (!(k.moveInDate === '' || k.moveInDate == null)) {
    parts.push('Move-in: ' + formatDate_(k.moveInDate));
  }
  if (!(k.tenantNotes === '' || k.tenantNotes == null)) {
    parts.push(String(k.tenantNotes).trim());
  }

  if (parts.length === 0) return null;
  return parts.join(' | ');
}

/** Normalise agency spellings so classifyJS's exact match can never break:
 *  bh / Bh / BH -> 'BH'; h&h / H&h / H & H -> 'H&H'; anything else passes through trimmed. */
function normalizeAgency_(v) {
  const s = String(v == null ? '' : v).trim();
  if (/^bh$/i.test(s)) return 'BH';
  if (/^h\s*&\s*h$/i.test(s)) return 'H&H';
  return s;
}

/** Parse Kaye's UNIT TYPE ("STUDIO", "1 BEDROOM", "4 BEDROOM - D", "2 BEDROOM D.")
 *  into the master's exact vocabulary + duplex flag. Returns null when unrecognised. */
function parseKayeUnitType_(v) {
  let s = String(v == null ? '' : v).trim().toUpperCase();
  if (!s) return null;
  let duplex = false;
  if (/[\s\-·]D\.?$/.test(s)) { duplex = true; s = s.replace(/[\s\-·]+D\.?$/, '').trim(); }
  let label = null;
  if (s === 'STUDIO') label = 'Studio';
  else {
    const m = /^([1-4])\s*(BEDROOM|BED|BR)S?$/.exec(s);
    if (m) label = m[1] + ' Bedroom';
  }
  if (!label || BEDROOM_WHITELIST.indexOf(label) === -1) return null;
  return { label: label, duplex: duplex };
}

/** Asking PSF = price / (Total sqm converted to sqft). Returns null if area is unusable. */
function computePsf_(price, totalSqm) {
  const sqm = Number(totalSqm);
  if (!isFinite(sqm) || sqm <= 0) return null;
  return price / (sqm * SQFT_PER_SQM);
}

function formatDate_(d) {
  if (d instanceof Date && !isNaN(d.getTime())) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd-MMM-yyyy');
  }
  return String(d).trim();
}

// ============================================================
// ALERT EMAIL
// ============================================================

/**
 * Sends an HTML email summarising the changes from the latest sync.
 * Returns the array of recipients that were actually sent to.
 */
function sendAlertEmail_(changeLog, result) {
  // Filter out unconfigured placeholder addresses + duplicates
  const recipients = [];
  ALERT_RECIPIENTS.forEach(function (addr) {
    if (!addr) return;
    const a = String(addr).trim().toLowerCase();
    if (!a) return;
    if (a.indexOf('replaceme') !== -1) return; // skip TODO placeholders
    if (a.indexOf('@') === -1) return;
    if (recipients.indexOf(a) === -1) recipients.push(a);
  });

  if (recipients.length === 0) {
    Logger.log('No valid recipients in ALERT_RECIPIENTS — email not sent.');
    return [];
  }

  const totalChanges = changeLog.reduce(function (s, u) { return s + u.changes.length; }, 0);
  const unitCount = changeLog.length;
  const subject = 'CT1 — ' + unitCount + ' unit' + (unitCount === 1 ? '' : 's') +
                  ' updated by Kaye (' + totalChanges + ' change' + (totalChanges === 1 ? '' : 's') + ')';

  MailApp.sendEmail({
    to: recipients.join(','),
    subject: subject,
    htmlBody: buildAlertHtml_(changeLog, result),
    name: 'CT1 Sync',
  });

  return recipients;
}

function buildAlertHtml_(changeLog, result) {
  const tz = Session.getScriptTimeZone();
  const ts = Utilities.formatDate(new Date(), tz, "dd MMM yyyy 'at' HH:mm");
  const ssUrl = SpreadsheetApp.openById(MASTER_FILE_ID).getUrl();
  const attention = [];
  if (result && result.invalidRows && result.invalidRows.length) {
    result.invalidRows.slice(0, 10).forEach(function (r) {
      attention.push('Validation: ' + escapeHtml_(r.unitId) + ' — ' + escapeHtml_(r.problem));
    });
  }
  if (result && result.verifyFailures && result.verifyFailures.length) {
    result.verifyFailures.forEach(function (v) {
      attention.push('READ-BACK MISMATCH: ' + escapeHtml_(v.column) + ' row ' + v.row +
        ' wanted "' + escapeHtml_(v.wanted) + '" got "' + escapeHtml_(v.got) + '"');
    });
  }
  const attentionHtml = attention.length
    ? '<tr><td style="padding:0 24px 16px 24px;"><div style="border:2px solid #CC0000;background:#FFF5F5;padding:12px 14px;color:#8A1F1F;font-size:13px;line-height:1.6;"><strong>Needs attention</strong><br>' + attention.join('<br>') + '</div></td></tr>'
    : '';
  const totalChanges = changeLog.reduce(function (s, u) { return s + u.changes.length; }, 0);

  // Build table rows — one <tr> per change, unit ID repeated for clarity
  const rows = [];
  changeLog.forEach(function (unit) {
    unit.changes.forEach(function (c, idx) {
      const isFirst = idx === 0;
      const unitCell = isFirst
        ? '<td style="padding:10px 14px;border-bottom:1px solid #EDE8E4;font-weight:bold;font-family:Georgia,serif;color:#1F343F;vertical-align:top;">' + escapeHtml_(unit.unitId) + '</td>'
        : '<td style="padding:10px 14px;border-bottom:1px solid #EDE8E4;color:#BBB;font-size:11px;font-family:Georgia,serif;vertical-align:top;">↳</td>';
      rows.push(
        '<tr>' + unitCell +
        '<td style="padding:10px 14px;border-bottom:1px solid #EDE8E4;color:#1F343F;font-size:13px;vertical-align:top;">' + escapeHtml_(c.field) + '</td>' +
        '<td style="padding:10px 14px;border-bottom:1px solid #EDE8E4;color:#888;font-size:13px;vertical-align:top;">' + formatVal_(c.oldValue, c.field) + '</td>' +
        '<td style="padding:10px 14px;border-bottom:1px solid #EDE8E4;color:#1F343F;font-size:13px;font-weight:bold;vertical-align:top;">' + formatVal_(c.newValue, c.field) + '</td>' +
        '</tr>'
      );
    });
  });

  return [
    '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F5F2EE;font-family:Arial,sans-serif;">',
    '<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5F2EE;padding:24px 0;">',
      '<tr><td align="center">',
        '<table cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;background:#FFFFFF;border:1px solid #EDE8E4;">',
          // Header
          '<tr><td style="background:#1F343F;color:#FFFFFF;padding:20px 24px;">',
            '<div style="font-family:Georgia,serif;font-size:20px;font-weight:bold;letter-spacing:0.5px;">CITY TOWER 1 · STATUS UPDATE</div>',
            '<div style="font-size:12px;opacity:0.85;margin-top:4px;font-family:Arial,sans-serif;">' + totalChanges + ' change' + (totalChanges === 1 ? '' : 's') + ' across ' + changeLog.length + ' unit' + (changeLog.length === 1 ? '' : 's') + ' · ' + ts + '</div>',
          '</td></tr>',
          // Intro
          '<tr><td style="padding:20px 24px 8px 24px;color:#1F343F;font-size:14px;line-height:1.5;">',
            'Kaye made the following updates in the BrightStart tracker. The Control Centre Master tab has been refreshed automatically. Written values were re-read from the sheet and verified.',
          '</td></tr>',
          // Table
          '<tr><td style="padding:8px 24px 24px 24px;">',
            '<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid #EDE8E4;">',
              '<thead><tr>',
                '<th style="background:#2C537A;color:#FFFFFF;padding:10px 14px;text-align:left;font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:0.3px;">Unit</th>',
                '<th style="background:#2C537A;color:#FFFFFF;padding:10px 14px;text-align:left;font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:0.3px;">Field</th>',
                '<th style="background:#2C537A;color:#FFFFFF;padding:10px 14px;text-align:left;font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:0.3px;">From</th>',
                '<th style="background:#2C537A;color:#FFFFFF;padding:10px 14px;text-align:left;font-family:Georgia,serif;font-size:12px;font-weight:bold;letter-spacing:0.3px;">To</th>',
              '</tr></thead>',
              '<tbody>' + rows.join('') + '</tbody>',
            '</table>',
          '</td></tr>',
          attentionHtml,
          // Footer
          '<tr><td style="padding:0 24px 24px 24px;">',
            '<a href="' + ssUrl + '" style="display:inline-block;background:#1F343F;color:#FFFFFF;text-decoration:none;padding:10px 20px;font-size:13px;font-family:Arial,sans-serif;">Open Control Centre →</a>',
          '</td></tr>',
          '<tr><td style="padding:12px 24px 24px 24px;color:#888;font-size:11px;font-family:Arial,sans-serif;border-top:1px solid #EDE8E4;">',
            'Auto-generated by CT1 Sync. To stop receiving these, set ALERT_ENABLED = false in the script or remove yourself from ALERT_RECIPIENTS.',
          '</td></tr>',
        '</table>',
      '</td></tr>',
    '</table>',
    '</body></html>'
  ].join('');
}

/** Renders a cell value for the alert email. Field-aware formatting for currency, dates, blanks. */
function formatVal_(v, field) {
  if (v === '' || v === null || v === undefined) return '<span style="color:#BBB;">— blank —</span>';
  if (v instanceof Date && !isNaN(v.getTime())) {
    return escapeHtml_(Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd-MMM-yyyy'));
  }
  if ((field === 'Signed Rent' || field === 'Current Asking') && typeof v === 'number') {
    return 'AED&nbsp;' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  if (field === 'Asking PSF' && typeof v === 'number') {
    return escapeHtml_(v.toFixed(2));
  }
  // Truncate very long Notes for readability
  const s = String(v);
  if (field === 'Notes' && s.length > 90) {
    return escapeHtml_(s.substring(0, 87)) + '…';
  }
  return escapeHtml_(s);
}

function escapeHtml_(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
/**
 * Reconciliation notes — DLD size correction + price drop (16 May 2026)
 * Run once after the size + price updates landed in 01_Unit_Master.
 */
function addReconciliationNotes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('01_Unit_Master');
  if (!sheet) throw new Error('01_Unit_Master sheet not found');

  const NOTES_COL = 27; // AA
  const TODAY = '16 May 2026';

  const NOTE_PRICE_AND_SIZE = 'Rent reduced 340K → 320K; net size 238 → 221 sqm per DLD (' + TODAY + ')';
  const NOTE_SIZE_48        = 'Net size corrected 233 → 220 sqm per DLD (' + TODAY + ')';
  const NOTE_SIZE_63        = 'Net size corrected 286 → 269 sqm per DLD (' + TODAY + ')';
  const NOTE_SIZE_64_69     = 'Net size corrected 285 → 269 sqm per DLD (' + TODAY + ')';

  const targets = [];
  ['49-05','50-05','51-05','52-05','53-05','54-05','55-05',
   '56-05','57-05','58-05','59-05','60-05','61-05','62-05']
    .forEach(uid => targets.push({ uid, note: NOTE_PRICE_AND_SIZE }));
  targets.push({ uid: '48-05', note: NOTE_SIZE_48 });
  targets.push({ uid: '63-04', note: NOTE_SIZE_63 });
  ['64-04','65-04','66-04','67-04','68-04','69-04']
    .forEach(uid => targets.push({ uid, note: NOTE_SIZE_64_69 }));

  // Build uid → row map
  const all = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  const uidRow = {};
  for (let i = 0; i < all.length; i++) {
    if (all[i][0]) uidRow[String(all[i][0])] = i + 1;
  }

  let touched = 0;
  const skipped = [];
  targets.forEach(({ uid, note }) => {
    const r = uidRow[uid];
    if (!r) { skipped.push(uid); return; }
    const cell = sheet.getRange(r, NOTES_COL);
    const existing = String(cell.getValue() || '').trim();
    cell.setValue(existing ? existing + ' | ' + note : note);
    touched++;
  });

  const msg = 'Notes added to ' + touched + ' units.' +
              (skipped.length ? ' Not found: ' + skipped.join(', ') : '');
  Logger.log(msg);
  try { SpreadsheetApp.getActive().toast(msg, 'CT1 reconciliation', 8); } catch(e) {}
  return msg;
}
