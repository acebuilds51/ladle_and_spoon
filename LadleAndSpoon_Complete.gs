const formSheetName     = "Soup orders";
const customerSheetName = "Customers";
const orderLink         = "https://tonyedmonds2003.github.io/ladle_and_spoon/";
const LOGO_URL          = "https://res.cloudinary.com/drcjmvjc9/image/upload/v1762996224/Ladle_and_Spoon_Logo_Clean_pylcav.png";
const SENDER_EMAIL      = "LadleandSpoon1024@gmail.com";
const SENDER_NAME       = "Ladle & Spoon";
const VENMO_HANDLE      = "@Lia-Merritt2282";
const LIA_EMAIL         = "LadleandSpoon1024@gmail.com";
const WELCOMEBACK_CODE  = "WELCOMEBACK";
const WELCOMEBACK_PCT   = 10;
const timestampColumnIndex    = 1;
const uniqueIdColumnIndex     = 2;
const newCustomerStatusIndex  = 3;
const customerDataIndices     = [2, 4, 5, 6];
const emailIndexInCustomerSheet = 0;
const nameIndexInCustomerData   = 1;
const lastOrderColIndex         = 5;
const lastEmailDateColIndex     = 7;
const targetNewStatus = "Yes I am New and hungry! 🎉";
var FCM_PROJECT_ID = 'ladle-and-spoon-push-notify';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if      (data.type === "order")                 return handleOrder(data);
    else if (data.type === "swap")                  return handleSwap(data);
    else if (data.type === "notification_token")    return handleNotificationToken(data);
    else if (data.type === "broadcast")             return handleBroadcast(data);
    else if (data.type === "publish_menu")          return handlePublishMenu(data);
    else if (data.type === "save_photo")            return handleSavePhoto(data);
    else if (data.type === "save_menu")             return handleSaveMenu(data);
    else if (data.type === "save_custom_item")      return handleSaveCustomItem(data);
    else if (data.type === "send_reengagement")     return sendReengagementOne(data);
    else if (data.type === "send_reengagement_all") return sendReengagementAll(data);
    else if (data.type === "send_rating_requests")  return handleSendRatingRequests(data);
    else if (data.type === "submit_ratings")         return handleSubmitRatings(data);
    return jsonResponse({ success: false, error: "Unknown type: " + data.type });
  } catch(err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  if (params.type === 'archive_week') {
    var isDryRun = params.dry_run === 'true';
    try {
      var ss2      = SpreadsheetApp.getActiveSpreadsheet();
      var ordSheet = ss2.getSheetByName('Soup orders');
      if (!ordSheet) return jsonResponse({success:false, error:'Soup orders tab not found'});
      var today  = new Date();
      var day    = today.getDay();
      var monday = new Date(today);
      monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      var tabName = (monday.getMonth()+1) + '/' + monday.getDate() + '/' + String(monday.getFullYear()).slice(-2);
      var currentRows = Math.max(0, ordSheet.getLastRow() - 4);
      if (isDryRun) {
        return jsonResponse({success:true, dry_run:true, archived:tabName,
          message: 'DRY RUN: Would archive ' + currentRows + ' orders to tab "' + tabName + '" and create fresh Soup orders tab.'});
      }
      var existing = ss2.getSheetByName(tabName);
      if (existing) ss2.deleteSheet(existing);
      var archivedSheet = ordSheet.copyTo(ss2);
      archivedSheet.setName(tabName);
      ss2.setActiveSheet(archivedSheet);
      ss2.moveActiveSheet(ss2.getNumSheets());
      var archLastCol = archivedSheet.getLastColumn();
      var archHeaders = archivedSheet.getRange(4, 1, 1, archLastCol).getValues();
      archivedSheet.getRange(4, 1, 1, archLastCol).setValues(archHeaders);
      ss2.deleteSheet(ordSheet);
      var freshSheet = archivedSheet.copyTo(ss2);
      freshSheet.setName('Soup orders');
      ss2.setActiveSheet(freshSheet);
      ss2.moveActiveSheet(1);
      var lastRow = freshSheet.getLastRow();
      if(lastRow > 4){
        freshSheet.getRange(5, 1, lastRow - 4, freshSheet.getLastColumn()).clearContent();
      }
      var freshLastCol = freshSheet.getLastColumn();
      if(freshLastCol >= 7){
        freshSheet.getRange(4, 7, 1, freshLastCol - 6).clearContent();
      }
      var fixedHeaders = ['Timestamp', 'Email Address', 'Are you a New Customer?', 'First and Last Name', 'Your Phone #', 'Your Delivery Address (Delivery Zone shown below in blue)'];
      fixedHeaders.forEach(function(h, i){ freshSheet.getRange(4, i+1).setValue(h); });
      var freshHeaders = freshSheet.getRange(4, 1, 1, freshSheet.getLastColumn()).getValues()[0];
      var hasComments = freshHeaders.some(function(h){ return /comment|special/i.test(h.toString()); });
      var hasPay      = freshHeaders.some(function(h){ return /how will you.*pay/i.test(h.toString()); });
      var lastCol     = freshSheet.getLastColumn();
      if(!hasComments){ freshSheet.getRange(4, lastCol+1).setValue('Comments or Special Instructions'); lastCol++; }
      if(!hasPay)     { freshSheet.getRange(4, lastCol+1).setValue('How Will You be Paying?'); }
      return jsonResponse({success:true, archived: tabName});
    } catch(err) {
      return jsonResponse({success:false, error: err.message});
    }
  }
  if (params.type === 'order' && params.data) {
    try {
      var decoded = decodeURIComponent(escape(Utilities.newBlob(Utilities.base64Decode(params.data)).getDataAsString()));
      var data    = JSON.parse(decoded);
      return handleOrder(data);
    } catch(err) {
      return jsonResponse({ success: false, error: err.message });
    }
  }

  if      (params.type === 'get_photos')           return handleGetPhotos();
  else if (params.type === 'get_subscribers')      return handleGetSubscribers();
  else if (params.type === 'get_dashboard')        return handleGetDashboard();
  else if (params.type === 'get_order_for_rating') return handleGetOrderForRating(params);
  else if (params.type === 'get_custom_items')     return handleGetCustomItems();
  else if (params.type === 'get_retention')          return handleGetRetention();
  else if (params.type === 'get_week_detail')       return handleGetWeekDetail(params);
  else if (params.type === 'get_monthly_detail')    return handleGetMonthlyDetail(params);
  return ContentService
    .createTextOutput(JSON.stringify({ status: "Ladle & Spoon backend live ", time: new Date().toString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

function handleOrder(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(formSheetName);
  if (!sheet) return jsonResponse({ success: false, error: "Soup orders tab not found" });

  var source  = data.source || 'form';
  var headers = sheet.getRange(4, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row     = buildOrderRow(data, headers);
  var lastRow = Math.max(sheet.getLastRow(), 4);
  sheet.getRange(lastRow + 1, 1, 1, row.length).setValues([row]);
  Logger.log("Items: " + JSON.stringify(data.items || []));
  Logger.log("Written to row " + (lastRow + 1));

  syncSingleCustomer(ss, data);

  try {
    sendConfirmationEmail(data);
  } catch(emailErr) {
  }

  try { generateLadleAndSpoonIntelligence(); } catch(e) {
  }

  return jsonResponse({ success: true, orderId: data.id });
}

function buildOrderRow(data, headers) {
  var row = new Array(headers.length).fill("");

  row[0] = new Date();
  row[1] = data.email;
  row[2] = data.isNew ? targetNewStatus : "Nope! I am back for more! 😋";
  row[3] = data.name;
  row[4] = data.phone;
  row[5] = data.address;

  (data.items || []).forEach(function(item) {
    var sizeLower = (item.size || "").toLowerCase();
    var nameLower = (item.name || "").toLowerCase();
    headers.forEach(function(h, i) {
      var hLower    = h.toString().toLowerCase();
      var nameMatch = hLower.includes(nameLower.substring(0, 12));
      var sizeMatch =
        (sizeLower.includes("pint")   && hLower.includes("pint"))   ||
        (sizeLower.includes("quart")  && hLower.includes("quart"))  ||
        (sizeLower.includes("single") && (hLower.includes("salad") || hLower.includes("single"))) ||
        (sizeLower.includes("small")  && hLower.includes("small"))  ||
        (sizeLower.includes("large")  && hLower.includes("large"))  ||
        (sizeLower.includes("each")   && hLower.includes("each"))   ||
        (!sizeLower && nameMatch && !hLower.includes("pint") && !hLower.includes("quart"));
      if (nameMatch && sizeMatch) row[i] = (parseFloat(row[i]) || 0) + item.qty;
    });
  });

  var commentCol = headers.findIndex(function(h) {
    return /comment|special instruction/i.test(h.toString());
  });
  if (commentCol >= 0) {
    var sourceTag = data.source === 'app' ? '[App Order]' : '[Form Order]';
    var notes     = data.notes ? data.notes + ' ' + sourceTag : sourceTag;
    row[commentCol] = notes;
  }

  var payCol = headers.findIndex(function(h) { return /how will you be paying/i.test(h.toString()); });
  if (payCol < 0) payCol = headers.findIndex(function(h) { return /pay/i.test(h.toString()); });
  if (payCol >= 0) row[payCol] = data.payment === "venmo"
    ? "Venmo (QR Code Provided Here)" : "Cash on Delivery";

  return row;
}

function syncSingleCustomer(ss, data) {
  var customerSheet = ss.getSheetByName(customerSheetName);
  if (!customerSheet) return;

  var customerData = customerSheet.getDataRange().getValues();
  var emailKey     = data.email.toString().toLowerCase();
  var now          = new Date();

  for (var i = 1; i < customerData.length; i++) {
    var rowEmail = (customerData[i][emailIndexInCustomerSheet] || "").toString().toLowerCase();
    if (rowEmail === emailKey) {
      var current = customerSheet.getRange(i + 1, lastOrderColIndex).getValue();
      if (!current || now > new Date(current)) {
        customerSheet.getRange(i + 1, lastOrderColIndex).setValue(now);
      }
      sortCustomersByDate();
      return;
    }
  }

  if (data.isNew) {
    customerSheet.appendRow([data.email, data.name, data.phone, data.address, now]);
    sortCustomersByDate();
  }
}

function sortCustomersByDate() {
  var ss            = SpreadsheetApp.getActiveSpreadsheet();
  var customerSheet = ss.getSheetByName(customerSheetName);
  if (!customerSheet) return;
  var lastRow = customerSheet.getLastRow();
  var lastCol = customerSheet.getLastColumn();
  if (lastRow <= 1) return;
  customerSheet.getRange(2, 1, lastRow - 1, lastCol)
    .sort({ column: lastOrderColIndex, ascending: false });
}

function syncCustomers() {
  var ss            = SpreadsheetApp.getActiveSpreadsheet();
  var formSheet     = ss.getSheetByName(formSheetName);
  var customerSheet = ss.getSheetByName(customerSheetName);
  if (!formSheet || !customerSheet) return;

  var formResponses = formSheet.getDataRange().getValues();
  var customerData  = customerSheet.getDataRange().getValues();

  var customerMap = {};
  customerData.forEach(function(row, index) {
    var email = row[emailIndexInCustomerSheet];
    if (email) customerMap[email.toString().toLowerCase()] = index + 1;
  });

  var newCustomers = [];

  for (var i = 1; i < formResponses.length; i++) {
    var row         = formResponses[i];
    var timestamp   = row[timestampColumnIndex - 1];
    var email       = row[uniqueIdColumnIndex - 1];
    var statusEntry = row[newCustomerStatusIndex - 1];

    if (!email || !email.toString().includes('@')) continue;

    var emailKey           = email.toString().toLowerCase();
    var isNewCustomerEntry = (statusEntry && statusEntry.toString().trim() === targetNewStatus);

    if (customerMap[emailKey]) {
      var existingRow      = customerMap[emailKey];
      var currentSavedDate = customerSheet.getRange(existingRow, lastOrderColIndex).getValue();
      if (!currentSavedDate || new Date(timestamp) > new Date(currentSavedDate)) {
        customerSheet.getRange(existingRow, lastOrderColIndex).setValue(timestamp);
      }
    } else if (isNewCustomerEntry) {
      var newCustomerRow = customerDataIndices.map(function(colIndex) { return row[colIndex - 1]; });
      newCustomerRow[4]  = timestamp;
      newCustomers.push(newCustomerRow);
      customerMap[emailKey] = true;
    }
  }

  if (newCustomers.length > 0) {
    customerSheet.getRange(customerSheet.getLastRow() + 1, 1,
      newCustomers.length, newCustomers[0].length).setValues(newCustomers);
  }

  sortCustomersByDate();
}
function sendReengagementOne(data) {
  var name  = data.name  || 'Friend';
  var email = data.email || '';
  var phone = data.phone || '';

  if (!email && !phone) {
    return jsonResponse({ success: false, error: 'No email or phone for ' + name });
  }

  if (email) sendReengagementEmail(name, email);
  if (phone) logSmsQueue(name, phone);

  logReengageSend(name, email, phone, 'individual');
  return jsonResponse({ success: true, name: name, emailed: !!email, smsLogged: !!phone });
}
function sendReengagementAll(data) {
  var customers = data.customers || [];
  var sent = 0, errors = 0;

  customers.forEach(function(c) {
    try {
      if (c.email) sendReengagementEmail(c.name, c.email);
      if (c.phone) logSmsQueue(c.name, c.phone);
      logReengageSend(c.name, c.email, c.phone, 'bulk');
      sent++;
    } catch (err) {
      errors++;
    }
  });

  return jsonResponse({ success: true, total: customers.length, sent: sent, errors: errors });
}
function logSmsQueue(name, phone) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('SMSQueue');
  if (!sheet) {
    sheet = ss.insertSheet('SMSQueue');
    sheet.appendRow(['Timestamp', 'Name', 'Phone', 'Message', 'Status']);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  }
  var msg =
    'Hi ' + name + '!  We miss you at Ladle & Spoon! ' +
    'Come back with 10% off — use code WELCOMEBACK at checkout. ' +
    'Order at: ' + orderLink + ' - Reply STOP to unsubscribe.';
  sheet.appendRow([new Date(), name, phone, msg, 'PENDING']);
}
function logReengageSend(name, email, phone, mode) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ReengageLog');
  if (!sheet) {
    sheet = ss.insertSheet('ReengageLog');
    sheet.appendRow(['Timestamp', 'Name', 'Email', 'Phone', 'Mode']);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  }
  sheet.appendRow([new Date(), name, email || '', phone || '', mode]);
}

function sendSoupReminders(subject) {
  var ss            = SpreadsheetApp.getActiveSpreadsheet();
  var formSheet     = ss.getSheetByName(formSheetName);
  var customerSheet = ss.getSheetByName(customerSheetName);
  if (!formSheet || !customerSheet) return;

  var startOfWeek   = getStartOfWeek();
  var todayStr      = new Date().toDateString();
  var customerData  = customerSheet.getDataRange().getValues();
  var formResponses = formSheet.getDataRange().getValues().slice(1);

  var thisWeekOrders = formResponses.filter(function(row) {
    var timestamp = row[timestampColumnIndex - 1];
    return timestamp instanceof Date && timestamp.getTime() >= startOfWeek.getTime();
  });

  var orderedEmails = {};
  thisWeekOrders.forEach(function(row) {
    orderedEmails[row[uniqueIdColumnIndex - 1].toString().toLowerCase()] = true;
  });

  var emailsSentThisRun = 0;
  var quota             = MailApp.getRemainingDailyQuota();

  for (var i = 1; i < customerData.length; i++) {
    var row           = customerData[i];
    var email         = row[emailIndexInCustomerSheet] ? row[emailIndexInCustomerSheet].toString().toLowerCase() : "";
    var name          = row[nameIndexInCustomerData];
    var lastEmailDate = row[lastEmailDateColIndex - 1];
    var lastEmailStr  = lastEmailDate instanceof Date ? lastEmailDate.toDateString() : "";

    if (email && email.includes('@') && !orderedEmails[email] && lastEmailStr !== todayStr) {
      if (emailsSentThisRun >= quota) break;
      try {
        var body = generateEmailBody(subject, name);
        GmailApp.sendEmail(email, subject, "", {
          htmlBody: body,
          from:     SENDER_EMAIL,
          name:     SENDER_NAME
        });
        customerSheet.getRange(i + 1, lastEmailDateColIndex).setValue(new Date());
        emailsSentThisRun++;
      } catch(e) {
        Logger.log("Error sending to " + email + ": " + e.toString());
      }
    }
  }
}

function getStartOfWeek() {
  var today          = new Date();
  var dayOfWeek      = today.getDay();
  var daysToSubtract = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
  var monday         = new Date(today.getTime());
  monday.setDate(today.getDate() - daysToSubtract);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function triggerThursdayReminder() {
  sendSoupReminders("Your Weekly Soup Reminder from Ladle & Spoon");
}

function triggerFridayReminder() {
  sendSoupReminders("Last Chance! Soup Orders Close at 7 PM Tonight");
  try { sendFridayReminderSms(); } catch(e) { Logger.log('Friday SMS error: ' + e.message); }
}

function triggerTuesdayAnnouncement() {
  sendSoupReminders("This Week's Ladle & Spoon Menu is Live!");
  sendPushForTuesday();
}

function sendConfirmationEmail(data) {
  try {
    if (!data.email || !data.email.toString().includes('@')) {
      return;
    }

    var total       = parseFloat(data.total) || 0;
    var deliveryFee = parseFloat(data.deliveryFee) || 5;

    var itemRows = (data.items || []).map(function(i) {
      var lineTotal = (parseFloat(i.price) || 0) * (parseInt(i.qty) || 1);
      return '<tr>' +
        '<td style="padding:4px 0;color:#333">' + i.name + ' (' + i.size + ' x ' + i.qty + ')</td>' +
        '<td style="padding:4px 0;color:#333;text-align:right;">$' + lineTotal.toFixed(2) + '</td>' +
        '</tr>';
    }).join('');

    var payLine = data.payment === "venmo"
      ? '<div style="background:#e8f4fd;border-radius:10px;padding:16px;text-align:center;margin:8px 0;">' +
        '<p style="margin:0 0 4px;font-size:13px;color:#555;">Please send <strong>$' + total.toFixed(2) + '</strong> to <strong>' + VENMO_HANDLE + '</strong></p>' +
        '<p style="margin:0 0 12px;font-size:12px;color:#888;">Use your name as the note</p>' +
        '<table border="0" cellpadding="0" cellspacing="0" style="margin:0 auto;">' +
        '<tr><td align="center" bgcolor="#008CFF" style="border-radius:6px;">' +
        '<a href="https://venmo.com/Lia-Merritt2282" target="_blank" ' +
        'style="display:inline-block;padding:11px 24px;font-size:15px;font-weight:bold;' +
        'color:#ffffff !important;text-decoration:none;font-family:Arial,sans-serif;">Pay with Venmo</a>' +
        '</td></tr></table>' +
        '</div>'
      : '<div style="background:#f0faf0;border-radius:10px;padding:14px;text-align:center;margin:8px 0;">' +
        '<p style="margin:0;font-size:14px;color:#333;"> Please have <strong>$' + total.toFixed(2) + '</strong> cash ready for Monday delivery.</p>' +
        '</div>';

    var html =
      '<div style="font-family:Arial,sans-serif;background-color:#f4f4f4;padding:20px;">' +
      '<table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 4px 8px rgba(0,0,0,0.1);">' +
      '<tr><td align="center" style="padding:20px;background-color:#5D4037;border-top-left-radius:8px;border-top-right-radius:8px;">' +
      '<img src="' + LOGO_URL + '" alt="Ladle &amp; Spoon" width="150" style="display:block;"></td></tr>' +
      '<tr><td style="padding:30px;color:#333;font-size:15px;line-height:1.6;">' +
      '<p style="font-weight:bold;">Hi ' + (data.name||'').split(' ')[0] + ',</p>' +
      '<p style="font-size:18px;font-weight:600;margin-top:0;">Your order is confirmed!</p>' +
      '<p>We\'ll see you Monday for delivery.</p>' +
      '<table width="100%" style="border-top:1px solid #eee;border-bottom:1px solid #eee;margin:16px 0;padding:8px 0;">' +
      itemRows +
      '<tr><td style="padding:8px 0 4px;font-size:12px;color:#888;">Delivery fee</td>' +
      '<td style="padding:8px 0 4px;font-size:12px;color:#888;text-align:right;">$' + deliveryFee.toFixed(2) + '</td></tr>' +
      '<tr><td style="padding:4px 0;font-weight:bold;font-size:16px;">Total</td>' +
      '<td style="padding:4px 0;font-weight:bold;font-size:16px;text-align:right;">$' + total.toFixed(2) + '</td></tr>' +
      '</table>' +
      '<p style="margin:12px 0 4px;font-weight:bold;">Payment</p>' +
      payLine +
      '<p style="margin-top:12px;"><strong>Delivery address:</strong><br>' + data.address + '</p>' +
      (data.notes ? '<p><strong>Your notes:</strong><br>' + data.notes + '</p>' : '') +
      '<p>Questions? Reply to this email.</p>' +
      '<p><b>The Ladle &amp; Spoon Team</b></p></td></tr>' +
      '<tr><td align="center" style="padding:15px;font-size:12px;color:#777;background:#eee;border-bottom-left-radius:8px;border-bottom-right-radius:8px;">' +
      '<p style="margin:0;">Questions? Email us at ' + SENDER_EMAIL + '</p>' +
      '<p style="margin:5px 0 0;">&copy; ' + new Date().getFullYear() + ' Ladle &amp; Spoon</p>' +
      '</td></tr></table></div>';

    GmailApp.sendEmail(data.email, "Your Ladle & Spoon Order is Confirmed!", "", {
      htmlBody: html,
      from:     SENDER_EMAIL,
      name:     SENDER_NAME
    });
  } catch(err) {
  }
}

function handleSwap(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Subscriber Swaps") || ss.insertSheet("Subscriber Swaps");
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,5).setValues([["Timestamp","Email","Name","New Soup","New Salad"]]);
  }
  sheet.appendRow([new Date(), data.email||"", data.name||"", data.soup||"", data.salad||""]);

  var subName  = data.name  || 'Unknown';
  var subEmail = data.email || 'Unknown';

  GmailApp.sendEmail(LIA_EMAIL,
    "Subscriber Swap - " + subName,
    "Subscriber: " + subName + "\n" +
    "Email:      " + subEmail + "\n\n" +
    "Wants to swap this week:\n\n" +
    "  Soup:  " + (data.soup  || "no change") + "\n" +
    "  Salad: " + (data.salad || "no change") + "\n\n" +
    "Please update before Monday."
  );
  return jsonResponse({ success: true });
}

function handleNotificationToken(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Push Tokens") || ss.insertSheet("Push Tokens");
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,3).setValues([["Email","Token","Subscribed At"]]);
  }
  var tokens = sheet.getDataRange().getValues();
  var found  = -1;
  tokens.forEach(function(r, i) { if (i > 0 && r[0] === data.email) found = i; });
  if (found >= 0) {
    sheet.getRange(found + 1, 2, 1, 2).setValues([[data.token, new Date()]]);
  } else {
    sheet.appendRow([data.email, data.token, new Date()]);
  }
  return jsonResponse({ success: true });
}

