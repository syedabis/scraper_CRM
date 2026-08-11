import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

const sheetsAuth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Screenshot uploads run under their own service account. A file uploaded
// into a My Drive folder is owned by the *uploader*, not by the folder's
// owner, so it consumes the uploader's storage quota — and Google no longer
// grants any quota to service accounts created after the change, which makes
// files.create fail with 403 "Service Accounts do not have storage quota".
// DRIVE_GOOGLE_* points at an older account that still has quota; falls back
// to the main credentials so nothing breaks if it is unset.
const driveAuth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.DRIVE_GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL,
    private_key: (process.env.DRIVE_GOOGLE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY)?.replace(
      /\\n/g,
      '\n'
    ),
  },
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth: driveAuth });
const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });

const PAYMENT_LOG_SHEET_NAME = 'Sheet1';
const PAYMENT_LOG_HEADERS = ['Date', 'Student Name', 'Phone Number', 'Email', 'Course Fees', 'Payment Screenshot'];

function escapeForDriveQuery(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Payment Screenshots/<student email>/ — reuse the subfolder if it already
// exists so repeat payments from the same student land in one place.
async function findOrCreateStudentFolder(email, parentId) {
  const folderName = email || 'unknown';
  const escaped = escapeForDriveQuery(folderName);
  const list = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });
  if (list.data.files && list.data.files.length > 0) {
    return list.data.files[0].id;
  }
  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });
  return created.data.id;
}

// Screenshots are named by date ("2026-07-22.png"); if that name is already
// taken in the student's folder, fall back to "2026-07-22_1.png", "_2", etc.
async function findAvailableFileName(baseName, ext, parentId) {
  const list = await drive.files.list({
    q: `'${parentId}' in parents and trashed = false`,
    fields: 'files(name)',
  });
  const existingNames = new Set((list.data.files || []).map((f) => f.name));
  const plain = `${baseName}${ext}`;
  if (!existingNames.has(plain)) return plain;
  let n = 1;
  while (existingNames.has(`${baseName}_${n}${ext}`)) n++;
  return `${baseName}_${n}${ext}`;
}

// Uploads the screenshot to Drive and returns its viewable link, so it can
// be recorded alongside the rest of the form details.
async function uploadPaymentScreenshot(screenshot, email) {
  const parentFolderId = process.env.DRIVE_PAYMENT_SCREENSHOTS_FOLDER_ID;
  if (!parentFolderId) {
    throw new Error('DRIVE_PAYMENT_SCREENSHOTS_FOLDER_ID is not configured');
  }

  const studentFolderId = await findOrCreateStudentFolder(email, parentFolderId);

  const originalName = screenshot.name || 'screenshot';
  const extMatch = originalName.match(/\.[^.]+$/);
  const ext = extMatch ? extMatch[0] : '';
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const fileName = await findAvailableFileName(dateStr, ext, studentFolderId);

  const buffer = Buffer.from(await screenshot.arrayBuffer());

  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [studentFolderId],
    },
    media: {
      mimeType: screenshot.type || 'application/octet-stream',
      body: Readable.from(buffer),
    },
    fields: 'id, webViewLink',
  });

  return created.data.webViewLink;
}

async function getSheetGridId(spreadsheetId, sheetName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (meta.data.sheets || []).find((s) => s.properties.title === sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in spreadsheet ${spreadsheetId}`);
  }
  return sheet.properties.sheetId;
}

// Formats column A as a real Date column (not just text that looks like
// one), so it sorts/filters properly and any existing serial-number values
// in that column immediately render as readable dates too.
async function formatDateColumn(spreadsheetId, sheetName) {
  const gridId = await getSheetGridId(spreadsheetId, sheetName);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: gridId,
              startColumnIndex: 0,
              endColumnIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' },
              },
            },
            fields: 'userEnteredFormat.numberFormat',
          },
        },
      ],
    },
  });
}

async function ensurePaymentLogHeaders(sheetId) {
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${PAYMENT_LOG_SHEET_NAME}!A1:F1`,
  });
  if (!existing.data.values || existing.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${PAYMENT_LOG_SHEET_NAME}!A1:F1`,
      valueInputOption: 'RAW',
      requestBody: { values: [PAYMENT_LOG_HEADERS] },
    });
  }
  await formatDateColumn(sheetId, PAYMENT_LOG_SHEET_NAME);
}

async function logPaymentToSheet({ name, phone, email, amount, screenshotLink }) {
  const sheetId = process.env.PAYMENT_LOG_SHEET_ID;
  if (!sheetId) {
    throw new Error('PAYMENT_LOG_SHEET_ID is not configured');
  }

  await ensurePaymentLogHeaders(sheetId);

  // Leading apostrophe forces Sheets to store this as literal text instead
  // of auto-converting it to a date serial number (which then displays as
  // a raw integer unless the column happens to be formatted as a date).
  const dateStr = `'${new Date().toISOString().slice(0, 10)}`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${PAYMENT_LOG_SHEET_NAME}!A:F`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[dateStr, name, phone, email, amount, screenshotLink || '']] },
  });
}

export async function POST(request) {
  try {
    const incomingFormData = await request.formData();

    const name = incomingFormData.get('name') || '';
    const amount = incomingFormData.get('amount') || '';
    const email = incomingFormData.get('email') || '';
    const phone = incomingFormData.get('phone') || '';
    const screenshot = incomingFormData.get('screenshot');

    if (!screenshot || typeof screenshot === 'string' || screenshot.size === 0) {
      return NextResponse.json({ error: 'A payment screenshot is required.' }, { status: 400 });
    }
    if (screenshot.type && !screenshot.type.startsWith('image/')) {
      return NextResponse.json({ error: 'The payment proof must be an image.' }, { status: 400 });
    }

    let screenshotLink;
    try {
      screenshotLink = await uploadPaymentScreenshot(screenshot, email);
    } catch (driveError) {
      console.error('Error uploading payment screenshot to Drive:', driveError);
      return NextResponse.json(
        { error: 'Failed to store the payment screenshot. Please try again.' },
        { status: 500 }
      );
    }

    try {
      await logPaymentToSheet({ name, phone, email, amount, screenshotLink });
    } catch (sheetError) {
      console.error('Error logging payment details to sheet:', sheetError);
      return NextResponse.json(
        { error: 'Failed to log payment details. Please try again.' },
        { status: 500 }
      );
    }

    const receiptBackendUrl = process.env.RECEIPT_BACKEND_URL;
    if (!receiptBackendUrl) {
      console.error('RECEIPT_BACKEND_URL is not configured');
      return NextResponse.json({ error: 'Invoicing backend is not configured.' }, { status: 500 });
    }

    const outgoingFormData = new FormData();
    outgoingFormData.append('name', name);
    outgoingFormData.append('amount', amount);
    outgoingFormData.append('email', email);

    const upstreamResponse = await fetch(receiptBackendUrl, {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.RECEIPT_API_KEY || '',
      },
      body: outgoingFormData,
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to generate receipt' },
        { status: upstreamResponse.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error proxying receipt generation:', error);
    return NextResponse.json(
      { error: 'Failed to reach invoicing backend' },
      { status: 500 }
    );
  }
}
