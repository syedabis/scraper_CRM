import { NextResponse } from 'next/server';
import { getSheetsClient, pakistanTimestamp } from '../../lib/callLogs';
import {
  STATUS_TO_META_EVENT,
  isAlreadySyncedInSheet,
  sendMetaCapiEvent,
  stampMetaCapiSyncToSheet,
} from '../../lib/metaCapi';

const sheets = getSheetsClient();

/**
 * Ensures header S1 has "Meta CAPI Synced"
 */
async function ensureColumnSHeader(spreadsheetId, sheetName) {
  try {
    const range = `${sheetName}!S1`;
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const currentVal = res.data.values?.[0]?.[0];
    if (!currentVal) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Meta CAPI Synced']],
        },
      });
    }
  } catch (err) {
    console.warn(`[sync-sheet-capi] Could not check header S1 for ${sheetName}:`, err.message);
  }
}

/**
 * Syncs a single row to Meta CAPI if it represents a new milestone
 */
async function syncSingleRow({
  spreadsheetId,
  sheetName,
  rowIndex,
  status: inputStatus,
  phone: inputPhone,
  email: inputEmail,
  leadDate: inputLeadDate,
  force = false,
}) {
  // Fetch row A:S from Google Sheets to get latest row state
  const range = `${sheetName}!A${rowIndex}:S${rowIndex}`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const row = response.data.values?.[0] || [];
  if (row.length === 0) {
    return { success: false, reason: `Row ${rowIndex} is empty or not found in sheet '${sheetName}'.` };
  }

  // Column positions (0-indexed):
  // 0: Date (A), 1: Time (B), 2: Name (C), 3: Email (D), 4: Phone (E), 5: Status (F), ... 18: Column S (Sync Stamp)
  const leadDate = inputLeadDate || row[0] || '';
  const email = inputEmail || row[3] || '';
  const phone = inputPhone || row[4] || '';
  const currentStatus = inputStatus || row[5] || '';
  const columnSValue = row[18] || '';

  const eventName = STATUS_TO_META_EVENT[currentStatus];
  if (!eventName) {
    return {
      success: true,
      skipped: true,
      reason: `Status '${currentStatus}' is not a tracked milestone (Demo, Registration, Payment Pending, Enrolled).`,
    };
  }

  // Repeat / Duplicate Check using Column S
  if (!force && isAlreadySyncedInSheet(columnSValue, currentStatus)) {
    console.log(`[sync-sheet-capi] Skipped: Row ${rowIndex} (${phone}) was already synced as '${eventName}' in Column S.`);
    return {
      success: true,
      skipped: true,
      alreadySynced: true,
      reason: `Already synced: Column S contains '${columnSValue}'. Duplicate blocked.`,
    };
  }

  // Dispatch to Meta CAPI
  const capiRes = await sendMetaCapiEvent({
    status: currentStatus,
    phone,
    email,
    leadDate,
    owner: sheetName,
    sheets,
    spreadsheetId,
    rowIndex,
  });

  if (capiRes.success) {
    await ensureColumnSHeader(spreadsheetId, sheetName);
    return {
      success: true,
      synced: true,
      eventName,
      phoneEnding: phone ? phone.slice(-4) : '',
      columnS: `Synced: ${eventName} (${pakistanTimestamp()})`,
    };
  } else {
    return {
      success: false,
      reason: capiRes.reason || 'Meta CAPI rejected event.',
    };
  }
}

/**
 * Scans an entire sheet tab and syncs all milestone leads that haven't been stamped in Column S
 */
async function scanAndSyncSheet({ spreadsheetId, sheetName }) {
  await ensureColumnSHeader(spreadsheetId, sheetName);

  const range = `${sheetName}!A2:S`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values || [];
  const results = {
    totalChecked: rows.length,
    syncedCount: 0,
    skippedCount: 0,
    details: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 2; // Row 1 is header
    const row = rows[i];
    const status = (row[5] || '').toString().trim();
    const columnSValue = (row[18] || '').toString().trim();
    const phone = (row[4] || '').toString().trim();
    const email = (row[3] || '').toString().trim();
    const leadDate = (row[0] || '').toString().trim();

    const eventName = STATUS_TO_META_EVENT[status];
    if (!eventName) {
      // Not a milestone status
      results.skippedCount++;
      continue;
    }

    if (isAlreadySyncedInSheet(columnSValue, status)) {
      results.skippedCount++;
      results.details.push({
        rowIndex,
        status,
        event: eventName,
        action: 'skipped_already_synced',
        columnS: columnSValue,
      });
      continue;
    }

    // Unsynced milestone found! Dispatch to CAPI
    const capiRes = await sendMetaCapiEvent({
      status,
      phone,
      email,
      leadDate,
      owner: sheetName,
      sheets,
      spreadsheetId,
      rowIndex,
    });

    if (capiRes.success) {
      results.syncedCount++;
      results.details.push({
        rowIndex,
        phoneEnding: phone.slice(-4),
        status,
        event: eventName,
        action: 'synced_now',
      });
    } else {
      results.details.push({
        rowIndex,
        phoneEnding: phone.slice(-4),
        status,
        action: 'failed',
        reason: capiRes.reason,
      });
    }
  }

  return results;
}

export async function POST(request) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet ID not configured.' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const sheetName = body.sheetName || process.env.PRIMARY_SHEET_NAME || 'Pretty';
    const action = body.action || (body.rowIndex ? 'singleRow' : 'scanAndSync');

    if (action === 'scanAndSync') {
      const scanResult = await scanAndSyncSheet({ spreadsheetId, sheetName });
      return NextResponse.json({ success: true, sheetName, ...scanResult });
    }

    if (!body.rowIndex) {
      return NextResponse.json({ error: 'rowIndex is required for single row sync.' }, { status: 400 });
    }

    const singleResult = await syncSingleRow({
      spreadsheetId,
      sheetName,
      rowIndex: body.rowIndex,
      status: body.status,
      phone: body.phone,
      email: body.email,
      leadDate: body.leadDate,
      force: Boolean(body.force),
    });

    return NextResponse.json(singleResult);
  } catch (err) {
    console.error('[sync-sheet-capi] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet ID not configured.' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const sheetName = searchParams.get('sheetName') || process.env.PRIMARY_SHEET_NAME || 'Pretty';
    const rowIndex = searchParams.get('rowIndex');

    if (rowIndex) {
      const singleResult = await syncSingleRow({
        spreadsheetId,
        sheetName,
        rowIndex: Number(rowIndex),
      });
      return NextResponse.json(singleResult);
    }

    // Default action for GET is scan & sync
    const scanResult = await scanAndSyncSheet({ spreadsheetId, sheetName });
    return NextResponse.json({ success: true, sheetName, ...scanResult });
  } catch (err) {
    console.error('[sync-sheet-capi] GET Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