function handleBroadcast(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Push Tokens");
  if (!sheet || sheet.getLastRow() < 2) {
    return jsonResponse({ success: false, error: "No subscribers" });
  }
  var tokens = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues()
    .map(function(r) { return r[0]; })
    .filter(function(t) { return t && t.length > 10; });
  if (tokens.length === 0) return jsonResponse({ success: false, error: "No valid tokens" });
  var sent = sendFCMNotification(tokens, data.title || ' Ladle & Spoon', data.body || "Check this week's menu!");
  return jsonResponse({ success: true, sent: sent });
}

function sendFCMNotification(tokens, title, body) {
  var accessToken = ScriptApp.getOAuthToken();
  var url         = 'https://fcm.googleapis.com/v1/projects/' + FCM_PROJECT_ID + '/messages:send';
  var sent        = 0;

  tokens.forEach(function(token) {
    var payload = {
      message: {
        token: token,
        data: {
          title: title,
          body:  body,
          url:   orderLink,
          icon:  LOGO_URL
        },
        webpush: { headers: { TTL: '86400' } }
      }
    };
    try {
      var response = UrlFetchApp.fetch(url, {
        method:  'post',
        headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        payload:            JSON.stringify(payload),
        muteHttpExceptions: true
      });
      if (response.getResponseCode() === 200) sent++;
      else Logger.log("FCM error for token " + token.substring(0,20) + ": " + response.getContentText());
    } catch(err) {
    }
    Utilities.sleep(50);
  });
  return sent;
}

function sendPushForTuesday() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Push Tokens");
  if (!sheet || sheet.getLastRow() < 2) return;
  var tokens = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues()
    .map(function(r) { return r[0]; })
    .filter(function(t) { return t && t.length > 10; });
  if (tokens.length > 0) {
    var sent = sendFCMNotification(tokens, ' This week\'s Ladle & Spoon menu is live!', 'Order by Friday 6 PM for Monday delivery!');
  }
}

function testPushNotification() {
  try {
    var token = ScriptApp.getOAuthToken();
    Logger.log("OAuth token obtained: " + token.substring(0,20) + "...");
  } catch(e) {
    return;
  }
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Push Tokens");
  if (!sheet || sheet.getLastRow() < 2) {
    return;
  }
  var allRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  var tokens  = allRows.map(function(r) { return r[1]; }).filter(function(t) { return t && t.toString().length > 10; });
  if (tokens.length === 0) { Logger.log("No valid tokens in Push Tokens sheet."); return; }

  var accessToken = ScriptApp.getOAuthToken();
  var url         = 'https://fcm.googleapis.com/v1/projects/' + FCM_PROJECT_ID + '/messages:send';
  var payload     = {
    message: {
      token:        tokens[0],
      notification: { title: 'Test from Ladle & Spoon', body: 'Push notifications are working!' },
      webpush:      { notification: { icon: LOGO_URL } }
    }
  };
  try {
    var response = UrlFetchApp.fetch(url, {
      method:  'post',
      headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      payload:            JSON.stringify(payload),
      muteHttpExceptions: true
    });
    Logger.log("FCM response code: " + response.getResponseCode());
    Logger.log("FCM response: " + response.getContentText());
  } catch(err) {
  }
}

