import { NextResponse } from 'next/server';
import { getAgent } from '../../lib/agentIdentity';
import {
  AGENT_SESSIONS_HEADERS,
  AGENT_SESSIONS_SHEET,
  ensureTab,
  getSheetsClient,
  pakistanDate,
} from '../../lib/callLogs';

const sheets = getSheetsClient();

const VALID_EVENTS = ['session_start', 'break_start', 'break_end', 'session_end'];

function spreadsheetId() {
  return process.env.GOOGLE_SHEET_ID;
}

// Append-only shift log. Start, breaks and end are separate rows rather than
// one mutable row per shift, so a crashed or reinstalled app can never lose or
// rewrite what already happened — the phases are derived by replaying them.
export async function POST(request) {
  try {
    const agent = await getAgent();
    if (!agent) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const { event, note } = await request.json();
    if (!VALID_EVENTS.includes(event)) {
      return NextResponse.json({ error: 'Invalid session event' }, { status: 400 });
    }

    const id = spreadsheetId();
    if (!id) return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 });

    await ensureTab(sheets, id, AGENT_SESSIONS_SHEET, AGENT_SESSIONS_HEADERS);

    const now = new Date();
    await sheets.spreadsheets.values.append({
      spreadsheetId: id,
      range: `${AGENT_SESSIONS_SHEET}!A:F`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [
          [
            // ISO with offset so the client can compute durations exactly,
            // independent of how the sheet chooses to display it.
            now.toISOString(),
            pakistanDate(now),
            agent.name,
            agent.email,
            event,
            note || '',
          ],
        ],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording session event:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record session event' },
      { status: 500 }
    );
  }
}

// Today's events for the signed-in agent, oldest first.
export async function GET() {
  try {
    const agent = await getAgent();
    if (!agent) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const id = spreadsheetId();
    if (!id) return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 });

    await ensureTab(sheets, id, AGENT_SESSIONS_SHEET, AGENT_SESSIONS_HEADERS);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${AGENT_SESSIONS_SHEET}!A2:F`,
    });

    const today = pakistanDate();
    const events = (response.data.values || [])
      .filter((row) => row[1] === today && row[3] === agent.email)
      .map((row) => ({ timestamp: row[0], agent: row[2], event: row[4], note: row[5] || '' }))
      .sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));

    return NextResponse.json({ date: today, agent: agent.name, events });
  } catch (error) {
    console.error('Error fetching session events:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch session events' },
      { status: 500 }
    );
  }
}
