/**
 * HR attendance webhook for ABDO ("les retards" sheet).
 *
 * The sheet is a grid: dates down column A (01/11/2026, 02/11/2026, ...) and one
 * column per person in row 1 (abderrahim, ikram, ayman). Each arrival is written
 * in the cell where the day's row meets the person's column, e.g. "09:14 En retard".
 * A missing date row or person column is added automatically.
 *
 * Paste this into Extensions > Apps Script of the sheet, set SECRET,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * Put the web app URL in GOOGLE_SHEETS_WEBHOOK_URL and the same SECRET in
 * GOOGLE_SHEETS_WEBHOOK_SECRET (Vercel: Settings > Environment Variables).
 */

const SHEET_NAME = "Sheet1"; // tab to fill; falls back to the first tab if renamed
const SECRET = "change-me"; // must match GOOGLE_SHEETS_WEBHOOK_SECRET
const COLORS = { Present: "#d1fae5", "En retard": "#fde68a" };

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (SECRET && data.secret !== SECRET) return json({ ok: false, error: "Invalid secret" });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = getSheet();
      const row = findOrAddDateRow(sheet, data.date);
      const col = findOrAddPersonColumn(sheet, data.username, data.name);
      sheet
        .getRange(row, col)
        .setValue("'" + data.time.slice(0, 5) + " " + data.status)
        .setBackground(COLORS[data.status] || null)
        .setNote("Recorded by ABDO at " + data.timestamp + " (UTC)");
    } finally {
      lock.releaseLock();
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// Lets you open the web app URL in a browser to check that it is live.
function doGet() {
  return json({ ok: true, message: "ABDO attendance webhook is running" });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

/** Row whose column A holds this date (yyyy-mm-dd from the app); appended if missing. */
function findOrAddDateRow(sheet, isoDate) {
  const tz = sheet.getParent().getSpreadsheetTimeZone();
  const last = sheet.getLastRow();
  if (last >= 2) {
    const values = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (let i = 0; i < values.length; i++) {
      if (toIsoDate(values[i][0], tz) === isoDate) return i + 2;
    }
  }
  const [y, m, d] = isoDate.split("-").map(Number);
  const row = Math.max(last, 1) + 1;
  const width = Math.max(sheet.getLastColumn(), 1);
  if (row > 2) {
    // Same borders and date format as the row above.
    sheet.getRange(row - 1, 1, 1, width).copyTo(sheet.getRange(row, 1, 1, width), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  }
  sheet.getRange(row, 1).setValue(new Date(y, m - 1, d)).setNumberFormat("dd/mm/yyyy");
  return row;
}

/** Column whose row-1 header matches the username or full name (any case); appended if missing. */
function findOrAddPersonColumn(sheet, username, name) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const wanted = [username, name].map(normalize);
  for (let c = 1; c < headers.length; c++) {
    if (wanted.indexOf(normalize(headers[c])) !== -1) return c + 1;
  }
  const col = lastCol + 1;
  sheet.getRange(1, col).setValue(username).setFontWeight("bold");
  return col;
}

/** Column A may hold real dates or text like 02/11/2026 or 2026-11-02. */
function toIsoDate(value, tz) {
  if (value instanceof Date) return Utilities.formatDate(value, tz, "yyyy-MM-dd");
  const text = String(value).trim();
  let m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + "-" + pad(m[2]) + "-" + pad(m[1]);
  m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? text : "";
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