function handlePublishMenu(data) {
  try {
    triggerTuesdayAnnouncement();
    try { sendMenuPublishSms(); } catch(e) { Logger.log('Publish SMS error: ' + e.message); }
    return jsonResponse({ success: true, message: "Menu published — emails, SMS and push sent" });
  } catch(err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function handleSaveMenu(data) {
  try {
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var sheet   = ss.getSheetByName(formSheetName);
    if (!sheet) return jsonResponse({ success: false, error: 'Soup orders tab not found' });
    var allItems = data.items || [];
    if(!allItems.length){
      var soups  = data.soups  || [];
      var salads = data.salads || [];
      var bakery = data.bakery || [];
      var other  = data.other  || [];
      allItems = soups.concat(salads).concat(bakery).concat(other);
    }

    var lastCol = Math.max(sheet.getLastColumn(), 25);
    var headers = sheet.getRange(4, 1, 1, lastCol).getValues()[0];
    var itemColStart = 6;
    for (var c = 6; c < headers.length; c++) {
      if (/\$\d+/.test(headers[c].toString()) || headers[c].toString().trim() === '') {
        itemColStart = c;
        break;
      }
    }
    if(itemColStart < 6) itemColStart = 6;
    var newItemHeaders = [];
    allItems.forEach(function(item) {
      var cat = (item.cat || 'soup').toLowerCase();
      if(cat === 'soup'){
        newItemHeaders.push(item.n + ' Pints [$8]');
        newItemHeaders.push(item.n + ' Quarts [$15]');
      } else if(cat === 'salad'){
        var sz = item.sz || [];
        if(sz.length >= 2){
          newItemHeaders.push(item.n + ' ' + sz[0].l + ' [$' + sz[0].p + ']');
          newItemHeaders.push(item.n + ' ' + sz[1].l + ' [$' + sz[1].p + ']');
        } else {
          newItemHeaders.push(item.n + ' [$' + (sz.length ? sz[0].p : 15) + ']');
        }
      } else if(cat === 'bakery'){
        newItemHeaders.push(item.n + ' [$5]');
      } else {
        var sz = item.sz || [];
        if(sz.length >= 2){
          newItemHeaders.push(item.n + ' ' + sz[0].l + ' [$' + sz[0].p + ']');
          newItemHeaders.push(item.n + ' ' + sz[1].l + ' [$' + sz[1].p + ']');
        } else if(sz.length === 1){
          newItemHeaders.push(item.n + ' [$' + sz[0].p + ']');
        } else {
          newItemHeaders.push(item.n + ' [$15]');
        }
      }
    });
    var fixedHeaders = ['Timestamp', 'Email Address', 'Are you a New Customer?', 'First and Last Name', 'Your Phone #', 'Your Delivery Address (Delivery Zone shown below in blue)'];
    fixedHeaders.forEach(function(h, i){
      sheet.getRange(4, i + 1).setValue(h);
    });
    for (var cc = itemColStart; cc < itemColStart + 30; cc++) {
      sheet.getRange(4, cc + 1).setValue('');
    }
    newItemHeaders.forEach(function(h, i) {
      sheet.getRange(4, itemColStart + i + 1).setValue(h);
    });
    var lastItemCol = itemColStart + newItemHeaders.length;
    sheet.getRange(4, lastItemCol + 1).setValue('Comments or Special Instructions');
    sheet.getRange(4, lastItemCol + 2).setValue('How Will You be Paying?');
    fixP3Formula(sheet, itemColStart, lastItemCol);
    PropertiesService.getScriptProperties().setProperty('current_menu', JSON.stringify({
      items: allItems, updated: new Date().toISOString()
    }));

    Logger.log('Menu saved: ' + allItems.length + ' items (' + newItemHeaders.length + ' columns)');
    return jsonResponse({ success: true, items: allItems.length, columns: newItemHeaders.length });
  } catch(err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function parseTabName(name) {
  var parts = name.split('/');
  var m = parseInt(parts[0]);
  var d = parseInt(parts[1]);
  var yr = parts[2] ? (parseInt(parts[2]) < 100 ? 2000 + parseInt(parts[2]) : parseInt(parts[2])) : null;
  return {month: m, day: d, year: yr};
}

function getTabYear(tabName, sheet, now) {
  var parsed = parseTabName(tabName);
  if(parsed.year) return parsed.year;
  try {
    var ts = sheet.getRange(5, 1).getValue();
    if(ts instanceof Date && ts.getFullYear() > 2020) {
      var tsYear = ts.getFullYear();
      var tsMonth = ts.getMonth() + 1;
      if(parsed.month < tsMonth && tsMonth - parsed.month > 3) return tsYear + 1;
      return tsYear;
    }
  } catch(e) {}
  var thisYear = new Date(now.getFullYear(), parsed.month-1, parsed.day);
  return thisYear <= now ? now.getFullYear() : now.getFullYear()-1;
}

function handleGetRetention() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheets  = ss.getSheets();
  var now     = new Date();

  var archiveTabs = sheets.filter(function(s){
    return /^\d+\/\d+\/\d+$/.test(s.getName());
  });

  archiveTabs.sort(function(a, b){
    var ap = parseTabName(a.getName()), bp = parseTabName(b.getName());
    var aD = new Date((ap.year||2025), (ap.month||1)-1, (ap.day||1));
    var bD = new Date((bp.year||2025), (bp.month||1)-1, (bp.day||1));
    return bD - aD;
  });

  var tabs = archiveTabs.slice(0, 49);
  var currentSheet = ss.getSheetByName(formSheetName);
  var allTabs = currentSheet ? [currentSheet].concat(tabs) : tabs;

  var weekLabels = allTabs.map(function(s){
    var n = s.getName();
    if(n === formSheetName) return 'Current';
    var p = parseTabName(n);
    return p.month + '/' + p.day + '/' + (p.year||'');
  });

  var customerMap = {};

  allTabs.forEach(function(sheet, wi){
    if(sheet.getLastRow() < 5) return;
    var lastCol  = Math.min(sheet.getLastColumn(), 35);
    var headers  = sheet.getRange(4, 1, 1, lastCol).getValues()[0];
    var emailCol = headers.findIndex(function(h){ return /email/i.test(h); });
    var nameCol  = headers.findIndex(function(h){ return /first.*last|^name/i.test(h); });
    var itemCols = [];
    headers.forEach(function(h,i){
      if(i >= 6 && /\$\d+/.test(h.toString())) itemCols.push(i);
    });
    if(emailCol < 0 || sheet.getLastRow() < 5) return;
    var rows = sheet.getRange(5, 1, sheet.getLastRow()-4, lastCol).getValues();
    rows.forEach(function(row){
      var email = row[emailCol] ? row[emailCol].toString().trim() : '';
      if(!email || !email.includes('@')) return;
      var hasOrder = itemCols.some(function(i){ return (parseFloat(row[i])||0) > 0; });
      if(!hasOrder) return;
      if(!customerMap[email]){
        customerMap[email] = {
          name: nameCol >= 0 ? row[nameCol].toString().trim() : email.split('@')[0],
          email: email,
          orderWeeks: []
        };
      }
      if(customerMap[email].orderWeeks.indexOf(wi) < 0){
        customerMap[email].orderWeeks.push(wi);
      }
    });
  });

  var customers = Object.values(customerMap);

  var merged = {};
  customers.forEach(function(c){
    var normName = c.name.toLowerCase().trim().replace(/\s+/g,' ');
    if(merged[normName]){
      c.orderWeeks.forEach(function(w){
        if(merged[normName].orderWeeks.indexOf(w) < 0) merged[normName].orderWeeks.push(w);
      });
      if(c.email.includes('@') && merged[normName].email.split('@')[0].length < c.email.split('@')[0].length){
        merged[normName].email = c.email;
      }
    } else {
      merged[normName] = {name: c.name, email: c.email, orderWeeks: c.orderWeeks.slice()};
    }
  });

  var deduped = Object.values(merged);
  return jsonResponse({ weeks: weekLabels, customers: deduped });
}

function handleGetWeekDetail(params) {
  var tabName = params.tab || '';
  if(!tabName) return jsonResponse({orders:[]});

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(tabName);
  if(!sheet || sheet.getLastRow() < 5) return jsonResponse({orders:[]});

  var lastCol  = sheet.getLastColumn();
  var headers  = sheet.getRange(4, 1, 1, lastCol).getValues()[0];
  var rows     = sheet.getRange(5, 1, sheet.getLastRow()-4, lastCol).getValues();

  var nameCol  = headers.findIndex(function(h){ return /first.*last|^name/i.test(h); });
  var emailCol = headers.findIndex(function(h){ return /email/i.test(h); });
  var phoneCol = headers.findIndex(function(h){ return /phone/i.test(h); });
  var addrCol  = headers.findIndex(function(h){ return /delivery.*address|^address$/i.test(h) && !/email/i.test(h); });
  var payCol   = headers.findIndex(function(h){ return /how will you.*pay|^payment/i.test(h); });
  var noteCol  = headers.findIndex(function(h){ return /comment|special|instruction/i.test(h); });

  var itemCols = [];
  headers.forEach(function(h,i){
    if(i >= 6 && /\$\d+/.test(h.toString()) && !/sold out/i.test(h)){
      var pm = h.toString().match(/\$(\d+)/);
      itemCols.push({idx:i, label:h.toString(), price: pm ? parseInt(pm[1]) : 8});
    }
  });
  var tabYear = new Date().getFullYear();
  try {
    var ts = sheet.getRange(5,1).getValue();
    if(ts instanceof Date && ts.getFullYear() > 2020) tabYear = ts.getFullYear();
  } catch(e){}

  var orders = [];
  rows.forEach(function(row){
    var email = emailCol >= 0 ? row[emailCol].toString().trim() : '';
    if(!email || !email.includes('@')) return;

    var items = []; var foodTotal = 0;
    itemCols.forEach(function(col){
      var qty = parseFloat(row[col.idx]) || 0;
      if(qty <= 0) return;
      var sm = col.label.match(/\b(Small|Large|Pints?|Quarts?|Single|Each)\b/i);
      var size = sm ? sm[1].replace(/s$/i,'') : '';
      var name = col.label.replace(/[\[\]]/g,'').replace(/\$\d+/g,'')
        .replace(/\b(small|large|pints?|quarts?|single|each)\b/gi,'').replace(/\s+/g,' ').trim();
      items.push({name:name, size:size, qty:qty, price:col.price});
      foodTotal += qty * col.price;
    });
    if(!items.length) return;

    var noteText = noteCol >= 0 ? row[noteCol].toString() : '';
    var payText  = payCol  >= 0 ? row[payCol].toString()  : '';
    var del = tabYear >= 2026 ? 5 : 0;

    orders.push({
      name:  nameCol  >= 0 ? row[nameCol].toString()  : '',
      email: email,
      phone: phoneCol >= 0 ? row[phoneCol].toString() : '',
      addr:  addrCol  >= 0 ? row[addrCol].toString()  : '',
      pay:   /venmo/i.test(payText) ? 'venmo' : 'cash',
      notes: noteText.replace(/\[.*?Order\]/g,'').trim(),
      items: items,
      food:  foodTotal,
      del:   del,
      total: foodTotal + del
    });
  });

  return jsonResponse({orders: orders, tab: tabName});
}

function handleGetMonthlyDetail(params) {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheets  = ss.getSheets();
  var now     = new Date();
  var months  = {};
  var cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - 18);
  var startTime = new Date().getTime();
  var allTabs = sheets.filter(function(s){
    if(s.getName() === formSheetName) return true;
    if(!/^\d+\/\d+(\/\d+)?$/.test(s.getName())) return false;
    var parts = s.getName().split('/');
    var m = parseInt(parts[0]), d = parseInt(parts[1]);
    var thisYear = new Date(now.getFullYear(), m-1, d);
    var lastYear = new Date(now.getFullYear()-1, m-1, d);
    var tabDate  = thisYear <= now ? thisYear : lastYear;
    return tabDate >= cutoff;
  });
  allTabs.sort(function(a, b){
    var ap = parseTabName(a.getName()), bp = parseTabName(b.getName());
    var aYr = ap.year || now.getFullYear(), bYr = bp.year || now.getFullYear();
    var aVal = aYr * 10000 + (ap.month||0) * 100 + (ap.day||0);
    var bVal = bYr * 10000 + (bp.month||0) * 100 + (bp.day||0);
    if(a.getName() === formSheetName) return -1;
    if(b.getName() === formSheetName) return 1;
    return bVal - aVal;
  });

  allTabs.forEach(function(sheet){
    if(new Date().getTime() - startTime > 25000) return;
    if(!sheet || sheet.getLastRow() < 5) return;
    var tabName = sheet.getName();
    var tabYear  = now.getFullYear();
    var tabMonth = null;

    if(tabName === formSheetName){
      tabMonth = now.getMonth() + 1;
      tabYear  = now.getFullYear();
    } else {
      var parsed2 = parseTabName(tabName);
      tabMonth = parsed2.month;
      if(parsed2.year){
        tabYear = parsed2.year;
      } else {
        tabYear = getTabYear(tabName, sheet, now);
      }
    }

    var mKey = tabMonth + '/' + tabYear;
    var tabDate3 = new Date(tabYear, tabMonth-1, parseTabName(tabName).day || 1);
    var recentCutoff2 = new Date(now); recentCutoff2.setMonth(recentCutoff2.getMonth() - 6);
    var isRecent = tabName === formSheetName || tabDate3 >= recentCutoff2;
    var lastCol  = Math.min(sheet.getLastColumn(), 35);
    var headers  = sheet.getRange(4, 1, 1, lastCol).getValues()[0];
    var lastRow  = sheet.getLastRow();
    var weekLabel = tabName === formSheetName
      ? 'Current Week'
      : 'Delivered ' + tabName.replace(/\/(\d{2})$/, function(m, yr){ return '/20'+yr; });

    if(!isRecent){
      var orderCount = 0;
      var stubFood = 0, stubDel = 0;
      try {
        var emailCol2 = headers.findIndex(function(h){ return /email/i.test(h); });
        if(emailCol2 >= 0 && lastRow > 4){
          var emailVals = sheet.getRange(5, emailCol2+1, lastRow-4, 1).getValues();
          emailVals.forEach(function(r){ if(r[0] && r[0].toString().includes('@')) orderCount++; });
        }
        var row3 = sheet.getRange(3, 7, 1, lastCol - 6).getValues()[0];
        row3.forEach(function(v){ var n = parseFloat(v); if(!isNaN(n) && n > 0) stubFood += n; });
        stubDel = orderCount * (tabYear >= 2026 ? 5 : 0);
      } catch(e){}
      if(!months[mKey]) months[mKey] = {key:mKey, month:tabMonth, year:tabYear, weeks:[]};
      months[mKey].weeks.push({
        label: weekLabel, tabName: tabName,
        orders: Array(orderCount).fill({name:'', email:'x', items:[], food:0, del:0, total:0}),
        _orderCount: orderCount,
        _stubFood: stubFood,
        _stubDel: stubDel,
        _stubTotal: stubFood + stubDel
      });
      return;
    }
    var rows = lastRow > 4 ? sheet.getRange(5, 1, lastRow-4, lastCol).getValues() : [];

    var nameCol  = headers.findIndex(function(h){ return /first.*last|^name/i.test(h); });
    var emailCol = headers.findIndex(function(h){ return /email/i.test(h); });
    var phoneCol = headers.findIndex(function(h){ return /phone/i.test(h); });
    var addrCol  = headers.findIndex(function(h){ return /delivery.*address|^address$/i.test(h) && !/email/i.test(h); });
    var payCol   = headers.findIndex(function(h){ return /how will you.*pay|^payment/i.test(h); });
    var noteCol  = headers.findIndex(function(h){ return /comment|special|instruction/i.test(h); });
    var itemCols = [];
    headers.forEach(function(h,i){
      if(i >= 6 && /\$\d+/.test(h.toString()) && !/sold out/i.test(h)){
        var pm = h.toString().match(/\$(\d+)/);
        itemCols.push({idx:i, label:h.toString(), price: pm ? parseInt(pm[1]) : 8});
      }
    });

    var weekOrders = [];
    var weekFood = 0, weekDel = 0;
    var recentCutoff = new Date(now);
    recentCutoff.setMonth(recentCutoff.getMonth() - 3);
    var tabDate2 = new Date(tabYear, tabMonth-1, parseInt(tabName.split('/')[1]||1));
    var includeDetail = (tabName === formSheetName) || tabDate2 >= recentCutoff;

    rows.forEach(function(row){
      var email = emailCol >= 0 ? row[emailCol].toString().trim() : '';
      if(!email || !email.includes('@')) return;

      var items = []; var foodTotal = 0;
      itemCols.forEach(function(col){
        var qty = parseFloat(row[col.idx]) || 0;
        if(qty <= 0) return;
        var sm = col.label.match(/\b(Small|Large|Pints?|Quarts?|Single|Each)\b/i);
        var size = sm ? sm[1].replace(/s$/i,'') : '';
        var name = col.label.replace(/[\[\]]/g,'').replace(/\$\d+/g,'')
          .replace(/\b(small|large|pints?|quarts?|single|each)\b/gi,'').replace(/\s+/g,' ').trim();
        var price = col.price;
        items.push({name:name, size:size, qty:qty, price:price});
        foodTotal += qty * price;
      });
      if(!items.length) return;

      var del = tabYear >= 2026 ? 5 : 0;
      weekFood += foodTotal;
      weekDel  += del;

      if(includeDetail){
        var noteText = noteCol >= 0 ? row[noteCol].toString() : '';
        var payText  = payCol  >= 0 ? row[payCol].toString()  : '';
        var isVenmo  = /venmo/i.test(payText);
        var isApp    = noteText.includes('[App Order]') || (tabYear >= 2026 && tabMonth >= 5);
        weekOrders.push({
          name:   nameCol  >= 0 ? row[nameCol].toString()  : '',
          email:  email,
          phone:  phoneCol >= 0 ? row[phoneCol].toString() : '',
          addr:   addrCol  >= 0 ? row[addrCol].toString()  : '',
          pay:    isVenmo ? 'venmo' : 'cash',
          source: isApp ? 'app' : 'form',
          notes:  noteText.replace(/\[.*?Order\]/g,'').trim(),
          items:  items,
          food:   foodTotal,
          del:    del,
          total:  foodTotal + del
        });
      } else {
        weekOrders.push({name:'', email:email, items:items, food:foodTotal, del:del, total:foodTotal+del});
      }
    });

    if(!weekOrders.length) return;
    if(!months[mKey]){
      months[mKey] = {
        key: mKey, month: tabMonth, year: tabYear,
        weeks: []
      };
    }

    months[mKey].weeks.push({
      label:  weekLabel,
      tabName: tabName,
      orders: weekOrders
    });
  });
  Object.keys(months).forEach(function(k){
    months[k].weeks.sort(function(a,b){
      if(a.tabName === formSheetName) return -1;
      if(b.tabName === formSheetName) return 1;
      var ap = a.tabName.split('/'), bp = b.tabName.split('/');
      return parseInt(bp[1])*100+parseInt(bp[0]) - (parseInt(ap[1])*100+parseInt(ap[0]));
    });
  });

  return jsonResponse({months: months});
}

function handleGetCustomItems() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Custom Items");
  if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ items: [] });

  var rows  = sheet.getRange(2, 1, sheet.getLastRow()-1, 8).getValues();
  var items = rows.filter(function(r){ return r[0]; }).map(function(r){
    var sz = [];
    (r[5]||'').toString().split(',').forEach(function(p){
      var parts = p.trim().split(':$');
      if(parts.length === 2) sz.push({ l: parts[0].trim(), p: parseFloat(parts[1])||0 });
    });
    if(!sz.length) sz = [{l:'Pint',p:8},{l:'Quart',p:15}];
    return {
      id:   r[0].toString(),
      n:    r[1].toString(),
      em:   r[2].toString() || '',
      cat:  r[3].toString() || 'soup',
      desc: r[4].toString() || '',
      sz:   sz,
      tags:     [],
      soldout:  false,
      al:       [],
      soupId:   r[0].toString(),
      rev:      0,
      rating:   0,
      reviews:  []
    };
  });
  return jsonResponse({ items: items });
}

