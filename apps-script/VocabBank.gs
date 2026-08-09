/**
 * 最小可部署版本（先確認網頁 doGet 能通）
 *
 * 請用「全新專案」部署（見下方說明），不要沿用舊部署。
 */

var SHEET_ID = "12tOoECKZELXUdhrJzTQP3h0DgDmS4oM80DdIvIGLpGM";
var SHEET_GID = 257311027;
var HEADERS = [
  "語詞",
  "解釋",
  "解釋英",
  "短句1",
  "短句1英",
  "短句2",
  "短句2英",
  "長句1",
  "長句1英",
  "長句2",
  "長句2英",
];

function doGet(e) {
  var action = "ping";
  if (e && e.parameter && e.parameter.action) {
    action = String(e.parameter.action).toLowerCase();
  }
  return ContentService.createTextOutput(
    JSON.stringify({
      ok: true,
      service: "wordpuzzle-vocab-bank",
      action: action,
      hasDoGet: true,
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "";
    var data = raw ? JSON.parse(raw) : {};
    var cols = data.cols || [];
    var row = [];
    for (var i = 0; i < HEADERS.length; i++) {
      row.push(cols[i] != null ? String(cols[i]) : "");
    }
    if (!String(row[0]).trim()) {
      return ContentService.createTextOutput(
        JSON.stringify({ ok: false, error: "缺少語詞（A欄）" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheets = ss.getSheets();
    var sheet = sheets[0];
    for (var s = 0; s < sheets.length; s++) {
      if (sheets[s].getSheetId() === SHEET_GID) {
        sheet = sheets[s];
        break;
      }
    }

    var first = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    if (String(first[0] || "").trim() !== "語詞") {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }

    var lastRow = Math.max(sheet.getLastRow(), 1);
    var values = lastRow >= 2 ? sheet.getRange(2, 1, lastRow, 1).getValues() : [];
    var foundRow = -1;
    var key = String(row[0]).trim();
    for (var j = 0; j < values.length; j++) {
      if (String(values[j][0] || "").trim() === key) {
        foundRow = j + 2;
        break;
      }
    }
    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, foundRow, HEADERS.length).setValues([row]);
      return ContentService.createTextOutput(
        JSON.stringify({ ok: true, updated: true, row: foundRow })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    sheet.appendRow(row);
    return ContentService.createTextOutput(
      JSON.stringify({ ok: true, appended: true, row: sheet.getLastRow() })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function pingTest() {
  Logger.log("ok");
}
