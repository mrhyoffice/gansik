var SHEET_NAME = "간식 신청";
var HEADERS = ["신청 ID", "신청 시간", "원하는 간식", "메모", "상태", "완료 시간"];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("간식 신청 관리")
    .addItem("처음 설정하기", "setupProject")
    .addSeparator()
    .addItem("선택한 신청 완료 처리", "completeSelectedRows")
    .addToUi();
}

function setupProject() {
  var ui = SpreadsheetApp.getUi();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  var emailPrompt = ui.prompt(
    "관리자 이메일",
    "신청 알림을 받을 이메일 주소를 입력하세요.",
    ui.ButtonSet.OK_CANCEL,
  );
  if (emailPrompt.getSelectedButton() !== ui.Button.OK) return;

  var adminEmail = emailPrompt.getResponseText().trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    ui.alert("올바른 이메일 주소를 입력해 주세요.");
    return;
  }

  var managerPrompt = ui.prompt(
    "관리자명",
    "신청 확인에 사용할 관리자명을 입력하세요.",
    ui.ButtonSet.OK_CANCEL,
  );
  if (managerPrompt.getSelectedButton() !== ui.Button.OK) return;

  var managerName = cleanText_(managerPrompt.getResponseText(), 30);
  if (managerName.length < 2) {
    ui.alert("관리자명은 2자 이상이어야 합니다.");
    return;
  }

  var originPrompt = ui.prompt(
    "GitHub Pages 주소",
    "예: https://username.github.io (마지막 / 제외)",
    ui.ButtonSet.OK_CANCEL,
  );
  if (originPrompt.getSelectedButton() !== ui.Button.OK) return;

  var allowedOrigin = originPrompt.getResponseText().trim().replace(/\/$/, "");
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(allowedOrigin)) {
    ui.alert("https://로 시작하는 올바른 주소를 입력해 주세요.");
    return;
  }

  PropertiesService.getScriptProperties().setProperties({
    SPREADSHEET_ID: spreadsheet.getId(),
    ADMIN_EMAIL: adminEmail,
    MANAGER_NAME: managerName,
    ALLOWED_ORIGIN: allowedOrigin,
  });

  prepareSheet_(spreadsheet);
  ui.alert(
    "설정 완료",
    "신청 시트와 이메일 알림 설정이 완료되었습니다. 이제 Apps Script를 웹 앱으로 배포하세요.",
    ui.ButtonSet.OK,
  );
}

function prepareSheet_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

  migrateOldSheetIfNeeded_(sheet);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setBackground("#37614c")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  [150, 145, 240, 280, 85, 145].forEach(function (width, index) {
    sheet.setColumnWidth(index + 1, width);
  });

  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["접수", "완료"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 5, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(statusRule);
  sheet.getRange("B:B").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("F:F").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getDataRange().setVerticalAlignment("middle");
}