function handleSaveCustomItem(data) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Custom Items") || ss.insertSheet("Custom Items");
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["ID","Name","Emoji","Category","Description","Price(s)","Added","Photo URL"]);
      sheet.getRange(1,1,1,8).setFontWeight('bold');
    }
    var item     = data.item || {};
    var priceStr = (item.sz||[]).map(function(s){ return s.l+':$'+s.p; }).join(', ');
    var existing = -1;
    if(sheet.getLastRow() > 1){
      var ids = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
      ids.forEach(function(r,i){ if(r[0]===item.id) existing = i+2; });
    }

    var row = [item.id||'', item.n||'', item.em||'', item.cat||'soup', item.desc||'', priceStr, item.added||new Date().toISOString(), item.photoUrl||''];
    if(existing > 0){
      sheet.getRange(existing,1,1,8).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    return jsonResponse({success:true});
  } catch(err) {
    return jsonResponse({success:false, error:err.message});
  }
}

function handleSavePhoto(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Soup Photos") || ss.insertSheet("Soup Photos");
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,3).setValues([["Soup ID","Soup Name","Cloudinary URL"]]);
  }
  var rows  = sheet.getDataRange().getValues();
  var found = -1;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.soupId) { found = i + 1; break; }
  }
  if (found >= 0) {
    sheet.getRange(found, 1, 1, 3).setValues([[data.soupId, data.name || '', data.url]]);
  } else {
    sheet.appendRow([data.soupId, data.name || '', data.url]);
  }
  return jsonResponse({ success: true });
}

function handleGetPhotos() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Soup Photos");
  if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ photos: {} });
  var rows   = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  var photos = {};
  rows.forEach(function(r) { if (r[0] && r[2]) photos[r[0]] = r[2]; });
  return jsonResponse({ photos: photos });
}

function handleGetDashboard() {
  var ss          = SpreadsheetApp.getActiveSpreadsheet();
  var ordersSheet = ss.getSheetByName("Soup orders");
  var weekRevenue = 0;
  var weekOrders  = 0;
  if (ordersSheet && ordersSheet.getLastRow() > 4) {
    weekOrders = Math.max(0, ordersSheet.getLastRow() - 4);
    var oHeaders = ordersSheet.getRange(4, 1, 1, ordersSheet.getLastColumn()).getValues()[0];
    var oRows    = ordersSheet.getRange(5, 1, ordersSheet.getLastRow()-4, ordersSheet.getLastColumn()).getValues();
    var emailIdx = oHeaders.findIndex(function(h){ return /email/i.test(h); });
    var itemCols = [];
    oHeaders.forEach(function(h, i){
      if(i >= 6 && /\$\d+/.test(h.toString()) && !/sold out/i.test(h)){
        var pm = h.toString().match(/\$(\d+)/);
        itemCols.push({idx: i, price: pm ? parseInt(pm[1]) : 8});
      }
    });
    oRows.forEach(function(row){
      var email = emailIdx >= 0 ? row[emailIdx] : '';
      if(!email || !email.toString().includes('@')) return;
      itemCols.forEach(function(col){
        weekRevenue += (parseFloat(row[col.idx])||0) * col.price;
      });
    });
    weekRevenue += weekOrders * 5;
    Logger.log("weekRevenue (calculated): " + weekRevenue + " | weekOrders: " + weekOrders);
  }
  var allMonthly = getDashMonthly(ss);
  var yearlyRev  = allMonthly.reduce(function(sum, m){ return sum + (m.r||0); }, 0);
  var totalWeeks = ss.getSheets().filter(function(s){ return /\d+-\d+/.test(s.getName()) || s.getName() === 'Soup orders'; }).length;

  return jsonResponse({
    orders:      getDashOrders(ss),
    customers:   getDashCustomers(ss),
    monthly:     allMonthly,
    intel:       getDashIntel(ss),
    react:       getDashReact(ss),
    areas:       getDashAreas(ss),
    route:       getDashRoute(ss),
    wkmenu:      getDashWkMenu(ss),
    photos:      getDashPhotos(ss),
    weekRevenue: weekRevenue,
    weekOrders:  weekOrders,
    yearlyRev:   yearlyRev,
    weekCount:   totalWeeks,
    scriptVersion: 'v2026-05-13-gs12',
    updated:     new Date().toString()
  });
}

