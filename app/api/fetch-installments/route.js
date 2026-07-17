import { google } from 'googleapis';
import { NextResponse } from 'next/server';

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

const INSTALLMENT_TABS = ['ep-40', 'ep-41', 'ep-42'];
const ORDINALS = ['1st', '2nd', '3rd', '4th'];

function classifyInstallment(value) {
  const normalized = (value || '').toString().trim().toLowerCase();
  if (!normalized) return 'blank';
  if (normalized === 'paid') return 'paid';
  if (normalized === 'not paying') return 'notPaying';
  return 'pending';
}

function ordinalOf(header) {
  const h = (header || '').toLowerCase();
  if (/1st/.test(h)) return '1st';
  if (/2nd/.test(h)) return '2nd';
  if (/3rd/.test(h)) return '3rd';
  if (/4th|4rth/.test(h)) return '4th';
  return null;
}

function emptyCounts() {
  return { paid: 0, notPaying: 0, pending: 0 };
}

export async function GET() {
  try {
    const spreadsheetId = process.env.INSTALLMENT_SHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Installment spreadsheet not configured' }, { status: 500 });
    }

    const counts = emptyCounts();
    const byBatch = INSTALLMENT_TABS.reduce((acc, tab) => {
      acc[tab] = {
        ...emptyCounts(),
        byOrdinal: ORDINALS.reduce((a, key) => {
          a[key] = emptyCounts();
          return a;
        }, {}),
      };
      return acc;
    }, {});

    await Promise.all(
      INSTALLMENT_TABS.map(async (tab) => {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${tab}!A1:Z1000`,
        });
        const rows = response.data.values || [];
        const header = rows[0] || [];
        const installmentColumns = header
          .map((h, i) => ({ index: i, ordinal: /installment/i.test(h || '') ? ordinalOf(h) : null }))
          .filter((c) => c.ordinal !== null);

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r] || [];
          installmentColumns.forEach(({ index, ordinal }) => {
            const status = classifyInstallment(row[index]);
            if (status === 'blank') return;
            counts[status]++;
            byBatch[tab][status]++;
            byBatch[tab].byOrdinal[ordinal][status]++;
          });
        }
      })
    );

    return NextResponse.json({ ...counts, byBatch });
  } catch (error) {
    console.error('Error fetching installments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch installments' },
      { status: 500 }
    );
  }
}
