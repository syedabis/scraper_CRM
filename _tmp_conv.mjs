import fs from 'fs';
import { google } from 'googleapis';

const envContent = fs.readFileSync('D:/Ahmer/sales crm/.env.local', 'utf8');
const getVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1] : null;
};
const clientEmail = getVar('GOOGLE_CLIENT_EMAIL');
let privateKey = getVar('GOOGLE_PRIVATE_KEY');
if (privateKey) privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
let spreadsheetId = getVar('GOOGLE_SHEET_ID');
if (spreadsheetId) spreadsheetId = spreadsheetId.replace(/^"|"$/g, '');

const auth = new google.auth.GoogleAuth({
  credentials: { client_email: clientEmail, private_key: privateKey },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

function parseLeadDate(value) {
  if (!value) return null;
  const str = value.toString().trim();
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

const CONVERTED_STATUSES = ['Confirmation', 'Paid', 'Demo'];
const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Pretty!A:L' });
const rows = res.data.values || [];
const dataRows = rows.slice(1);
const parsed = dataRows.map((r) => ({ date: parseLeadDate(r[0]), status: (r[5] || '').trim() }));

const start = new Date(2026, 6, 1);
const end = new Date(2026, 6, 9);
const counts = {};
for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
  const key = `${d.getMonth() + 1}/${d.getDate()}`;
  counts[key] = { total: 0, converted: 0 };
}
parsed.forEach((p) => {
  if (!p.date || p.date < start || p.date > end) return;
  const key = `${p.date.getMonth() + 1}/${p.date.getDate()}`;
  if (!counts[key]) return;
  counts[key].total++;
  if (CONVERTED_STATUSES.includes(p.status)) counts[key].converted++;
});
Object.entries(counts).forEach(([k, v]) => console.log(`${k}: total=${v.total} converted=${v.converted}`));
