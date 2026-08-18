import { NextResponse } from 'next/server';
import { getAgent } from '../../../lib/agentIdentity';
import {
  CALL_LOGS_HEADERS,
  CALL_LOGS_SHEET,
  ensureTab,
  formatDuration,
  getSheetsClient,
  pakistanDate,
  pakistanTimestamp,
} from '../../../lib/callLogs';

const sheets = getSheetsClient();

// The full set of stages the mobile sends for GRP leads.
const VALID_STAGES = [
  'Connected',
  'No Answer',
  'Follow Up',
  'Registration',
  'Payment Pending (Confirmation)',
  'Demo',
  'Enrolled',
  'Lost',
  'Interested',
  'Not Interested',
  'Callback',
];

/**
 * Records the outcome of one GRP call.
 *
 * EP-44 has only 4 columns (A=Name, B=Phone, C=Stage, D=Notes), so this is
 * simpler than log-call for Pretty: there are no slot columns, no attempt
 * counter, and no running talk-time total. It writes stage and notes, then
 * appends to the shared call-logs tab in the MAIN spreadsheet so the agent
 * tracking dashboard counts every call regardless of which sheet it came from.
 */
export async function POST(request) {
  try {
    const agent = await getAgent();
    if (!agent) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const body = await request.json();
    const {
      rowIndex,
      stage,
      notes,
      durationSeconds = 0,
      source = 'manual',
      outcome = null,
      name = '',
      phone = '',
    } = body;

    if (rowIndex === undefined || rowIndex === null) {
      return NextResponse.json({ error: 'Row index is required' }, { status: 400 });
    }
    if (!stage) {
      return NextResponse.json({ error: 'Stage is required' }, { status: 400 });
    }
    if (!VALID_STAGES.includes(stage)) {
      return NextResponse.json(
        { error: `Invalid stage "${stage}". Must be one of: ${VALID_STAGES.join(', ')}` },
        { status: 400 }
      );
    }

    const grpSpreadsheetId = process.env.GRP_SHEET_ID;
    if (!grpSpreadsheetId) {
      return NextResponse.json(
        { error: 'GRP Spreadsheet ID not configured' },
        { status: 500 }
      );
    }

    const now = new Date();
    const stamp = pakistanTimestamp(now);
    const duration = Math.max(0, Math.round(Number(durationSeconds) || 0));

    // Write Stage (col C) and optionally Notes (col D) back to the GRP sheet.
    const data = [
      { range: `EP-44!C${rowIndex}`, values: [[stage]] },
    ];
    if (notes && notes.trim()) {
      data.push({ range: `EP-44!D${rowIndex}`, values: [[notes.trim()]] });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: grpSpreadsheetId,
      requestBody: { valueInputOption: 'RAW', data },
    });

    // Append a call-logs row to the MAIN spreadsheet so Agent Tracking counts
    // this call alongside Pretty and Agent-leads calls. Failure here is not
    // fatal — the lead stage was already written above, which is the critical
    // part. We log the error and report it to the caller as a soft failure.
    let callLogged = true;
    try {
      const mainSheetId = process.env.GOOGLE_SHEET_ID;
      if (mainSheetId) {
        await ensureTab(sheets, mainSheetId, CALL_LOGS_SHEET, CALL_LOGS_HEADERS);
        const startedAt = new Date(now.getTime() - duration * 1000);
        await sheets.spreadsheets.values.append({
          spreadsheetId: mainSheetId,
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
                'GRP Leads',      // Lead Tab column — matches the source label
                rowIndex,
                name,
                phone,
                duration > 0 ? pakistanTimestamp(startedAt) : '',
                duration > 0 ? stamp : '',
                duration,
                formatDuration(duration),
                stage,            // Status Set column
                outcome || '',
                source,
                (notes || '').trim(),
              ],
            ],
          },
        });
      }
    } catch (logError) {
      console.error('GRP lead updated but call-log append failed:', logError);
      callLogged = false;
    }

    return NextResponse.json({ success: true, callLogged });
  } catch (error) {
    console.error('Error logging GRP call:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to log GRP call' },
      { status: 500 }
    );
  }
}
