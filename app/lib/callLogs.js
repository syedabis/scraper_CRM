import { google } from 'googleapis';

// Shared plumbing for the two tabs the mobile app writes to. Both are
// append-only: a call or a shift event is a fact that happened, so nothing here
// ever overwrites an earlier row. The lead's own row keeps only summaries.

export const CALL_LOGS_SHEET = 'call-logs';
export const AGENT_SESSIONS_SHEET = 'agent-sessions';

export const CALL_LOGS_HEADERS = [
  'Logged At',
  'Date',
  'Agent',
  'Agent Email',
  'Lead Tab',
  'Lead Row',
  'Lead Name',
  'Phone',
  'Call Start',
  'Call End',
  'Duration (sec)',
  'Duration',
  'Status Set',
  'Outcome',
  'Source',
  'Notes',
];

export const AGENT_SESSIONS_HEADERS = [
  'Timestamp',
  'Date',
  'Agent',
  'Agent Email',
  'Event',
  'Note',
];

export function getSheetsClient(scopes = ['https://www.googleapis.com/auth/spreadsheets']) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes,
  });
  return google.sheets({ version: 'v4', auth });
}

// Creates the tab with its header row the first time it's needed, so nobody has
// to prepare the spreadsheet by hand before the app can be used.
export async function ensureTab(sheets, spreadsheetId, title, headers) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets || []).some((s) => s.properties.title === title);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    });
  }

  const headerRange = `${title}!A1:${columnLetter(headers.length)}1`;
  const current = await sheets.spreadsheets.values.get({ spreadsheetId, range: headerRange });
  if (!current.data.values || current.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
}

export function columnLetter(index) {
  let n = index;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out || 'A';
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function pakistanTimestamp(date = new Date()) {
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true,
  });
}

export function pakistanDate(date = new Date()) {
  // en-CA gives YYYY-MM-DD, which sorts and compares as a plain string.
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}
