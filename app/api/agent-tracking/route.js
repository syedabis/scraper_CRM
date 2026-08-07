import { NextResponse } from 'next/server';
import { buildSessions } from '../../lib/agentSessions';
import { getAgent } from '../../lib/agentIdentity';
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

// "Not Received" is the pre-rename spelling still sitting in older rows, so
// counting only the current name would quietly undercount the history.
const NO_ANSWER_STATUSES = ['No Answer', 'Not Received'];
const isNoAnswer = (status) => NO_ANSWER_STATUSES.includes((status || '').trim());

// Both clients read this one endpoint — the portal for everyone, the mobile
// app with self=true for the signed-in agent's own history. Same calculation
// either way, so the phone and the portal can never show different numbers for
// the same shift.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const today = pakistanDate();
    // `date` is kept as a shorthand for a single day.
    const single = searchParams.get('date');
    const from = single || searchParams.get('from') || today;
    const to = single || searchParams.get('to') || today;
    const selfOnly = searchParams.get('self') === 'true';

    if (from > to) {
      return NextResponse.json({ error: '"from" must not be after "to"' }, { status: 400 });
    }

    let me = null;
    if (selfOnly) {
      me = await getAgent();
      if (!me) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 });
    }

    await ensureTab(sheets, spreadsheetId, AGENT_SESSIONS_SHEET, AGENT_SESSIONS_HEADERS);
    await ensureTab(sheets, spreadsheetId, CALL_LOGS_SHEET, CALL_LOGS_HEADERS);

    const [sessionRes, callRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: `${AGENT_SESSIONS_SHEET}!A2:F` }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: `${CALL_LOGS_SHEET}!A2:P` }),
    ]);

    // Dates are stored as plain YYYY-MM-DD, so string comparison is
    // chronological and no parsing is needed to bound the range.
    const inRange = (d) => d >= from && d <= to;
    const mine = (email, name) =>
      !selfOnly || email === me.email || (!email && name === me.name);

    const sessionRows = (sessionRes.data.values || []).filter(
      (r) => inRange(r[1] || '') && mine(r[3], r[2])
    );
    const callRows = (callRes.data.values || []).filter(
      (r) => inRange(r[1] || '') && mine(r[3], r[2])
    );

    const byAgent = new Map();
    const keyFor = (email, name) => email || name || 'unknown';

    for (const row of sessionRows) {
      const key = keyFor(row[3], row[2]);
      if (!byAgent.has(key)) byAgent.set(key, { agent: row[2] || key, email: row[3] || '', events: [] });
      byAgent.get(key).events.push({ timestamp: row[0], event: row[4] });
    }

    const calls = callRows.map((r) => ({
      key: keyFor(r[3], r[2]),
      agent: r[2] || '',
      email: r[3] || '',
      date: r[1] || '',
      leadRow: r[5] || '',
      at: parsePakistanTimestamp(r[0]),
      durationSeconds: parseInt(r[10], 10) || 0,
      // Column M: exactly the status button the agent pressed after the call.
      status: (r[12] || '').trim(),
    }));

    // Someone who made calls without ever clocking in still belongs in the
    // report; dropping them would hide real work.
    for (const call of calls) {
      if (!byAgent.has(call.key)) {
        byAgent.set(call.key, { agent: call.agent || call.key, email: call.email, events: [] });
      }
    }

    const nowMs = Date.now();
    const dateOf = (ms) =>
      new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

    const agents = [...byAgent.entries()].map(([key, { agent, email, events }]) => {
      const sessions = buildSessions(events, nowMs);
      const agentCalls = calls.filter((c) => c.key === key);

      const detailed = sessions.map((s) => {
        const within = agentCalls.filter(
          (c) => c.at !== null && c.at >= s.startedAt && c.at <= s.endedAt
        );
        return {
          date: dateOf(s.startedAt),
          startedAt: new Date(s.startedAt).toISOString(),
          endedAt: new Date(s.endedAt).toISOString(),
          inProgress: !!s.inProgress,
          openEnded: !!s.openEnded,
          workedMs: s.workedMs,
          breakMs: s.breakMs,
          breaks: s.breaks,
          calls: within.length,
          noAnswer: within.filter((c) => isNoAnswer(c.status)).length,
          leads: new Set(within.map((c) => c.leadRow)).size,
          talkSeconds: within.reduce((sum, c) => sum + c.durationSeconds, 0),
        };
      });

      // Drop fragments: a session with no worked time, no break and no calls is
      // not a shift, it is the residue of Start being tapped twice — the second
      // tap closes the first session the instant it opened. They carry no
      // information and bury the real rows. A running session is always kept,
      // since it legitimately has nothing in it yet.
      const meaningful = detailed.filter(
        (s) => s.inProgress || s.calls > 0 || s.workedMs >= 1000 || s.breakMs > 0
      );

      // Newest first — the day just worked is the one people look at.
      meaningful.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

      const tracked = new Set();
      meaningful.forEach((s) => {
        agentCalls.forEach((c) => {
          if (
            c.at !== null &&
            c.at >= Date.parse(s.startedAt) &&
            c.at <= Date.parse(s.endedAt)
          ) {
            tracked.add(c);
          }
        });
      });

      return {
        agent,
        email,
        sessions: meaningful,
        totals: {
          workedMs: meaningful.reduce((s, x) => s + x.workedMs, 0),
          breakMs: meaningful.reduce((s, x) => s + x.breakMs, 0),
          calls: agentCalls.length,
          noAnswer: agentCalls.filter((c) => isNoAnswer(c.status)).length,
          leads: new Set(agentCalls.map((c) => c.leadRow)).size,
          talkSeconds: agentCalls.reduce((s, c) => s + c.durationSeconds, 0),
          untrackedCalls: agentCalls.length - tracked.size,
          sessionCount: meaningful.length,
          daysWorked: new Set(meaningful.map((s) => s.date)).size,
        },
      };
    });

    agents.sort((a, b) => b.totals.calls - a.totals.calls);

    return NextResponse.json({ from, to, agents });
  } catch (error) {
    console.error('Error building agent tracking:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to build agent tracking' },
      { status: 500 }
    );
  }
}
