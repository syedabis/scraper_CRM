import { NextResponse } from 'next/server';
import {
  CALL_LOGS_HEADERS,
  CALL_LOGS_SHEET,
  ensureTab,
  getSheetsClient,
  pakistanDate,
} from '../../lib/callLogs';

const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);

// Per-call detail: one row per call, so a lead that was called five times
// returns five entries with five different durations. Filterable by lead row
// (for the drill-down on a single lead) or by agent (for per-person reporting).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const row = searchParams.get('row');
    const agent = searchParams.get('agent');
    const date = searchParams.get('date');

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 });
    }

    await ensureTab(sheets, spreadsheetId, CALL_LOGS_SHEET, CALL_LOGS_HEADERS);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${CALL_LOGS_SHEET}!A2:P`,
    });

    const calls = (response.data.values || [])
      .map((r) => ({
        loggedAt: r[0] || '',
        date: r[1] || '',
        agent: r[2] || '',
        agentEmail: r[3] || '',
        leadTab: r[4] || '',
        leadRow: parseInt(r[5], 10) || null,
        leadName: r[6] || '',
        phone: r[7] || '',
        callStart: r[8] || '',
        callEnd: r[9] || '',
        durationSeconds: parseInt(r[10], 10) || 0,
        duration: r[11] || '',
        status: r[12] || '',
        outcome: r[13] || '',
        source: r[14] || '',
        notes: r[15] || '',
      }))
      .filter((c) => {
        if (row && c.leadRow !== parseInt(row, 10)) return false;
        if (agent && c.agent !== agent && c.agentEmail !== agent) return false;
        if (date && c.date !== date) return false;
        return true;
      });

    const totalSeconds = calls.reduce((sum, c) => sum + c.durationSeconds, 0);

    return NextResponse.json({
      calls,
      summary: {
        count: calls.length,
        totalSeconds,
        averageSeconds: calls.length ? Math.round(totalSeconds / calls.length) : 0,
        today: pakistanDate(),
      },
    });
  } catch (error) {
    console.error('Error fetching call logs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch call logs' },
      { status: 500 }
    );
  }
}
