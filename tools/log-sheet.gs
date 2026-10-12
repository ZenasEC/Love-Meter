/**
 * Love Meter — guest log for Google Sheets.
 * =========================================
 *
 * Every time someone reads the meter, the page POSTs { a, b, score } here and
 * this appends a row to the Sheet. You read the Sheet to see who has been
 * tested. Nothing else of the visitor's is collected.
 *
 * SETUP (once, ~3 minutes)
 * ------------------------
 *  1. Create a new Google Sheet:  https://sheets.new
 *  2. Extensions ▸ Apps Script.
 *  3. Delete the sample code and paste this whole file in. Save.
 *  4. Deploy ▸ New deployment ▸ gear icon ▸ "Web app".
 *       - Description: Love Meter log
 *       - Execute as:  Me
 *       - Who has access:  Anyone
 *     Deploy, then Authorize access (pick your account, "Advanced" ▸
 *     "Go to ... (unsafe)" if Google warns — it is your own script).
 *  5. Copy the Web app URL (it ends in /exec).
 *  6. Paste that URL into LOG_ENDPOINT near the top of "13 logbook" in
 *     app.js, commit and push. The log is now live.
 *
 * To test by hand after deploying, open the /exec URL in a browser — you
 * should see "Love Meter log is listening."
 */

function doGet() {
  return ContentService.createTextOutput("Love Meter log is listening.");
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  var data = {};
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    data = {};
  }

  var a = String(data.a == null ? "" : data.a).trim();
  var b = String(data.b == null ? "" : data.b).trim();
  var score = Number(data.score);

  // Ignore anything that is not a plausible reading.
  if (!a || !b || !isFinite(score)) {
    return ContentService.createTextOutput("ignored");
  }

  // Cap length so a joker cannot stuff the sheet with megabytes.
  a = a.slice(0, 40);
  b = b.slice(0, 40);
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Write the header row once.
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["When (server time)", "Name A", "Name B", "Score %"]);
    sheet.getRange("A1:D1").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([new Date(), a, b, score]);

  return ContentService.createTextOutput("ok");
}
