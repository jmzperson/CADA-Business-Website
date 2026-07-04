# Website forms → Google Drive spreadsheet

All marketing site forms (partnership, influencer, **support**) submit through Vercel `/api/submit-form` → Google Apps Script → rows in your **Website Forms** spreadsheet in Google Drive.

Google Sheets files live in Drive and can be downloaded as Excel (`.xlsx`) anytime via **File → Download → Microsoft Excel**.

## Spreadsheet tabs

| Website form | Page | Sheet tab | Columns |
|--------------|------|-----------|---------|
| Partnership | Partnerships page | `PArtnership Forms` | Timestamp, Brand Name, Email, Message, Page URL |
| Influencer | Creators page | `INfluencer Forms` | Timestamp, Name, Email, Handle, Community, Page URL |
| Support | `/support.html` | `Help Forms` | Timestamp, Name, Email, Question, Page URL |

The **Help Forms** tab is created automatically on first support submission (or when you run `setupHeaders()`).

## One-time setup

1. Open your **Website Forms** spreadsheet in [Google Drive](https://drive.google.com).
2. **Extensions → Apps Script**.
3. Replace `Code.gs` with the contents of `WebsiteForms.gs` → **Save**.
4. In the script editor, select **`setupHeaders`** from the function dropdown → **Run** → authorize Google access.
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the deployment URL (ends with `/exec`).
7. In **Vercel** (marketing site project), set environment variable:
   ```
   GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/…/exec
   ```
8. **Redeploy** Vercel.

## After code changes

Whenever you update `WebsiteForms.gs`, open Apps Script → **Deploy → Manage deployments → Edit → New version** → Deploy. The Vercel URL stays the same.

## Test support → sheet

```bash
curl -X POST 'YOUR_APPS_SCRIPT_EXEC_URL' \
  -H 'Content-Type: application/json' \
  -d '{"form_type":"support","name":"Test User","email":"test@example.com","message":"Does this land in the sheet?"}'
```

Check the **Help Forms** tab for a new row and your inbox for the notification email.

## Standalone script project (optional)

If the Apps Script is **not** opened from inside the spreadsheet, set `SPREADSHEET_ID` at the top of `WebsiteForms.gs` to the ID from your sheet URL:

```
https://docs.google.com/spreadsheets/d/1abc…xyz/edit
                                      ^^^^^^^^^
```
