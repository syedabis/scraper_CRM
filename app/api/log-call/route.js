import { NextResponse } from 'next/server';
import { splitSlotEntries } from '../../lib/pendingConfirmations';
import { getAgent } from '../../lib/agentIdentity';
import {
  CALL_LOGS_HEADERS,
  CALL_LOGS_SHEET,
  ensureTab,
  formatDuration,
  getSheetsClient,
  pakistanDate,
  pakistanTimestamp,
} from '../../lib/callLogs';

const sheets = getSheetsClient();

const VALID_STATUSES = [
  'New Lead',
  'Connected',
  'No Answer',
  'Follow Up',
  'Registration',
  'Payment Pending (Confirmation)',
  'Demo',
  'Enrolled',
  'Lost',
];

const STATUSES_REQUIRING_DATE = ['Enrolled', 'Payment Pending (Confirmation)'];

const SLOT_COLUMN = { 'Slot 1': 'G', 'Slot 2': 'H', 'Slot 3': 'I', 'Slot 4': 'J' };
const SLOT_INDEX = { G: 6, H: 7, I: 8, J: 9 }; // within A:R

// Column O accumulates total talk time in minutes. Kept as a number rather than
// "12m 40s" so it can be summed and sorted in the sheet and on the dashboard.
const TOTAL_TALK_INDEX = 14; // O within A:R

/**
 * Records the whole outcome of one call in a single request:
 *   1. appends a row to `call-logs` — this call, with its own duration
 *   2. updates the lead's existing status columns (F, G-J, K, L, N)
 *   3. refreshes the rollups (O, P, Q) the dashboard reads
 *
 * Writing 2 and 3 as one batchUpdate means the lead row can't end up with a new
 * status but stale totals if the request dies halfway.
 */
export async function POST(request) {
  try {
    const agent = await getAgent();
    if (!agent) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const body = await request.json();
    const {
      owner,
      rowIndex,
      status,
      statusDate,
      timeSlot,
      notes,
      durationSeconds = 0,
      source = 'manual',
      outcome = null,
    } = body;

    if (!owner) return NextResponse.json({ error: 'Owner is required' }, { status: 400 });
    if (rowIndex === undefined || rowIndex === null) {
      return NextResponse.json({ error: 'Row index is required' }, { status: 400 });
    }
    if (!status) return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }
    if (STATUSES_REQUIRING_DATE.includes(status) && !statusDate) {
      return NextResponse.json(
        { error: 'A date is required for Enrolled/Payment Pending (Confirmation)' },
        { status: 400 }
      );
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 });
    }

    const tab = owner.toLowerCase();
    const duration = Math.max(0, Math.round(Number(durationSeconds) || 0));

    // Current state of the row: needed to append to (not clobber) a reused slot
    // cell, to recount attempts, and to add to the running talk-time total.
    const rowResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A${rowIndex}:R${rowIndex}`,
    });
    const rowData = rowResponse.data.values?.[0] || [];

    const now = new Date();
    const stamp = pakistanTimestamp(now);

    // Slot columns G-J are time-of-day windows, not attempt numbers — a window
    // reused on another day appends rather than replaces.
    const slotKey = Object.keys(SLOT_COLUMN).find((k) => (timeSlot || '').includes(k));
    const slotColumn = slotKey ? SLOT_COLUMN[slotKey] : null;

    let newSlotValue = null;
    if (slotColumn) {
      const existing = (rowData[SLOT_INDEX[slotColumn]] || '').toString().trim();
      const entry = `${status} (${stamp})`;
      newSlotValue = existing ? `${existing},${entry}` : entry;
    }

    // True attempt count is the number of entries across all four slots, since
    // one cell can hold several.
    const slotValues = ['G', 'H', 'I', 'J'].map((col) =>
      col === slotColumn ? newSlotValue : rowData[SLOT_INDEX[col]] || ''
    );
    const attempts = slotValues.reduce((sum, v) => sum + splitSlotEntries(v).length, 0);

    const previousTotalMinutes = parseFloat(rowData[TOTAL_TALK_INDEX]) || 0;
    const newTotalMinutes = Math.round((previousTotalMinutes + duration / 60) * 10) / 10;

    const data = [
      { range: `${tab}!F${rowIndex}`, values: [[status]] },
      { range: `${tab}!K${rowIndex}`, values: [[attempts]] },
    ];

    if (slotColumn) {
      data.push({ range: `${tab}!${slotColumn}${rowIndex}`, values: [[newSlotValue]] });
    }
    if (notes && notes.trim()) {
      data.push({ range: `${tab}!L${rowIndex}`, values: [[notes.trim()]] });
    }
    if (statusDate) {
      // Enrolled closes out any prior pending reminder rather than leaving a
      // date that would keep resurfacing.
      const value = status === 'Enrolled' ? `Closed (${statusDate})` : statusDate;
      data.push({ range: `${tab}!N${rowIndex}`, values: [[value]] });
    }
    if (duration > 0) {
      data.push({ range: `${tab}!O${rowIndex}`, values: [[newTotalMinutes]] });
      data.push({ range: `${tab}!P${rowIndex}`, values: [[formatDuration(duration)]] });
      data.push({ range: `${tab}!Q${rowIndex}`, values: [[stamp]] });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'RAW', data },
    });

    // The per-call record. Logged after the lead row so a failure here leaves
    // the lead correct rather than half-updated; the call row is recoverable
    // from the slot history, the reverse is not.
    let callLogged = true;
    try {
      await ensureTab(sheets, spreadsheetId, CALL_LOGS_SHEET, CALL_LOGS_HEADERS);
      const startedAt = new Date(now.getTime() - duration * 1000);
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${CALL_LOGS_SHEET}!A:P`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [
            [
              stamp,
              pakistanDate(now),
              agent.name,
              agent.email,
              owner,
              rowIndex,
              body.name || rowData[2] || '',
              body.phone || rowData[4] || '',
              duration > 0 ? pakistanTimestamp(startedAt) : '',
              duration > 0 ? stamp : '',
              duration,
              formatDuration(duration),
              status,
              outcome || '',
              source,
              (notes || '').trim(),
            ],
          ],
        },
      });
    } catch (logError) {
      console.error('Lead updated but call-log append failed:', logError);
      callLogged = false;
    }

    return NextResponse.json({
      success: true,
      attempts,
      totalTalkMinutes: newTotalMinutes,
      callLogged,
    });
  } catch (error) {
    console.error('Error logging call:', error);
    return NextResponse.json({ error: error.message || 'Failed to log call' }, { status: 500 });
  }
}