function getDashOrders(ss) {
  var sheet = ss.getSheetByName("Soup orders");
  if (!sheet || sheet.getLastRow() < 5) return [];
  var headers  = sheet.getRange(4, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rows     = sheet.getRange(5, 1, sheet.getLastRow() - 4, sheet.getLastColumn()).getValues();
  var emailCol = headers.findIndex(function(h){ return /email/i.test(h); });
  var nameCol  = headers.findIndex(function(h){ return /first.*last|name/i.test(h); });
  var addrCol  = headers.findIndex(function(h){ return /delivery.*address|^address$/i.test(h) && !/email/i.test(h); });
  var payCol   = headers.findIndex(function(h){ return /how will you.*pay|^payment/i.test(h) || (h.toString().toLowerCase() === 'payment'); });
  if(payCol < 0) payCol = headers.findIndex(function(h){ return /pay/i.test(h) && !/display|company/i.test(h); });
  var noteCol  = headers.findIndex(function(h){ return /comment|special|instruction/i.test(h); });
  var itemCols = [];
  headers.forEach(function(h, i) {
    if(i >= 6 && /\$\d+/.test(h.toString()) && !/sold out/i.test(h)) {
      var priceMatch = h.toString().match(/\$(\d+)/);
      itemCols.push({ idx: i, label: h.toString(), price: priceMatch ? parseInt(priceMatch[1]) : 8 });
    }
  });

  var orders = [];
  rows.forEach(function(row, ri) {
    var email = emailCol >= 0 ? row[emailCol] : '';
    if (!email || !email.toString().includes('@')) return;

    var items = [];
    var foodTotal = 0;
    itemCols.forEach(function(col) {
      var qty = parseFloat(row[col.idx]) || 0;
      if (qty <= 0) return;
      var sizeMatch = col.label.match(/\b(Small|Large|Pints?|Quarts?|Single|Each)\b/i);
      var size = sizeMatch ? sizeMatch[1].replace(/s$/i,'') : '';
      var name = col.label
        .replace(/[\[\]]/g,'').replace(/\$\d+/g,'')
        .replace(/\b(small|large|pints?|quarts?|single|each)\b/gi,'')
        .replace(/\s+/g,' ').trim();
      items.push({ name: name, size: size, qty: qty, price: col.price });
      foodTotal += qty * col.price;
    });

    var isVenmo  = (payCol >= 0 ? row[payCol] : '').toString().toLowerCase().includes('venmo');
    var noteText = (noteCol >= 0 ? row[noteCol] : '').toString();
    var source   = (noteText.includes('[App Order]') || noteText.includes('[ App Order]')) ? 'app' : 'form';
    var cleanNote = noteText.replace(/\[.*?Order\]/g,'').trim();
    var deliveryFee = 5;
    var grandTotal  = foodTotal + deliveryFee;

    orders.push({
      id:     '#' + String(ri + 1).padStart(3,'0'),
      n:      (nameCol >= 0 ? row[nameCol] : '').toString(),
      email:  email.toString(),
      it:     items.map(function(i){ return i.name+(i.size?' ('+i.size+')':'')+(i.qty>1?' x'+i.qty:''); }).join(', '),
      items:  items,
      addr:   (addrCol >= 0 ? row[addrCol] : '').toString(),
      note:   cleanNote,
      notes:  cleanNote,
      pay:    isVenmo ? 'venmo' : 'cash',
      source: source,
      total:  grandTotal,
      food:   foodTotal,
      del:    deliveryFee,
      tot:    String(grandTotal),
      st:     'new'
    });
  });
  return orders;
}

function getDashCustomers(ss) {
  var sheet = ss.getSheetByName("Customers");
  if (!sheet || sheet.getLastRow() < 2) return [];
  var ltvMap = {};
  var diveSheet = ss.getSheetByName("Customer Deep Dive");
  if (diveSheet && diveSheet.getLastRow() > 1) {
    var diveRows = diveSheet.getRange(2, 1, diveSheet.getLastRow()-1, 5).getValues();
    diveRows.forEach(function(r){
      var email = (r[1]||'').toString().toLowerCase().trim();
      if(email) ltvMap[email] = { ltv: parseFloat(r[2])||0, cnt: parseInt(r[3])||0 };
    });
  }

  var rows = sheet.getRange(2, 1, sheet.getLastRow()-1, 7).getValues();
  return rows
    .filter(function(r){ return r[0] && r[0].toString().includes('@'); })
    .map(function(r) {
      var name     = (r[1] || '').toString();
      var initials = name.split(' ').map(function(w){ return w[0]||''; }).join('').substring(0,2).toUpperCase();
      var email    = r[0].toString().toLowerCase().trim();
      var intel    = ltvMap[email] || { ltv: 0, cnt: 0 };
      return {
        email:  r[0].toString(),
        n:      name,
        i:      initials || '??',
        phone:  (r[2]||'').toString(),
        addr:   (r[3]||'').toString(),
        last:   r[4] ? Utilities.formatDate(new Date(r[4]), ss.getSpreadsheetTimeZone(), "MMM d, yyyy") : 'Unknown',
        lastTS: r[4] ? new Date(r[4]).getTime() : 0,
        ltv:    intel.ltv,
        cnt:    intel.cnt
      };
    });
}

function getDashMonthly(ss) {
  var sheet = ss.getSheetByName("Monthly Analysis");
  if (!sheet || sheet.getLastRow() < 2) return [];
  var rows    = sheet.getRange(2, 1, sheet.getLastRow()-1, 10).getValues();
  var results = [];
  rows.forEach(function(r) {
    var v = r[0];
    if (!v) return;
    var parts;
    if (v instanceof Date) {
      parts = [(v.getMonth()+1).toString(), v.getFullYear().toString()];
    } else {
      var vs = v.toString().trim();
      if (!vs || vs === 'FEBRUARY WE') return;
      if (vs.indexOf('-') >= 0) parts = vs.split('-');
      else if (vs.indexOf('/') >= 0) parts = vs.split('/');
      else return;
    }
    var monthNum = parseInt(parts[0]);
    var yearFull = parseInt(parts[1]);
    if (!monthNum || monthNum < 1 || monthNum > 12) return;
    if (!yearFull || yearFull < 2020) return;
    var months  = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var label   = months[monthNum] + " '" + yearFull.toString().slice(-2);
    var soup     = parseFloat(r[1]) || 0;
    var salad    = parseFloat(r[2]) || 0;
    var bakery   = parseFloat(r[3]) || 0;
    var misc     = parseFloat(r[4]) || 0;
    var delivery = parseFloat(r[5]) || 0;
    var food     = parseFloat(r[6]) || 0;
    var total    = parseFloat(r[7]) || 0;
    var avg_wk   = parseFloat(r[8]) || 0;
    var orders   = parseInt(r[9]) || 0;
    var avg_ord  = orders > 0 ? Math.round(food / orders) : (food > 0 ? Math.round(food / 30) : 0);
    results.push({
      m: label, r: total, total: Math.round(total),
      soup: Math.round(soup), salad: Math.round(salad),
      bakery: Math.round(bakery), misc: Math.round(misc),
      delivery: Math.round(delivery), food: Math.round(food),
      avg_wk: Math.round(avg_wk), avg_ord: avg_ord,
      orders: orders || (avg_ord > 0 ? Math.round(food / avg_ord) : 30)
    });
  });
  results.sort(function(a, b) {
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var ap = a.m.split(" '"), bp = b.m.split(" '");
    var ay = parseInt('20' + ap[1]), by = parseInt('20' + bp[1]);
    if (ay !== by) return ay - by;
    return months.indexOf(ap[0]) - months.indexOf(bp[0]);
  });
  return results;
}

function getDashIntel(ss) {
  var sheet = ss.getSheetByName("Soup Intelligence");
  if (!sheet || sheet.getLastRow() < 2) return [];
  var rows = sheet.getRange(2, 1, sheet.getLastRow()-1, 9).getValues();
  return rows.filter(function(r){ return r[0] && r[1]; }).map(function(r) {
    return {
      cat: r[0].toString(), n: r[1].toString(),
      qty: parseFloat(r[2])||0, unit: r[3].toString(),
      rev: parseFloat(r[4])||0, weeks: parseInt(r[5])||1,
      avg: parseFloat(r[6])||0, last: parseFloat(r[7])||0,
      trend: r[8].toString(), last_date: ''
    };
  });
}
function getDashReact(ss) {
  var sheet = ss.getSheetByName("Reactivation List");
  if (sheet && sheet.getLastRow() > 1) {
    var rows = sheet.getRange(2, 1, sheet.getLastRow()-1, 5).getValues();
    return rows.filter(function(r){ return r[0]; }).map(function(r) {
      return {
        n:      r[0].toString(),
        email:  r[1].toString(),
        last:   r[2].toString(),
        days:   parseInt(r[3])||0,
        orders: parseInt(r[4])||0,
        phone:  ''
      };
    });
  }
  var custSheet = ss.getSheetByName("Customers");
  if (!custSheet || custSheet.getLastRow() < 2) return [];
  var custRows = sheet ? [] : custSheet.getRange(2, 1, custSheet.getLastRow()-1, 5).getValues();
  var today    = new Date(); today.setHours(0,0,0,0);
  var results  = [];
  custRows.forEach(function(r) {
    if (!r[0] || !r[0].toString().includes('@')) return;
    var lastDate = r[4] ? new Date(r[4]) : null;
    if (!lastDate) return;
    var days = Math.round((today - lastDate) / (1000*60*60*24));
    if (days >= 28) {
      results.push({
        n:      (r[1]||'').toString(),
        email:  r[0].toString(),
        phone:  (r[2]||'').toString(),
        last:   Utilities.formatDate(lastDate, ss.getSpreadsheetTimeZone(), "MMM d, yyyy"),
        days:   days,
        orders: 0
      });
    }
  });
  results.sort(function(a,b){ return b.days - a.days; });
  return results;
}

function getDashAreas(ss) {
  var sheet  = ss.getSheetByName("Geo Density");
  if (!sheet || sheet.getLastRow() < 2) return [];
  var colors = ['#1B3D1C','#2E6B30','#3A7A3C','#4A8C4C','#5E9E5E','#7FAF6E','#8BBF7A'];
  var rows   = sheet.getRange(2, 1, Math.min(sheet.getLastRow()-1, 10), 4).getValues();
  return rows.filter(function(r){ return r[0]; }).map(function(r, i) {
    return { n: r[0].toString(), custs: parseInt(r[1])||0, del: parseInt(r[2])||0, score: parseInt(r[3])||0, col: colors[i % colors.length] };
  });
}

function getDashRoute(ss) {
  var orders = getDashOrders(ss);
  var stops  = [{lbl:'s', num:'H', n:"Lia's Kitchen", a:'1247 Bielby St, Waterford', ord:'', pay:'', note:'', lat:42.6812, lng:-83.3867}];
  orders.forEach(function(o, i) {
    stops.push({ num: String(i+1), n: o.n, a: o.addr||'Waterford', ord: o.it, tot: o.tot, pay: o.pay, note: o.note, lat: 42.6812, lng: -83.3867 });
  });
  stops.push({lbl:'e', num:'H', n:'Return Home', a:'1247 Bielby St, Waterford', ord:'', pay:'', note:'', lat:42.6812, lng:-83.3867});
  return stops;
}

function getDashWkMenu(ss) {
  var sheet = ss.getSheetByName("Soup orders");
  if (!sheet || sheet.getLastRow() < 4) return [];
  var headers = sheet.getRange(4, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rows    = sheet.getLastRow() > 4 ? sheet.getRange(5, 1, sheet.getLastRow()-4, sheet.getLastColumn()).getValues() : [];
  var itemMap = {};

  headers.forEach(function(h, i) {
    var hs = h.toString();
    if (!/\$\d+/.test(hs) || /sold out/i.test(hs)) return;

    var isSalad  = /salad/i.test(hs);
    var isBakery = /muffin|bread|loaf|bakery/i.test(hs);
    var isQuart  = /quart/i.test(hs);
    var isPint   = /pint/i.test(hs);
    var name = hs
      .replace(/[\[\]]/g, '')
      .replace(/\[?\$\d+\]?/g, '')
      .replace(/\b(small|large|pints?|quarts?|single|each|muffins?|bread|loaf|loaves)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!name) return;
    var priceMatch = hs.match(/\$(\d+)/);
    var price = priceMatch ? parseInt(priceMatch[1]) : 8;
    var sizeMatch = hs.match(/\b(Small|Large|Pint|Quart|Single|Each)\b/i);
    var sizeLabel = sizeMatch ? sizeMatch[1].charAt(0).toUpperCase() + sizeMatch[1].slice(1).toLowerCase() : '';

    var qty = rows.reduce(function(sum, r){ return sum + (parseFloat(r[i])||0); }, 0);
    var cat = isSalad ? 'salad' : isBakery ? 'bakery' : (!isPint && !isQuart && !sizeLabel) ? 'other' : 'soup';
    var em  = '';

    if (!itemMap[name]) {
      itemMap[name] = { cat: cat, em: em, sizes: [], totalRev: 0 };
    }
    itemMap[name].sizes.push({ l: sizeLabel || (isPint ? 'Pint' : isQuart ? 'Quart' : 'Single'), p: price });
    itemMap[name].totalRev += qty * price;
  });
  var items = [];
  Object.keys(itemMap).forEach(function(name) {
    var item = itemMap[name];
    var sizes = item.sizes;
    sizes.sort(function(a,b){ return a.p - b.p; });
    var szStr = sizes.length === 1
      ? '$' + sizes[0].p + ' each'
      : sizes.map(function(s){ return s.l + ' $' + s.p; }).join(' / ');
    items.push({
      em:  item.em,
      n:   name,
      sz:  szStr,
      szArr: sizes,
      rev: '$' + item.totalRev,
      cat: item.cat
    });
  });

  return items;
}

function getDashPhotos(ss) {
  var sheet = ss.getSheetByName("Soup Photos");
  if (!sheet || sheet.getLastRow() < 2) return {};
  var rows = sheet.getRange(2,1,sheet.getLastRow()-1,3).getValues();
  var photos = {};
  rows.forEach(function(r){ if(r[0] && r[2]) photos[r[0]] = r[2]; });
  return photos;
}

function onFormSubmit(e) {
  try {
    var response = e.namedValues || {};
    var addrKeys = Object.keys(response).filter(function(k) {
      return /address|delivery|street/i.test(k) && !/email/i.test(k);
    });
    if (!addrKeys.length) return;
    var addr  = (response[addrKeys[0]] || [''])[0].toString().trim();
    var name  = (response['Full Name'] || response['Name'] || response['Your Name'] || ['Customer'])[0];
    var email = (response['Email Address'] || response['Email'] || [''])[0].toString().trim();
    var hasNumber  = /\d/.test(addr);
    var hasStreet  = addr.split(/\s+/).length >= 2;
    var fakePhrases = /^(yes|no|n\/a|na|none|same|home|house|here|local|waterford|mi|michigan|tbd|see above|will call)$/i;
    if (!hasNumber || !hasStreet || fakePhrases.test(addr.trim())) {
      MailApp.sendEmail({
        to: SENDER_EMAIL,
        subject: ' Missing delivery address — ' + name,
        htmlBody: '<p>Hi Lia,</p><p><strong>' + name + '</strong> submitted an order but their delivery address looks incomplete:</p>' +
          '<blockquote style="background:#fff3cd;padding:10px;border-left:4px solid #f0ad4e"><strong>"' + addr + '"</strong></blockquote>' +
          '<p>Please follow up before delivery day.</p>' +
          (email ? '<p>Their email: <a href="mailto:' + email + '">' + email + '</a></p>' : '') +
          '<p>— Ladle &amp; Spoon App</p>'
      });
      if (email && email.includes('@')) {
        MailApp.sendEmail({
          to: email,
          subject: ' Quick note about your Ladle & Spoon order',
          htmlBody: '<p>Hi ' + name + ',</p>' +
            '<p>Thanks for your order! We noticed your delivery address may be incomplete: <strong>"' + addr + '"</strong></p>' +
            '<p>Please reply with your full street address (e.g. <em>1247 Bielby St, Waterford, MI</em>).</p>' +
            '<p>Thanks!<br>Lia @ Ladle &amp; Spoon </p>'
        });
      }
    }
  } catch(err) {
  }
}

function installFormSubmitTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'onFormSubmit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(ss).onFormSubmit().create();
}

function setupAll() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getTriggerSource() === ScriptApp.TriggerSource.CLOCK) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("triggerMondayRatingRequests").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
  ScriptApp.newTrigger("triggerThursdayReminder").timeBased().onWeekDay(ScriptApp.WeekDay.THURSDAY).atHour(10).create();
  ScriptApp.newTrigger("triggerFridayReminder").timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(11).create();
  ScriptApp.newTrigger("triggerFridaySubOrders").timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(18).create();
  ScriptApp.newTrigger("triggerSundayIntelligence").timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(23).create();
}

function checkTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var msg = "Current triggers (" + triggers.length + "):\n";
  triggers.forEach(function(t) { msg += "- " + t.getHandlerFunction() + " — " + t.getTriggerSource() + "\n"; });
  SpreadsheetApp.getUi().alert(msg);
}

function generateLadleAndSpoonIntelligence() {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const sheets    = ss.getSheets();
  const props     = PropertiesService.getScriptProperties();
  const startTime = new Date().getTime();
  var monthlyData  = {}, customerData = {}, intelData = {};
  var processedTabs = {};
  try {
    var cached = props.getProperty('intel_monthly');
    if(cached) monthlyData = JSON.parse(cached);
    var cachedC = props.getProperty('intel_customers');
    if(cachedC) customerData = JSON.parse(cachedC);
    var cachedI = props.getProperty('intel_items');
    if(cachedI) intelData = JSON.parse(cachedI);
    var cachedP = props.getProperty('intel_processed_tabs');
    if(cachedP) processedTabs = JSON.parse(cachedP);
  } catch(e) { Logger.log('Cache load error: ' + e); }

  Logger.log('Intelligence starting — ' + sheets.length + ' sheets, ' + Object.keys(processedTabs).length + ' already cached');

  var newTabsProcessed = 0;

  sheets.forEach(sheet => {
    const name = sheet.getName();
    if (!(/^\d+\/\d+(\/\d+)?$/.test(name)) && name !== "Soup orders") return;
    var isCurrentWeek = name === "Soup orders";
    if(!isCurrentWeek && processedTabs[name]) {
      return;
    }

    if(new Date().getTime() - startTime > 270000) { Logger.log('Time limit at: ' + name); return; }

    try {

    let sDate = (function() {
      if (name === "Soup orders") return new Date();
      var parsed = parseTabName(name);
      var m = parsed.month, d = parsed.day;
      if(parsed.year) return new Date(parsed.year, m-1, d);
      try {
        var ts = sheet.getRange(5, 1).getValue();
        if (ts instanceof Date && ts.getFullYear() > 2020) {
          var tsYear = ts.getFullYear(), tsMonth = ts.getMonth() + 1;
          if (m < tsMonth && tsMonth - m > 3) return new Date(tsYear + 1, m-1, d);
          return new Date(tsYear, m-1, d);
        }
      } catch(e) {}
      var now2 = new Date();
      var thisYear = new Date(now2.getFullYear(), m-1, d);
      return thisYear <= now2 ? thisYear : new Date(now2.getFullYear()-1, m-1, d);
    })();

    let dDate = Utilities.formatDate(sDate, ss.getSpreadsheetTimeZone(), "M/d/yy");
    var lastRow = sheet.getLastRow();
    var lastCol = Math.min(sheet.getLastColumn(), 40);
    if (lastRow < 5) return;
    const headerBlock = sheet.getRange(2, 1, 3, lastCol).getValues();
    const row2vals = headerBlock[0];
    const row3vals = headerBlock[1];
    const head     = headerBlock[2];
    const dataRows = sheet.getRange(5, 1, lastRow - 4, lastCol).getValues();
    const data     = [[], [], row2vals, head].concat(dataRows);

    const mKey = (sDate.getMonth() + 1) + "/" + sDate.getFullYear();
    if (!monthlyData[mKey]) monthlyData[mKey] = { s:0, sal:0, muf:0, p3:0, del:0, wks:0, orders:0, ts: sDate.getTime() };
    monthlyData[mKey].wks += 1;
    var p3Value = 0;
    try {
      var trCol = -1;
      for(var ci = 0; ci < row2vals.length; ci++){
        if(/total.*rev/i.test(row2vals[ci].toString())) { trCol = ci; break; }
      }
      if(trCol >= 0) p3Value = parseFloat(row3vals[trCol]) || 0;
      if(!p3Value){
        for(var ci2 = row3vals.length-1; ci2 >= 6; ci2--){
          var rv = parseFloat(row3vals[ci2]);
          if(!isNaN(rv) && rv > 0){ p3Value = rv; break; }
        }
      }
      if(p3Value < (lastRow - 4) * 5 && (lastRow - 4) > 2) {
        p3Value = 0;
        var eCl2 = head.findIndex(function(h){ return /email/i.test(h); });
        var iC2  = [];
        head.forEach(function(h,i){
          if(i>=6 && /\$\d+/.test(h.toString())){
            var pm = h.toString().match(/\$(\d+)/);
            if(pm) iC2.push({idx:i, price:parseInt(pm[1])});
          }
        });
        dataRows.forEach(function(row){
          var em = eCl2>=0 ? row[eCl2].toString() : '';
          if(!em.includes('@')) return;
          iC2.forEach(function(col){ p3Value += (parseFloat(row[col.idx])||0) * col.price; });
        });
      }
    } catch(e) { Logger.log('Revenue error on ' + name + ': ' + e); }
    monthlyData[mKey].p3 += p3Value;

    let colMap = [], eCol = -1, nameCol = -1, addrCol = -1;

    head.forEach((c, i) => {
      let v = c.toString().toLowerCase();
      if (v.includes("email"))                                          eCol     = i;
      if (v.includes("first and last") || v.includes("first name"))    nameCol  = i;
      if (v.includes("address") || v.includes("street"))               addrCol  = i;
      if (v.includes("salad")) {
        let priceMatch = c.toString().match(/\$(\d+)/);
        colMap[i] = { type: "Salad", price: priceMatch ? parseInt(priceMatch[1]) : 13, unit: "Unit" };
      } else if (v.includes("muffin") || v.includes("bread") || v.includes("loaf")) {
        colMap[i] = { type: "Bakery", price: (v.includes("loaf") || v.includes("bread")) ? 10 : 3, unit: "Unit" };
      } else if (v.includes("pint") || v.includes("quart")) {
        colMap[i] = { type: "Soup", isQ: v.includes("quart"), unit: "Oz" };
      }
    });

    for (let i = 0; i < dataRows.length; i++) {
      const r     = dataRows[i];
      const email = eCol !== -1 ? r[eCol] : null;
      if (!email || !email.toString().includes("@")) continue;
      let rawAddr = (addrCol !== -1 && r[addrCol]) ? r[addrCol].toString().toUpperCase() : "";
      let street  = normalizeStreet(rawAddr);
      if (!customerData[email]) {
        let fullName = (nameCol !== -1 ? r[nameCol] : "").toString().trim() || "Customer";
        customerData[email] = { name: fullName, ltv: 0, orders: 0, last: dDate, lastTS: sDate.getTime() };
      }
      let rowRev = 0, hasOrder = false;
      colMap.forEach((meta, idx) => {
        let q = parseFloat(r[idx]) || 0;
        if (q > 0) {
          hasOrder = true;
          let flavorClean = head[idx].toString().toUpperCase()
            .replace(/[\[\]\(\),/]/g, "").replace(/SOUP ORDER\?|PINTS?|QUARTS?|EA|ONLY|SOLD OUT|MUFFINS?|BREAD|LOAF|LOAVES|CH$|\$?\d+/gi, "").trim();
          let key = meta.type + ":" + flavorClean;
          if (!intelData[key]) intelData[key] = { type: meta.type, flavor: flavorClean, qty: 0, rev: 0, weeklySales: {}, unit: meta.unit };
          let itemRev = (meta.type === "Soup")
            ? (q * (sDate.getFullYear() >= 2026 ? (meta.isQ ? 15 : 8) : (meta.isQ ? 14 : 7)))
            : (q * meta.price);
          intelData[key].qty += (meta.type === "Soup") ? (q * (meta.isQ ? 32 : 16)) : q;
          intelData[key].rev += itemRev;
          intelData[key].weeklySales[dDate] = (intelData[key].weeklySales[dDate] || 0) + itemRev;
          rowRev += itemRev;
          if      (meta.type === "Soup")   monthlyData[mKey].s   += itemRev;
          else if (meta.type === "Salad")  monthlyData[mKey].sal += itemRev;
          else                             monthlyData[mKey].muf += itemRev;
        }
      });
      if (hasOrder) {
        customerData[email].ltv    += (rowRev + (sDate.getFullYear() >= 2026 ? 5 : 0));
        customerData[email].orders += 1;
        monthlyData[mKey].orders   += 1;
        monthlyData[mKey].del      += (sDate.getFullYear() >= 2026 ? 5 : 0);
        if (street && street !== "UNKNOWN") {
          if (!geoData[street]) geoData[street] = { customers: new Set(), totalOrders: 0 };
          geoData[street].customers.add(email);
          geoData[street].totalOrders += 1;
        }
      }
    }
    } catch(e) {
    }
    if(name !== "Soup orders") {
      processedTabs[name] = new Date().toISOString();
      newTabsProcessed++;
    }
  });
  try {
    props.setProperty('intel_monthly',       JSON.stringify(monthlyData));
    props.setProperty('intel_customers',     JSON.stringify(customerData));
    props.setProperty('intel_items',         JSON.stringify(intelData));
    props.setProperty('intel_processed_tabs', JSON.stringify(processedTabs));
  } catch(e) {
    Logger.log('Cache save error (may be too large): ' + e);
  }

  writeMonthly(ss, monthlyData);
  writeCustomers(ss, customerData);
  writeIntelligence(ss, intelData);
  writeReactivation(ss, customerData);
}

function normalizeStreet(addr) {
  if (!addr) return "UNKNOWN";
  let part = addr.split(',')[0].replace(/[0-9]/g, '').trim();
  return part.replace(/\b(STREET|ST|AVENUE|AVE|DRIVE|DR|ROAD|RD|COURT|CT|LANE|LN|BOULEVARD|BLVD|CIRCLE|CIR|WAY|TRAIL|TRL)\b/g, "").trim();
}

function writeMonthly(ss, dObj) {
  let s = ss.getSheetByName("Monthly Analysis") || ss.insertSheet("Monthly Analysis"); s.clear();
  let out = [["Month","Soup","Salad","Muffin","Misc/Addons","Delivery","Total w/o Del","Grand Total","Avg/Wk","Orders"]];
  Object.keys(dObj).sort((a,b) => dObj[a].ts - dObj[b].ts).forEach(k => {
    let d = dObj[k], misc = Math.max(0, d.p3 - (d.s + d.sal + d.muf));
    let yr = new Date(d.ts).getFullYear();
    let del = yr >= 2026 ? d.del : 0;
    out.push([k, d.s, d.sal, d.muf, misc, del, d.p3, d.p3 + del, d.p3 / d.wks, d.orders || 0]);
  });
  s.getRange(1, 1, out.length, 10).setValues(fillEmpty(out, 10));
  s.getRange("A:A").setNumberFormat("@");
  s.getRange("B2:I").setNumberFormat("$#,##0.00");
  s.getRange("J2:J").setNumberFormat("0");
}

function writeCustomers(ss, dObj) {
  let s = ss.getSheetByName("Customer Deep Dive") || ss.insertSheet("Customer Deep Dive"); s.clear();
  let out = [["Name","Email","Est. LTV","Orders","Last Order"]];
  Object.keys(dObj).forEach(k => { let d = dObj[k]; out.push([d.name, k, d.ltv, d.orders, d.last]); });
  if (out.length > 1) {
    s.getRange(1, 1, out.length, 5).setValues(out).sort({column: 3, ascending: false});
    s.getRange("C2:C").setNumberFormat("$#,##0.00");
  }
}

