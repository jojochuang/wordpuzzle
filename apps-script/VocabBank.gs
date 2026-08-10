/**
 * 語詞庫寫入 v6
 *
 * 重要：專案裡只能有一份含 doGet/doPost 的 .gs。
 * 若還有舊的 Code.gs / 副本，請刪掉，只留本檔，再：
 * 部署 → 管理部署 → 鉛筆 → 版本「新版本」→ 部署
 */

var SCRIPT_VER = 6;
var SHEET_ID = "12tOoECKZELXUdhrJzTQP3h0DgDmS4oM80DdIvIGLpGM";
var SHEET_GID = 257311027;
var NUM_COLS = 11;
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

function plainKey_(s) {
  var t = String(s || "");
  t = t.replace(/[\uFE00-\uFE0F]/g, "");
  var out = "";
  for (var i = 0; i < t.length; ) {
    var cp = t.codePointAt(i);
    var len = cp > 0xffff ? 2 : 1;
    if (!(cp >= 0xe0100 && cp <= 0xe01ef)) out += t.substr(i, len);
    i += len;
  }
  return out.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

function jsonOut_(obj) {
  obj.ver = SCRIPT_VER;
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getTargetSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (Number(sheets[i].getSheetId()) === Number(SHEET_GID)) {
      return sheets[i];
    }
  }
  return sheets[0];
}

function breakAllMergesInBand_(sheet, rowIndex) {
  // getMergedRanges 是 Range 的方法，不是 Sheet
  var band = sheet.getRange(rowIndex, 1, rowIndex, NUM_COLS);
  var merges = band.getMergedRanges();
  for (var i = merges.length - 1; i >= 0; i--) {
    merges[i].breakApart();
  }
}

/**
 * 絕對不用 setValues。合併儲存格會讓 A:n 範圍變成多列，
 * setValues([[...]]) 就會報 data has 1 but range has N。
 */
function writeOneRow_(sheet, rowIndex, row) {
  breakAllMergesInBand_(sheet, rowIndex);
  for (var c = 0; c < NUM_COLS; c++) {
    var cell = sheet.getRange(rowIndex, c + 1);
    // 若單一儲存格仍屬合併區，再拆一次
    var ms = cell.getMergedRanges();
    for (var i = 0; i < ms.length; i++) ms[i].breakApart();
    sheet.getRange(rowIndex, c + 1).setValue(row[c] != null ? String(row[c]) : "");
  }
  SpreadsheetApp.flush();
}

function findRowByTerm_(sheet, term) {
  var key = plainKey_(term);
  if (!key) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var values = sheet.getRange(2, 1, lastRow, 1).getDisplayValues();
  for (var j = 0; j < values.length; j++) {
    if (plainKey_(values[j][0]) === key) return j + 2;
  }
  return -1;
}

function ensureHeader_(sheet) {
  var v = String(sheet.getRange(1, 1).getDisplayValue() || "").trim();
  if (v !== "語詞") {
    breakAllMergesInBand_(sheet, 1);
    for (var c = 0; c < NUM_COLS; c++) {
      sheet.getRange(1, c + 1).setValue(HEADERS[c]);
    }
  }
}

function doGet(e) {
  return jsonOut_({
    ok: true,
    service: "wordpuzzle-vocab-bank",
    action: e && e.parameter && e.parameter.action ? e.parameter.action : "ping",
    hasDoGet: true,
    writeMode: "setValue-per-cell",
  });
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "";
    var data = raw ? JSON.parse(raw) : {};
    var cols = data.cols || [];
    var row = [];
    for (var i = 0; i < NUM_COLS; i++) {
      row.push(cols[i] != null ? String(cols[i]) : "");
    }
    if (!String(row[0]).trim()) {
      return jsonOut_({ ok: false, error: "缺少語詞（A欄）" });
    }

    var sheet = getTargetSheet_();
    ensureHeader_(sheet);

    var foundRow = findRowByTerm_(sheet, row[0]);
    if (foundRow > 0) {
      writeOneRow_(sheet, foundRow, row);
      return jsonOut_({
        ok: true,
        updated: true,
        row: foundRow,
        sheet: sheet.getName(),
        writeMode: "setValue-per-cell",
      });
    }

    var newRow = Math.max(sheet.getLastRow() + 1, 2);
    writeOneRow_(sheet, newRow, row);
    return jsonOut_({
      ok: true,
      appended: true,
      row: newRow,
      sheet: sheet.getName(),
      writeMode: "setValue-per-cell",
    });
  } catch (err) {
    return jsonOut_({
      ok: false,
      error: String(err),
      writeMode: "setValue-per-cell",
    });
  }
}
