/**
 * Legacy single-tab form handler (tab: "Submissions").
 * Prefer WebsiteForms.gs for the "Website Forms" spreadsheet with
 * PArtnership Forms + INfluencer Forms tabs.
 *
 * SETUP:
 * 1. Create a new Google Sheet (e.g. "CADA Website Forms")
 * 2. Extensions → Apps Script → paste this file → save
 * 3. Run setupHeaders() once (authorize when prompted)
 * 4. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL into Vercel env: GOOGLE_APPS_SCRIPT_URL
 */

const NOTIFY_EMAIL = 'james@cadaapp.com';
const SHEET_NAME = 'Submissions';

function setupHeaders() {
  const sheet = getSheet();
  const headers = [
    'Timestamp',
    'Form Type',
    'Name / Brand',
    'Email',
    'Message / Community',
    'Handle',
    'Page URL',
  ];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const formType = String(data.form_type || 'unknown');

    if (formType === 'portal_notification') {
      const to = String(data.notify_to || NOTIFY_EMAIL).trim();
      const subject = String(data.subject || 'CADA portal notification').trim();
      const message = String(data.message || '').trim();
      MailApp.sendEmail(to, subject, message);
      return jsonResponse({ ok: true });
    }

    const sheet = getSheet();
    if (sheet.getLastRow() === 0) setupHeaders();

    const name = String(data.company_name || data.name || data.brand_name || '').trim();
    const email = String(data.email || data.submitted_by || '').trim();
    const message = String(data.message || data.community || '').trim();
    const handle = String(data.handle || '').trim();
    const page = String(data.page_url || '').trim();

    sheet.appendRow([
      new Date(),
      formType,
      name,
      email,
      message,
      handle,
      page,
    ]);

    var subject;
    var body;

    if (formType === 'challenge_submitted') {
      subject = 'Challenge pending review: ' + (name || 'Partner');
      body =
        String(data.message || '') +
        '\n\n— CADA brand portal';
    } else {
      subject = 'New CADA ' + formType + ' form: ' + (name || email);
      body =
        'New form submission on the CADA website\n\n' +
        'Form: ' + formType + '\n' +
        'Name / Brand: ' + name + '\n' +
        'Email: ' + email + '\n' +
        (handle ? 'Handle: ' + handle + '\n' : '') +
        (message ? 'Message:\n' + message + '\n' : '') +
        (page ? 'Page: ' + page + '\n' : '') +
        '\n— CADA website forms';
    }

    MailApp.sendEmail(NOTIFY_EMAIL, subject, body);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet() {
  return jsonResponse({ ok: true, message: 'CADA form handler is running' });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
