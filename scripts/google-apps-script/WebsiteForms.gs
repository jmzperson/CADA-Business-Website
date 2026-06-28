/**
 * CADA website form handler → "Website Forms" spreadsheet
 *
 * Tabs:
 *   - PArtnership Forms  ← form_type: partnership
 *   - INfluencer Forms   ← form_type: creator
 *
 * SETUP:
 * 1. Open "Website Forms" → Extensions → Apps Script → paste this file → Save
 * 2. Run setupHeaders() once (authorize when prompted)
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the Web App URL (/exec) into Vercel: GOOGLE_APPS_SCRIPT_URL
 * 5. Redeploy Vercel
 */

const NOTIFY_EMAIL = 'james@cadaapp.com';

const TAB_PARTNERSHIP = 'PArtnership Forms';
const TAB_INFLUENCER = 'INfluencer Forms';

const HEADERS_PARTNERSHIP = [
  'Timestamp',
  'Brand Name',
  'Email',
  'Message',
  'Page URL',
];

const HEADERS_INFLUENCER = [
  'Timestamp',
  'Name',
  'Email',
  'Handle',
  'Community',
  'Page URL',
];

function setupHeaders() {
  ensureHeaders_(TAB_PARTNERSHIP, HEADERS_PARTNERSHIP);
  ensureHeaders_(TAB_INFLUENCER, HEADERS_INFLUENCER);
}

function ensureHeaders_(tabName, headers) {
  const sheet = getSheetByName_(tabName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
}

function getSheetByName_(tabName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    throw new Error(
      'Missing tab "' + tabName + '". Create it in Website Forms or fix the name.'
    );
  }
  return sheet;
}

function getSheetForFormType_(formType) {
  if (formType === 'partnership') {
    return getSheetByName_(TAB_PARTNERSHIP);
  }
  if (formType === 'creator') {
    return getSheetByName_(TAB_INFLUENCER);
  }
  throw new Error('Unknown form_type: ' + formType);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const formType = String(data.form_type || '').trim();

    if (formType === 'portal_notification') {
      const to = String(data.notify_to || NOTIFY_EMAIL).trim();
      const subject = String(data.subject || 'CADA portal notification').trim();
      const message = String(data.message || '').trim();
      MailApp.sendEmail(to, subject, message);
      return jsonResponse({ ok: true });
    }

    const page = String(data.page_url || '').trim();
    const email = String(data.email || '').trim();

    let sheet;
    let row;
    let subject;
    let body;

    if (formType === 'partnership') {
      sheet = getSheetForFormType_('partnership');
      ensureHeaders_(TAB_PARTNERSHIP, HEADERS_PARTNERSHIP);

      const brandName = String(data.company_name || '').trim();
      const message = String(data.message || '').trim();

      row = [new Date(), brandName, email, message, page];

      subject = 'New CADA partnership form: ' + (brandName || email);
      body =
        'New partnership form on the CADA website\n\n' +
        'Brand: ' + brandName + '\n' +
        'Email: ' + email + '\n' +
        (message ? 'Message:\n' + message + '\n' : '') +
        (page ? 'Page: ' + page + '\n' : '') +
        '\n— CADA website forms';
    } else if (formType === 'creator') {
      sheet = getSheetForFormType_('creator');
      ensureHeaders_(TAB_INFLUENCER, HEADERS_INFLUENCER);

      const name = String(data.name || '').trim();
      const handle = String(data.handle || '').trim();
      const community = String(data.community || '').trim();

      row = [new Date(), name, email, handle, community, page];

      subject = 'New CADA influencer form: ' + (name || email);
      body =
        'New influencer form on the CADA website\n\n' +
        'Name: ' + name + '\n' +
        'Email: ' + email + '\n' +
        (handle ? 'Handle: ' + handle + '\n' : '') +
        (community ? 'Community:\n' + community + '\n' : '') +
        (page ? 'Page: ' + page + '\n' : '') +
        '\n— CADA website forms';
    } else if (formType === 'challenge_submitted') {
      const name = String(data.company_name || data.name || 'Partner').trim();
      subject = 'Challenge pending review: ' + name;
      body = String(data.message || '') + '\n\n— CADA brand portal';
      MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
      return jsonResponse({ ok: true });
    } else {
      throw new Error('Unknown form_type: ' + (formType || '(empty)'));
    }

    sheet.appendRow(row);
    MailApp.sendEmail(NOTIFY_EMAIL, subject, body);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet() {
  return jsonResponse({
    ok: true,
    message: 'CADA form handler is running',
    tabs: [TAB_PARTNERSHIP, TAB_INFLUENCER],
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
