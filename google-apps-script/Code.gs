/**
 * HR attendance webhook for ABDO Team.
 *
 * Paste this into Extensions > Apps Script of the HR Google Sheet, set SECRET,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * Put the web app URL in GOOGLE_SHEETS_WEBHOOK_URL and the same SECRET in
 * GOOGLE_SHEETS_WEBHOOK_SECRET.
 */

const SHEET_NAME = "Pointage";
const SECRET = "change-me"; // must match GOOGLE_SHEETS_WEBHOOK_SECRET in .env.local
const HEADERS = ["Date", "Heure d'arrivée", "Nom", "Utilisateur", "Statut", "Horodatage (UTC)"];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (SECRET && data.secret !== SECRET) return json({ ok: false, error: "Invalid secret" });

    const sheet = getSheet();
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      // Leading apostrophe keeps date and time as typed instead of letting Sheets reformat them.
      sheet.appendRow([
        "'" + data.date,
        "'" + data.time,
        data.name,
        data.username,
        data.status,
        data.timestamp,
      ]);
      const row = sheet.getLastRow();
      sheet
        .getRange(row, 5)
        .setFontColor(data.status === "En retard" ? "#b45309" : "#047857")
        .setFontWeight("bold");
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
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
