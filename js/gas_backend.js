// ==========================================
// 東門國小試菜系統 2.0 - 雙密碼安全架構
// ==========================================

const CONFIG = {
  NORMAL_PWD: "user123",    // 家代密碼 (需要審核)
  SUPER_PWD: "admin123",    // 幹部超級密碼 (直接發布/管理權限)
  SCHOOL_ID: "353606"       // 東門國小代碼
};

// 處理所有的 GET 請求 (抓菜單)
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'getMenu') {
    try {
      const date = e.parameter.date;
      const url = `https://fatraceschool.k12ea.gov.tw/offered/meal?SchoolId=${CONFIG.SCHOOL_ID}&period=${date}&KitchenId=all&MenuType=1`;
      
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const data = JSON.parse(response.getContentText());
      
      let menuString = "未查到官方菜單資料，請手動輸入";
      if (data && data.data && data.data.length > 0) {
        menuString = data.data.map(dish => dish.DishName).join("、");
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", menu: menuString })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
  }
}

// 處理所有的 POST 請求 (資料寫入與管理)
function doPost(e) {
  try {
    const params = e.parameter;
    const action = params.action;
    const pwd = params.password;

    // 基本權限驗證
    const isNormal = (pwd === CONFIG.NORMAL_PWD);
    const isSuper = (pwd === CONFIG.SUPER_PWD);
    if (!isNormal && !isSuper) {
      return errorResponse("通關密語錯誤！");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // --- 動作：家代填寫試菜紀錄 ---
    if (action === 'report') {
      return handleReport(ss, params, isSuper);
    }
    
    // --- 以下為幹部管理功能，強制需要 SUPER_PWD ---
    if (!isSuper) return errorResponse("權限不足，需要超級密碼！");

    if (action === 'getPending') {
      return getPendingList(ss);
    } 
    else if (action === 'approve') {
      return approveRecord(ss, params);
    }
    else if (action === 'delete') {
      return deleteRecord(ss, params);
    }
    else if (action === 'updateRoster') {
      return updateRoster(ss, params.csvData);
    }
    else if (action === 'getStats') {
      return getStats(ss);
    }

    return errorResponse("未知的操作指令");
    
  } catch (error) {
    return errorResponse(error.toString());
  }
}

// ==========================================
// 核心業務邏輯函式
// ==========================================

function handleReport(ss, params, isSuper) {
  const masterSheet = getSheetOrCreate(ss, "總表", ["時間戳","日期","真實班級","家代姓名","午餐菜色","家代反饋","照片","營養師回覆","狀態"]);
  const publicSheet = getSheetOrCreate(ss, "公開發布表", ["日期","隱碼班級","午餐菜色","家代反饋","照片","營養師回覆"]);
  const rosterSheet = getSheetOrCreate(ss, "排班表", ["日期","班級","家代姓名"]);

  const date = params.date;
  const realClassId = String(params.classId || "").trim();
  let repName = "未登記人員";
  let isScheduled = false;

  // 1. 比對排班表 (如果是超級密碼，可以強制放行)
  const rosterData = rosterSheet.getDataRange().getValues();
  for (let i = 1; i < rosterData.length; i++) {
    let rDate = '';
    try { rDate = Utilities.formatDate(new Date(rosterData[i][0]), Session.getScriptTimeZone(), "yyyy-MM-dd"); } catch(e){}
    let rClass = String(rosterData[i][1]).trim();
    if (date === rDate && realClassId === rClass) {
      isScheduled = true;
      repName = rosterData[i][2] || "未留名";
      break;
    }
  }

  if (!isScheduled && !isSuper) {
    return errorResponse(`安全阻擋：排班表上 ${date} 並未安排 ${realClassId} 班試菜。請確認班級是否正確，或聯繫幹部。`);
  }

  // 2. 去識別化處理
  const gradeMap = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六' };
  const anonymousClass = gradeMap[realClassId.charAt(0)] ? gradeMap[realClassId.charAt(0)] + '年級代表' : '家長代表';

  // 3. 決定狀態與分流
  const timestamp = new Date();
  const status = isSuper ? "已發布" : "待審核";

  // 寫入總表
  masterSheet.appendRow([timestamp, date, realClassId, repName, params.menu, params.feedback, params.photoUrl, "", status]);

  // 如果是幹部直接填，立刻寫入公開表
  if (isSuper) {
    publicSheet.appendRow([date, anonymousClass, params.menu, params.feedback, params.photoUrl, ""]);
  }

  return successResponse({ 
    message: isSuper ? "已使用超級密碼，資料已直接公開發布！" : "送出成功！資料已進入幹部覆核排程，核准後將發布至首頁。" 
  });
}

function getPendingList(ss) {
  const masterSheet = ss.getSheetByName("總表");
  if (!masterSheet) return successResponse({ list: [] });
  const data = masterSheet.getDataRange().getValues();
  let pending = [];
  
  // 第一列是 Header
  for (let i = 1; i < data.length; i++) {
    if (data[i][8] === "待審核") {
      pending.push({
        rowIndex: i + 1,
        date: Utilities.formatDate(new Date(data[i][1]), Session.getScriptTimeZone(), "yyyy-MM-dd"),
        classId: data[i][2],
        name: data[i][3],
        menu: data[i][4],
        feedback: data[i][5],
        photo: data[i][6]
      });
    }
  }
  return successResponse({ list: pending });
}

function approveRecord(ss, params) {
  const rowIndex = parseInt(params.rowIndex);
  const reply = params.reply || "";
  
  const masterSheet = ss.getSheetByName("總表");
  const publicSheet = ss.getSheetByName("公開發布表");
  
  // 更新總表
  masterSheet.getRange(rowIndex, 8).setValue(reply); // 營養師回覆
  masterSheet.getRange(rowIndex, 9).setValue("已發布"); // 狀態
  
  // 取得完整資料寫入公開表
  const rowData = masterSheet.getRange(rowIndex, 1, 1, 9).getValues()[0];
  const realClassId = String(rowData[2]);
  const gradeMap = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六' };
  const anonymousClass = gradeMap[realClassId.charAt(0)] ? gradeMap[realClassId.charAt(0)] + '年級代表' : '家長代表';
  
  // [日期, 隱碼班級, 午餐菜色, 家代反饋, 照片, 營養師回覆]
  const dateStr = Utilities.formatDate(new Date(rowData[1]), Session.getScriptTimeZone(), "yyyy-MM-dd");
  publicSheet.appendRow([dateStr, anonymousClass, rowData[4], rowData[5], rowData[6], reply]);
  
  return successResponse({ message: "審核成功，已發布至前台！" });
}

function deleteRecord(ss, params) {
  const rowIndex = parseInt(params.rowIndex);
  const masterSheet = ss.getSheetByName("總表");
  masterSheet.getRange(rowIndex, 9).setValue("已作廢/退回");
  return successResponse({ message: "已將該筆紀錄標示為作廢。" });
}

function updateRoster(ss, csvData) {
  const rosterSheet = getSheetOrCreate(ss, "排班表", ["日期","班級","家代姓名"]);
  // 清空舊資料
  if(rosterSheet.getLastRow() > 1) {
    rosterSheet.getRange(2, 1, rosterSheet.getLastRow() - 1, 3).clearContent();
  }
  
  const rows = csvData.split('\n');
  let validCount = 0;
  for (let r of rows) {
    if (!r.trim()) continue;
    let cols = r.split(',');
    if (cols.length >= 2) {
      rosterSheet.appendRow([cols[0].trim(), cols[1].trim(), (cols[2] || "").trim()]);
      validCount++;
    }
  }
  return successResponse({ message: `成功更新排班表，共匯入 ${validCount} 筆資料。` });
}

function getStats(ss) {
  const masterSheet = ss.getSheetByName("總表");
  const rosterSheet = ss.getSheetByName("排班表");
  
  let stats = {};
  
  // 先讀排班表，建立基底
  if (rosterSheet && rosterSheet.getLastRow() > 1) {
    const roster = rosterSheet.getDataRange().getValues();
    for (let i = 1; i < roster.length; i++) {
      let c = String(roster[i][1]).trim();
      let n = roster[i][2] || "未具名";
      if(!stats[c]) stats[c] = { name: n, assigned: 0, completed: 0 };
      stats[c].assigned += 1;
    }
  }
  
  // 讀總表，算完成數
  if (masterSheet && masterSheet.getLastRow() > 1) {
    const master = masterSheet.getDataRange().getValues();
    for (let i = 1; i < master.length; i++) {
      let c = String(master[i][2]).trim();
      let status = master[i][8];
      if (status === "已發布" || status === "待審核") {
        if(!stats[c]) stats[c] = { name: master[i][3], assigned: 0, completed: 0 };
        stats[c].completed += 1;
      }
    }
  }
  
  return successResponse({ stats: stats });
}

// ==========================================
// 工具函式
// ==========================================
function getSheetOrCreate(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}
function successResponse(data) {
  data.status = "success";
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function errorResponse(msg) {
  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: msg })).setMimeType(ContentService.MimeType.JSON);
}
