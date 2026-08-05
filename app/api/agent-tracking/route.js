import { NextResponse } from 'next/server';
import { buildSessions } from '../../lib/agentSessions';
import {
  AGENT_SESSIONS_HEADERS,
  AGENT_SESSIONS_SHEET,
  CALL_LOGS_HEADERS,
  CALL_LOGS_SHEET,
  ensureTab,
  getSheetsClient,
  pakistanDate,
  parsePakistanTimestamp,
} from '../../lib/callLogs';

const sheets = getSheetsClient();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || pakistanDate();

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 });
    }

    await ensureTab(sheets, spreadsheetId, AGENT_SESSIONS_SHEET, AGENT_SESSIONS_HEADERS);
    await ensureTab(sheets, spreadsheetId, CALL_LOGS_SHEET, CALL_LOGS_HEADERS);

    const [sessionRes, callRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${AGENT_SESSIONS_SHEET}!A2:F`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${CALL_LOGS_SHEET}!A2:P`,
      }),
    ]);

    const sessionRows = (sessionRes.data.values || []).filter((r) => r[1] === date);
    const callRows = (callRes.data.values || []).filter((r) => r[1] === date);

    // Group events by agent email — a person's display name can change in
    // Clerk, but the email is what ties their rows together.
    const byAgent = new Map();
    for (const row of sessionRows) {
      const email = row[3] || row[2] || 'unknown';
      if (!byAgent.has(email)) {
        byAgent.set(email, { agent: row[2] || email, email, events: [] });
      }
      byAgent.get(email).events.push({ timestamp: row[0], event: row[4] });
    }

    const calls = callRows.map((r) => ({
      agent: r[2] || '',
      email: r[3] || '',
      leadRow: r[5] || '',
      leadName: r[6] || '',
      at: parsePakistanTimestamp(r[0]),
      durationSeconds: parseInt(r[10], 10) || 0,
      status: r[12] || '',
    }));

    // An agent who made calls without ever starting a session still belongs in
    // the report — otherwise their work silently disappears from it.
    for (const call of calls) {
      const key = call.email || call.agent || 'unknown';
      if (!byAgent.has(key)) {
        byAgent.set(key, { agent: call.agent || key, email: call.email, events: [] });
      }
    }

    const nowMs = Date.now();

    const agents = [...byAgent.values()].map(({ agent, email, events }) => {
      events.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
      const sessions = buildSessions(events, nowMs);
      const agentCalls = calls.filter((c) => (c.email || c.agent) === (email || agent));

      const detailed = sessions.map((s) => {
        const within = agentCalls.filter(
          (c) => c.at !== null && c.at >= s.startedAt && c.at <= s.endedAt
        );
        const workedMs = Math.max(0, s.endedAt - s.startedAt - s.breakMs);
        return {
          startedAt: new Date(s.startedAt).toISOString(),
          endedAt: new Date(s.endedAt).toISOString(),
          inProgress: !!s.inProgress,
          openEnded: !!s.openEnded,
          workedMs,
          breakMs: s.breakMs,
          breaks: s.breaks,
          calls: within.length,
          leads: new Set(within.map((c) => c.leadRow)).size,
          talkSeconds: within.reduce((sum, c) => sum + c.durationSeconds, 0),
        };
      });

      // Calls that fall outside every session — logged before clocking in or
      // after clocking out. Surfaced rather than hidden, because a large number
      // here means the shift log is not being kept.
      const inAnySession = (call) =>
        call.at !== null &&
        sessions.some((s) => call.at >= s.startedAt && call.at <= s.endedAt);
      const untracked = agentCalls.filter((c) => !inAnySession(c));

      return {
        agent,
        email,
        sessions: detailed,
        totals: {
          workedMs: detailed.reduce((s, x) => s + x.workedMs, 0),
          breakMs: detailed.reduce((s, x) => s + x.breakMs, 0),
          calls: agentCalls.length,
          leads: new Set(agentCalls.map((c) => c.leadRow)).size,
          talkSeconds: agentCalls.reduce((s, c) => s + c.durationSeconds, 0),
          untrackedCalls: untracked.length,
          sessionCount: detailed.length,
        },
      };
    });

    agents.sort((a, b) => b.totals.calls - a.totals.calls);

    return NextResponse.json({ date, agents });
  } catch (error) {
    console.error('Error building agent tracking:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to build agent tracking' },
      { status: 500 }
    );
  }
}