function migrateOldSheetIfNeeded_(sheet) {
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return;
  var oldHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  if (oldHeaders.join("|") === HEADERS.join("|")) return;
  if (oldHeaders.indexOf("신청 ID") === -1 || oldHeaders.indexOf("원하는 간식") === -1) return;

  var rowCount = Math.max(sheet.getLastRow() - 1, 0);
  var migratedRows = [];
  if (rowCount > 0) {
    var oldRows = sheet.getRange(2, 1, rowCount, oldHeaders.length).getValues();
    var column = {};
    oldHeaders.forEach(function (header, index) { column[header] = index; });
    var noteColumn = column["메모"] !== undefined ? column["메모"] : column["요청사항"];
    migratedRows = oldRows
      .filter(function (row) { return row[column["신청 ID"]] || row[column["원하는 간식"]]; })
      .map(function (row) {
        return [
          row[column["신청 ID"]],
          row[column["신청 시간"]],
          row[column["원하는 간식"]],
          noteColumn !== undefined ? row[noteColumn] : "",
          row[column["상태"]],
          row[column["완료 시간"]],
        ];
      });
  }

  sheet.clear();
  if (migratedRows.length) sheet.getRange(2, 1, migratedRows.length, HEADERS.length).setValues(migratedRows);
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  var callback = String(params.callback || "");
  var payload;

  try {
    payload = { ok: true, items: getRecentHistory_() };
  } catch (error) {
    console.error(error);
    payload = { ok: false, items: [], message: "신청 내역을 불러오지 못했습니다." };
  }

  if (/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify(payload).replace(/</g, "\\u003c") + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getRecentHistory_() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!spreadsheetId) return [];

  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var count = Math.min(sheet.getLastRow() - 1, 20);
  var startRow = sheet.getLastRow() - count + 1;
  return sheet.getRange(startRow, 1, count, HEADERS.length).getValues()
    .filter(function (row) { return row[0] && row[2]; })
    .reverse()
    .map(function (row) {
      return {
        id: String(row[0]),
        requestedAt: row[1] instanceof Date
          ? Utilities.formatDate(row[1], "Asia/Seoul", "MM.dd HH:mm")
          : String(row[1] || ""),
        snackName: String(row[2]),
        status: String(row[4] || "접수"),
      };
    });
}

function doPost(e) {
  var params = (e && e.parameter) || {};
  var requestId = cleanText_(params.requestId, 100) || "unknown";
  var props = PropertiesService.getScriptProperties();
  var allowedOrigin = props.getProperty("ALLOWED_ORIGIN") || "";
  var requestOrigin = String(params.origin || "").replace(/\/$/, "");

  if (params.website) return responseHtml_({ ok: true, requestId: requestId }, "*");

  if (!allowedOrigin || requestOrigin !== allowedOrigin) {
    return responseHtml_(
      { ok: false, requestId: requestId, message: "허용되지 않은 사이트에서 전송된 요청입니다." },
      "*",
    );
  }

  try {
    var configuredManagerName = cleanText_(props.getProperty("MANAGER_NAME"), 30).toLowerCase();
    var submittedManagerName = cleanText_(params.managerName, 30).toLowerCase();
    if (!configuredManagerName || !safeEquals_(submittedManagerName, configuredManagerName)) {
      return responseHtml_(
        { ok: false, requestId: requestId, message: "관리자명이 올바르지 않습니다." },
        allowedOrigin,
      );
    }

    var application = validateApplication_(params);
    var spreadsheetId = props.getProperty("SPREADSHEET_ID");
    var adminEmail = props.getProperty("ADMIN_EMAIL");
    if (!spreadsheetId || !adminEmail) throw new Error("관리자 설정이 완료되지 않았습니다.");

    var now = new Date();
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      var sheet = spreadsheet.getSheetByName(SHEET_NAME);
      if (!sheet) {
        prepareSheet_(spreadsheet);
        sheet = spreadsheet.getSheetByName(SHEET_NAME);
      }
      sheet.appendRow([
        sheetSafe_(requestId),
        now,
        sheetSafe_(application.snackName),
        sheetSafe_(application.note),
        "접수",
        "",
      ]);
    } finally {
      lock.releaseLock();
    }

    sendAdminEmail_(adminEmail, application, now);
    return responseHtml_(
      { ok: true, requestId: requestId, message: "간식 신청이 접수되었습니다." },
      allowedOrigin,
    );
  } catch (error) {
    console.error(error);
    return responseHtml_(
      { ok: false, requestId: requestId, message: "신청을 처리하지 못했습니다. 관리자에게 문의해 주세요." },
      allowedOrigin || "*",
    );
  }
}

function validateApplication_(params) {
  var application = {
    snackName: cleanText_(params.snackName, 80),
    note: cleanText_(params.note, 300),
  };
  if (!application.snackName) throw new Error("간식 이름이 없습니다.");
  return application;
}