function writeIntelligence(ss, iLog) {
  let s = ss.getSheetByName("Soup Intelligence") || ss.insertSheet("Soup Intelligence"); s.clear();
  let out = [["Category","Flavor","Total Qty","Unit","Total Revenue","Weeks","Avg Rev/Wk","Last Week Rev","Trend","Last On Menu"]];
  Object.keys(iLog).forEach(k => {
    let d = iLog[k], weeks = Object.keys(d.weeklySales).length, avg = d.rev / weeks;
    let dates   = Object.keys(d.weeklySales).sort((a,b) => new Date(b) - new Date(a));
    let lastRev = d.weeklySales[dates[0]];
    let trend   = weeks > 1 ? (lastRev > avg*1.1 ? "Growing Growing" : (lastRev < avg*0.9 ? "Declining Declining" : "Stable")) : "New";
    out.push([d.type, d.flavor, d.qty, d.unit, d.rev, weeks, avg, lastRev, trend, dates[0]||'']);
  });
  if (out.length > 1) {
    s.getRange(1, 1, out.length, 10).setValues(out).sort({column: 7, ascending: false});
    s.getRange("E2:E").setNumberFormat("$#,##0.00");
    s.getRange("F2:F").setNumberFormat("0");
    s.getRange("G2:H").setNumberFormat("$#,##0.00");
  }
}

function writeReactivation(ss, cData) {
  let s = ss.getSheetByName("Reactivation List") || ss.insertSheet("Reactivation List"); s.clear();
  let out = [["Name","Email","Last Order","Days Since","Total Orders"]], now = new Date().getTime();
  Object.keys(cData).forEach(e => {
    let d = cData[e], diff = Math.floor((now - d.lastTS) / 86400000);
    if (d.orders >= 3 && diff > 28) out.push([d.name, e, d.last, diff, d.orders]);
  });
  if (out.length > 1) s.getRange(1, 1, out.length, 5).setValues(out).sort({column: 4, ascending: false});
}

function fillEmpty(arr, width) {
  return arr.map(row => { while(row.length < width) row.push(""); return row; });
}

function testSheetHeaders() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheet   = ss.getSheetByName(formSheetName);
  if (!sheet) { Logger.log('Sheet not found'); return; }
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(4, 1, 1, lastCol).getValues()[0];
  Logger.log('Row 4 headers (' + lastCol + ' cols):');
  headers.forEach(function(h, i){
    if(h) Logger.log('  Col ' + (i+1) + ' (' + String.fromCharCode(65+i) + '): ' + h);
  });
}

function testMenuSave() {
  var data = {
    items: [
      {id:'s10', n:'Shrimp Ceviche', em:'', cat:'other', sz:[{l:'Pint',p:15},{l:'Quart',p:28}]},
      {id:'s0',  n:'Chicken Noodle', em:'', cat:'soup',  sz:[{l:'Pint',p:8},{l:'Quart',p:15}]}
    ]
  };
  var result = handleSaveMenu(data);
  Logger.log('testMenuSave result: ' + result.getContent());
  testSheetHeaders();
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function corsResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function triggerSundayIntelligence() {
  try {
    generateLadleAndSpoonIntelligence();
  } catch(e) {
  }
}

function triggerMondayRatingRequests() {
  handleSendRatingRequests({ manual: false });
}

function handleSendRatingRequests(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets     = ss.getSheets();
  var archiveTabs = sheets.filter(function(s){
    return /^\d+\/\d+(\/\d+)?$/.test(s.getName());
  });
  archiveTabs.sort(function(a, b){
    var now = new Date();
    function tabToDate(sheet) {
      var p = parseTabName(sheet.getName());
      if(p.year) return new Date(p.year, p.month-1, p.day);
      try {
        var ts = sheet.getRange(5,1).getValue();
        if(ts instanceof Date && ts.getFullYear() > 2020) return ts;
      } catch(e) {}
      var d = new Date(now.getFullYear(), p.month-1, p.day);
      return d > now ? new Date(now.getFullYear()-1, p.month-1, p.day) : d;
    }
    return tabToDate(b) - tabToDate(a);
  });

  var ordSheet = null;
  var sheetLabel = 'none';

  if(archiveTabs.length > 0) {
    var candidate = archiveTabs[0];
    var now = new Date();
    try {
      var p = parseTabName(candidate.getName());
      var tabDate = p.year ? new Date(p.year, p.month-1, p.day) : (function(){
        var ts = candidate.getRange(5,1).getValue();
        if(ts instanceof Date && ts.getFullYear() > 2020) return ts;
        var d = new Date(now.getFullYear(), p.month-1, p.day);
        return d > now ? new Date(now.getFullYear()-1, p.month-1, p.day) : d;
      })();
      var daysDiff = Math.round((now - tabDate) / (1000*60*60*24));
      Logger.log('Most recent archive tab: ' + candidate.getName() + ' (' + daysDiff + ' days ago)');
      if(daysDiff <= 14) {
        ordSheet   = candidate;
        sheetLabel = candidate.getName();
      } else {
      }
    } catch(e) {
    }
  }
  if(!ordSheet || ordSheet.getLastRow() < 5) {
    ordSheet = ss.getSheetByName(formSheetName);
    sheetLabel = 'Soup orders (current)';
  }

  if (!ordSheet || ordSheet.getLastRow() < 5) {
    return jsonResponse({ success: true, sent: 0, msg: 'No orders found' });
  }

  var headers  = ordSheet.getRange(4, 1, 1, ordSheet.getLastColumn()).getValues()[0];
  var rows     = ordSheet.getRange(5, 1, ordSheet.getLastRow() - 4, ordSheet.getLastColumn()).getValues();

  var emailCol = headers.findIndex(function(h){ return /email/i.test(h); });
  var nameCol  = headers.findIndex(function(h){ return /first.*last|name/i.test(h); });
  var phoneCol = headers.findIndex(function(h){ return /phone/i.test(h); });
  var itemCols = [];
  headers.forEach(function(h, i) {
    if (/pint|quart|salad/i.test(h) && !/sold out/i.test(h)) {
      var em = /salad/i.test(h) ? '' : '';
      itemCols.push({ idx: i, label: h.toString(), em: em });
    }
  });

  var sent = 0, errors = 0;

  rows.forEach(function(row, ri) {
    var email = emailCol >= 0 ? row[emailCol].toString().trim() : '';
    var name  = nameCol  >= 0 ? row[nameCol].toString().trim()  : '';
    var phone = phoneCol >= 0 ? row[phoneCol].toString().trim() : '';
    if (!email || !email.includes('@')) return;
    var items = [];
    itemCols.forEach(function(col) {
      var qty = parseFloat(row[col.idx]) || 0;
      if (qty > 0) {
        var cleanName = col.label.replace(/[\[\]]/g,'').replace(/pints?\s*\$?\d*/gi,'').replace(/quarts?\s*\$?\d*/gi,'').replace(/\$\d+/g,'').trim();
        var size      = /quart/i.test(col.label) ? 'Quart' : /salad/i.test(col.label) ? 'Salad' : 'Pint';
        items.push({ name: cleanName, em: col.em, size: size, qty: qty });
      }
    });

    if (items.length === 0) return;

    var orderId = 'ORD-' + (ri + 1) + '-' + new Date().getTime();
    var ratingUrl = orderLink + '?rate=' + encodeURIComponent(orderId) + '&email=' + encodeURIComponent(email);

    try {
      sendRatingRequestEmail(name, email, items, ratingUrl);
      var twilioSid   = PropertiesService.getScriptProperties().getProperty('TWILIO_SID');
      var twilioToken = PropertiesService.getScriptProperties().getProperty('TWILIO_TOKEN');
      var twilioFrom  = PropertiesService.getScriptProperties().getProperty('TWILIO_FROM');
      if (twilioSid && twilioToken && twilioFrom && phone) {
        var smsMsg = 'Hi ' + name.split(' ')[0] + '! How was your Ladle & Spoon delivery? Rate your order here: ' + ratingUrl + ' - Reply STOP to unsubscribe.';
        sendTwilioSms(twilioSid, twilioToken, twilioFrom, phone, smsMsg);
      }
      sendRatingPush(name, ratingUrl);
      logRatingRequest(orderId, name, email, phone, items);

      sent++;
    } catch(err) {
      errors++;
    }
  });
  return jsonResponse({ success: true, sent: sent, errors: errors });
}

function sendRatingRequestEmail(name, toEmail, items, ratingUrl) {
  var firstName = (name || '').split(' ')[0] || 'there';
  var itemList  = items.map(function(i){ return '<li style="margin:4px 0">' + i.em + ' ' + i.name + ' (' + i.size + ')</li>'; }).join('');

  var subject = 'How was your Ladle & Spoon delivery, ' + firstName + '?';

  var htmlBody =
    '<div style="font-family:Arial,sans-serif;background-color:#f4f4f4;padding:20px;">' +
    '<table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 4px 8px rgba(0,0,0,0.1);">' +
    '<tr><td align="center" style="padding:20px;background-color:#5D4037;border-top-left-radius:8px;border-top-right-radius:8px;">' +
    '<img src="' + LOGO_URL + '" alt="Ladle &amp; Spoon" width="150" style="display:block;"></td></tr>' +
    '<tr><td style="padding:30px;color:#333;font-size:15px;line-height:1.6;">' +
    '<p><strong>Hi ' + firstName + ',</strong></p>' +
    '<p style="font-size:17px;font-weight:600;margin-top:0;">How was your delivery? </p>' +
    '<p>We hope you enjoyed this week\'s order! Your feedback helps Lia know what to make more of.</p>' +
    '<p><strong>Your order:</strong></p>' +
    '<ul style="margin:0 0 16px;padding-left:20px;color:#555">' + itemList + '</ul>' +
    '<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;">' +
    '<tr><td align="center">' +
    '<a href="' + ratingUrl + '" target="_blank" ' +
    'style="display:inline-block;background:#1B3D1C;color:#ffffff;text-decoration:none;' +
    'padding:12px 28px;border-radius:24px;font-weight:bold;font-size:15px;">' +
    'Rate Your Order *</a>' +
    '</td></tr></table>' +
    '<p style="font-size:12px;color:#888;">Takes less than 30 seconds!</p>' +
    '<p>Thank you for supporting our kitchen!<br><strong>Lia @ Ladle &amp; Spoon</strong></p>' +
    '</td></tr>' +
    '<tr><td align="center" style="padding:15px;font-size:12px;color:#777;background:#eee;border-bottom-left-radius:8px;border-bottom-right-radius:8px;">' +
    '<p style="margin:0;">Questions? Email us at ' + SENDER_EMAIL + '</p>' +
    '<p style="margin:5px 0 0;">&copy; ' + new Date().getFullYear() + ' Ladle &amp; Spoon - Reply to unsubscribe</p>' +
    '</td></tr></table></div>';

  var plainBody = 'Hi ' + firstName + ',\n\nHow was your Ladle & Spoon delivery this week?\n\n' +
    'Rate your order here: ' + ratingUrl + '\n\n' +
    'Takes less than 30 seconds!\n\n— Lia @ Ladle & Spoon';

  GmailApp.sendEmail(toEmail, subject, plainBody, {
    htmlBody: htmlBody,
    from:     SENDER_EMAIL,
    name:     SENDER_NAME
  });
}

function sendRatingPush(name, ratingUrl) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Push Tokens');
  if (!sheet || sheet.getLastRow() < 2) return;
  var tokens = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues()
    .map(function(r){ return r[0]; })
    .filter(function(t){ return t && t.toString().length > 10; });
  if (tokens.length === 0) return;
  sendFCMNotification(tokens,
    '* Rate your Ladle & Spoon delivery!',
    'How was this week\'s order? Tap to rate — takes 30 seconds!'
  );
}