function sendAdminEmail_(adminEmail, application, requestedAt) {
  var subject = "[미래해양 간식 신청] " + application.snackName;
  var requestedAtText = Utilities.formatDate(requestedAt, "Asia/Seoul", "yyyy-MM-dd HH:mm");
  var plainBody = [
    "새로운 간식 신청이 접수되었습니다.", "",
    "간식: " + application.snackName,
    "메모: " + (application.note || "없음"),
    "신청시간: " + requestedAtText, "",
    "완료 처리는 Google Sheets의 '간식 신청 관리' 메뉴에서 진행하세요.",
  ].join("\n");

  var htmlBody =
    '<div style="max-width:520px;margin:0 auto;font-family:Arial,\'Noto Sans KR\',sans-serif;color:#26241f">' +
    '<div style="background:#37614c;padding:22px 24px;border-radius:16px 16px 0 0;color:#fff">' +
    '<div style="font-size:20px;font-weight:700">새로운 간식 신청 🍪</div></div>' +
    '<div style="border:1px solid #e5e1d8;border-top:0;padding:23px 24px;border-radius:0 0 16px 16px">' +
    emailRow_("간식", application.snackName) +
    emailRow_("메모", application.note || "없음") +
    emailRow_("신청시간", requestedAtText) +
    '<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #eee;color:#7b766d;font-size:12px">Google Sheets에서 완료 처리하세요.</p>' +
    "</div></div>";

  MailApp.sendEmail({ to: adminEmail, subject: subject, body: plainBody, htmlBody: htmlBody, name: "미래해양 간식 신청" });
}

function completeSelectedRows() {
  var props = PropertiesService.getScriptProperties();
  var adminEmail = (props.getProperty("ADMIN_EMAIL") || "").toLowerCase();
  var activeEmail = (Session.getActiveUser().getEmail() || "").toLowerCase();

  if (!adminEmail || activeEmail !== adminEmail) {
    SpreadsheetApp.getUi().alert("관리자 계정만 완료 처리할 수 있습니다.");
    return;
  }

  var sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== SHEET_NAME) {
    SpreadsheetApp.getUi().alert("'" + SHEET_NAME + "' 시트에서 신청 행을 선택해 주세요.");
    return;
  }

  var range = sheet.getActiveRange();
  var startRow = Math.max(range.getRow(), 2);
  var endRow = range.getLastRow();
  if (endRow < 2) {
    SpreadsheetApp.getUi().alert("완료 처리할 신청 행을 선택해 주세요.");
    return;
  }

  var now = new Date();
  var completedCount = 0;
  for (var row = startRow; row <= endRow; row += 1) {
    if (sheet.getRange(row, 1).getValue()) {
      sheet.getRange(row, 5).setValue("완료");
      sheet.getRange(row, 6).setValue(now);
      completedCount += 1;
    }
  }
  SpreadsheetApp.getUi().alert(completedCount + "건을 완료 처리했습니다.");
}

function cleanText_(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sheetSafe_(value) {
  var text = String(value || "");
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function safeEquals_(left, right) {
  if (left.length !== right.length) return false;
  var result = 0;
  for (var i = 0; i < left.length; i += 1) result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return result === 0;
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function emailRow_(label, value) {
  return '<div style="display:flex;padding:8px 0;font-size:14px;line-height:1.5">' +
    '<div style="width:80px;flex:0 0 80px;color:#8d857a">' + escapeHtml_(label) + "</div>" +
    '<div style="font-weight:600">' + escapeHtml_(value) + "</div></div>";
}

function responseHtml_(payload, targetOrigin) {
  payload.source = "miraehaeyang-snack";
  var safePayload = JSON.stringify(payload).replace(/</g, "\\u003c");
  var safeOrigin = JSON.stringify(targetOrigin || "*");
  var html = "<!doctype html><html><head><meta charset='utf-8'></head><body>" +
    "<script>window.top.postMessage(" + safePayload + "," + safeOrigin + ");<\/script>" +
    "</body></html>";
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