function logRatingRequest(orderId, name, email, phone, items) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('RatingRequests');
  if (!sheet) {
    sheet = ss.insertSheet('RatingRequests');
    sheet.appendRow(['Timestamp','OrderID','Name','Email','Phone','Items','Status']);
    sheet.getRange(1,1,1,7).setFontWeight('bold');
  }
  var itemStr = items.map(function(i){ return i.name + ' (' + i.size + ')'; }).join(', ');
  sheet.appendRow([new Date(), orderId, name, email, phone, itemStr, 'SENT']);
}
function handleGetOrderForRating(params) {
  var orderId = params.id    || '';
  var email   = params.email || '';
  if (!orderId || !email) return jsonResponse({ success: false, error: 'Missing params' });
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('RatingRequests');
  if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ success: false, error: 'No rating requests found' });

  var rows = sheet.getRange(2, 1, sheet.getLastRow()-1, 7).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][1] === orderId && rows[i][3].toString().toLowerCase() === email.toLowerCase()) {
      var itemStr = rows[i][5].toString();
      var name    = rows[i][2].toString();
      var items = itemStr.split(', ').map(function(s) {
        var match = s.match(/^(.+)\s\((.+)\)$/);
        var isSalad = match && /salad/i.test(match[2]);
        return {
          name: match ? match[1] : s,
          size: match ? match[2] : '',
          em:   isSalad ? '' : ''
        };
      });
      return jsonResponse({ success: true, orderId: orderId, name: name, email: email, items: items });
    }
  }
  return jsonResponse({ success: false, error: 'Order not found' });
}
function handleSubmitRatings(data) {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheet   = ss.getSheetByName('Ratings');
  if (!sheet) {
    sheet = ss.insertSheet('Ratings');
    sheet.appendRow(['Timestamp','OrderID','Email','Soup/Item','Emoji','Size','Rating','Comment']);
    sheet.getRange(1,1,1,8).setFontWeight('bold');
  }

  var orderId = data.orderId || '';
  var email   = data.email   || '';
  var ratings = data.ratings || [];

  ratings.forEach(function(r) {
    sheet.appendRow([new Date(), orderId, email, r.name, r.em||'', r.size||'', r.rating, r.comment||'']);
  });
  var reqSheet = ss.getSheetByName('RatingRequests');
  if (reqSheet && reqSheet.getLastRow() > 1) {
    var rows = reqSheet.getRange(2, 1, reqSheet.getLastRow()-1, 7).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][1] === orderId) {
        reqSheet.getRange(i+2, 7).setValue('RATED');
        break;
      }
    }
  }
  return jsonResponse({ success: true, saved: ratings.length });
}
function setTwilioCredentials(sid, token, fromNumber) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('TWILIO_SID',   sid);
  props.setProperty('TWILIO_TOKEN', token);
  props.setProperty('TWILIO_FROM',  fromNumber);
}

function sendTwilioSms(sid, token, fromNumber, toNumber, message) {
  var to = toNumber.toString().replace(/\D/g,'');
  if (to.length === 10) to = '+1' + to;
  else if (to.length === 11 && to[0] === '1') to = '+' + to;
  else to = '+' + to;

  var url     = 'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json';
  var payload = 'To=' + encodeURIComponent(to) +
                '&From=' + encodeURIComponent(fromNumber) +
                '&Body=' + encodeURIComponent(message);

  var response = UrlFetchApp.fetch(url, {
    method:             'post',
    headers:            { 'Authorization': 'Basic ' + Utilities.base64Encode(sid + ':' + token) },
    payload:            payload,
    muteHttpExceptions: true
  });

  var code   = response.getResponseCode();
  var result = JSON.parse(response.getContentText());
  if (code === 201) {
  } else {
  }
  return code === 201;
}
function sendSmsBlast(message) {
  var props       = PropertiesService.getScriptProperties();
  var sid         = props.getProperty('TWILIO_SID');
  var token       = props.getProperty('TWILIO_TOKEN');
  var fromNumber  = props.getProperty('TWILIO_FROM');
  if (!sid || !token || !fromNumber) {
    Logger.log('Twilio credentials not set. Run setTwilioCredentials() first.');
    return { sent: 0, error: 'No Twilio credentials' };
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(customerSheetName);
  if (!sheet || sheet.getLastRow() < 2) return { sent: 0 };

  var rows = sheet.getRange(2, 1, sheet.getLastRow()-1, 5).getValues();
  var sent = 0, errors = 0;

  rows.forEach(function(r) {
    var name  = (r[1]||'').toString().trim();
    var phone = (r[2]||'').toString().trim();
    if (!phone || phone.length < 10) return;
    var personalizedMsg = message.replace('{name}', name.split(' ')[0] || 'there');
    var ok = sendTwilioSms(sid, token, fromNumber, phone, personalizedMsg);
    if (ok) sent++; else errors++;
    Utilities.sleep(100);
  });
  return { sent: sent, errors: errors };
}
function sendMenuPublishSms() {
  return sendSmsBlast(
    'Hi {name}! This week\'s Ladle & Spoon menu is live! ' +
    'Order by Friday 6PM for Monday delivery: ' + orderLink +
    ' - Reply STOP to unsubscribe.'
  );
}
function sendFridayReminderSms() {
  return sendSmsBlast(
    'Hi {name}! Last chance to order from Ladle & Spoon this week! ' +
    'Order by 7PM tonight for Monday delivery: ' + orderLink +
    ' - Reply STOP to unsubscribe.'
  );
}

function testOrder() {
  var result = handleOrder({
    type: "order", id: "#TEST01",
    name: "Test Customer", email: LIA_EMAIL,
    phone: "2485550000", address: "123 Test St, Waterford MI 48328",
    isNew: false, payment: "venmo",
    notes: "Test — please delete this row",
    total: 23.00, deliveryFee: 5,
    items: [
      { name: "Split Pea w/ Bacon",          size: "Quart",  qty: 1, price: 15 },
      { name: "Goat Cheese Blueberry Salad", size: "Single", qty: 1, price: 15 }
    ]
  });
  Logger.log(result.getContent());
  SpreadsheetApp.getUi().alert("Test complete!\n\nCheck 'Soup orders' tab for a new row\nand your email for an HTML confirmation.");
}

function testReminder() {
  var body = generateEmailBody("Your Weekly Soup Reminder from Ladle & Spoon", "Lia");
  GmailApp.sendEmail(LIA_EMAIL, " [TEST] Reminder preview", "", { htmlBody: body, from: SENDER_EMAIL, name: SENDER_NAME });
  SpreadsheetApp.getUi().alert("HTML reminder preview sent to " + LIA_EMAIL);
}

function testReengagementEmail() {
  sendReengagementEmail("Test Customer", LIA_EMAIL);
  SpreadsheetApp.getUi().alert("Re-engagement email sent to " + LIA_EMAIL + "\nCheck your inbox!");
}

function testDoGet() {
  var fakeEvent = { parameter: { type: 'get_dashboard' } };
  var result    = doGet(fakeEvent);
  var content   = result.getContent();
  Logger.log('First 200 chars: ' + content.substring(0, 200));
  if (content.includes('orders')) Logger.log(' SUCCESS — returning dashboard data');
  else Logger.log('FAIL — check parameter handling\nFull response: ' + content);
}

function generateEmailBody(subject, name) {
  var firstName = (name || 'Friend').toString().split(' ')[0];
  var menuUrl   = 'https://acebuilds51.github.io/ladle_and_spoon/';
  var isLastChance = subject.toLowerCase().includes('last chance');
  var isAnnouncement = subject.toLowerCase().includes('live');

  var contentHtml;
  if (isLastChance) {
    contentHtml =
      '<p style="color:#c0392b;font-size:18px;font-weight:bold;margin-top:0;">Last Call for Soup!</p>' +
      '<p>To ensure everyone gets the freshest ingredients, we\'re finalizing quantities today.</p>' +
      '<p><b>Don\'t miss out — once we close orders, the pots start simmering!</b></p>';
  } else if (isAnnouncement) {
    contentHtml =
      '<p style="font-size:18px;font-weight:600;margin-top:0;">It\'s Soup Week!</p>' +
      '<p>Our kitchen is busy preparing another batch of your favorite homemade soups with the freshest ingredients.</p>' +
      '<p>Place your order today for stress-free, delicious meals delivered Monday!</p>';
  } else {
    contentHtml =
      '<p style="font-size:18px;font-weight:600;margin-top:0;">Your Weekly Soup Reminder</p>' +
      '<p>Hi ' + firstName + '! This is your friendly reminder that Ladle & Spoon orders are open for this week.</p>' +
      '<p>Fresh, homemade soups and salads delivered right to your door every Monday!</p>';
  }

  return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Georgia,serif;">' +
    '<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">' +
    '<div style="background:#1a3a2a;padding:24px;text-align:center;">' +
    '<h1 style="color:#fff;margin:0;font-size:24px;letter-spacing:1px;">Ladle & Spoon</h1>' +
    '<p style="color:#a8c5a0;margin:4px 0 0;font-size:13px;">Homemade Soups & Salads</p>' +
    '</div>' +
    '<div style="padding:28px 32px;">' +
    '<p style="font-size:15px;color:#333;">Hi ' + firstName + ',</p>' +
    contentHtml +
    '<div style="text-align:center;margin:28px 0;">' +
    '<a href="' + menuUrl + '" style="display:inline-block;background:#1a3a2a;color:#fff;text-decoration:none;' +
    'padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;">View Menu & Order Now</a>' +
    '</div>' +
    '<p style="font-size:13px;color:#888;border-top:1px solid #eee;padding-top:16px;margin-top:24px;">' +
    'Orders close Friday at 7 PM. Delivered every Monday.<br>' +
    'Reply to this email or visit our site to place your order.' +
    '</p>' +
    '</div>' +
    '</div></body></html>';
}

function handleGetSubscribers() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Subscribers');
  if(!sheet || sheet.getLastRow() < 2) return jsonResponse({subscribers:[]});
  var rows = sheet.getRange(2, 1, sheet.getLastRow()-1, 8).getValues();
  var subs = rows.filter(function(r){ return r[0] && r[3] !== 'cancelled'; }).map(function(r){
    return {name:r[0], email:r[1], phone:r[2], plan:r[3], since:r[4]?Utilities.formatDate(new Date(r[4]),ss.getSpreadsheetTimeZone(),'M/d/yy'):'', paused:r[5]===true||r[5]==='TRUE'};
  });
  return jsonResponse({subscribers: subs});
}

function triggerFridaySubOrders() {
  var ss          = SpreadsheetApp.getActiveSpreadsheet();
  var subSheet    = ss.getSheetByName('Subscribers');
  var ordSheet    = ss.getSheetByName(formSheetName);
  if(!subSheet || !ordSheet) return;

  var menuProp = PropertiesService.getScriptProperties().getProperty('current_menu');
  var menu     = menuProp ? JSON.parse(menuProp) : null;
  var featured = PropertiesService.getScriptProperties().getProperty('featured_selections');
  var feat     = featured ? JSON.parse(featured) : {};

  if(!menu || !menu.items || !menu.items.length){
    return;
  }

  var swapSheet = ss.getSheetByName('SwapLog');
  var swaps = {};
  if(swapSheet && swapSheet.getLastRow() > 1){
    var swapRows = swapSheet.getRange(2,1,swapSheet.getLastRow()-1,5).getValues();
    swapRows.forEach(function(r){
      if(r[0] && r[1]) swaps[r[1].toLowerCase()] = {soup: r[2], salad: r[3]};
    });
  }

  var ordHeaders = ordSheet.getRange(4, 1, 1, ordSheet.getLastColumn()).getValues()[0];
  var subRows    = subSheet.getRange(2, 1, subSheet.getLastRow()-1, 8).getValues();
  var now        = new Date();
  var written    = 0;

  subRows.forEach(function(row){
    var name   = row[0], email = row[1], phone = row[2], plan = row[3];
    var paused = row[5] === true || row[5] === 'TRUE';
    if(!email || !plan || plan === 'cancelled' || paused) return;

    var startOfWeek = getStartOfWeek();
    var ordRows = ordSheet.getLastRow() > 4
      ? ordSheet.getRange(5,1,ordSheet.getLastRow()-4,ordSheet.getLastColumn()).getValues()
      : [];
    var emailIdx = ordHeaders.findIndex(function(h){ return /email/i.test(h); });
    var alreadyOrdered = ordRows.some(function(r){
      return emailIdx >= 0 && r[emailIdx].toString().toLowerCase() === email.toLowerCase();
    });
    if(alreadyOrdered){ Logger.log('Skipping sub order for ' + email + ' — already has order'); return; }

    var swap = swaps[email.toLowerCase()] || {};
    var soupName   = swap.soup  || feat.soup1  || (menu.items.find(function(i){return i.cat==='soup';})||{}).n || '';
    var saladName  = swap.salad || feat.salad1 || (menu.items.find(function(i){return i.cat==='salad';})||{}).n || '';

    var newRow = new Array(ordHeaders.length).fill('');
    ordHeaders.forEach(function(h, i){
      if(i === 0) newRow[i] = now;
      else if(/email/i.test(h)) newRow[i] = email;
      else if(/new customer/i.test(h)) newRow[i] = 'No';
      else if(/first.*last|^name/i.test(h)) newRow[i] = name;
      else if(/phone/i.test(h)) newRow[i] = phone;
      else if(/address/i.test(h)) newRow[i] = row[6] || '';
      else if(/comment|special/i.test(h)) newRow[i] = '[Subscription Order - ' + plan + ']';
      else if(/paying/i.test(h)) newRow[i] = 'Cash';
      else {
        var hLower = h.toLowerCase();
        if(plan === 'ind'){
          if(soupName && hLower.includes(soupName.toLowerCase()) && hLower.includes('pint')) newRow[i] = 2;
        } else if(plan === 'fam'){
          if(soupName && hLower.includes(soupName.toLowerCase()) && hLower.includes('quart')) newRow[i] = 2;
        } else if(plan === 'ss'){
          if(soupName && hLower.includes(soupName.toLowerCase()) && hLower.includes('pint')) newRow[i] = 2;
          if(saladName && hLower.includes(saladName.toLowerCase())) newRow[i] = 1;
        } else if(plan === 'sal'){
          if(saladName && hLower.includes(saladName.toLowerCase())) newRow[i] = 2;
        }
      }
    });

    ordSheet.appendRow(newRow);
    written++;
    Logger.log('Sub order created for ' + name + ' (' + plan + ')');
  });
}
