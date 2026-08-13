import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// The installment spreadsheet has 30+ tabs, most of them hidden — but only
// some are real batch cohorts (Customer Name / Phone Number / installment
// columns). The rest are unrelated scratch sheets that happen to live in the
// same file (lead dumps, a store-name list, one-off summaries) or stale
// duplicates of a real batch tab. This list was hand-verified against the
// live sheet — do not swap to "every hidden tab" without re-checking, or
// duplicates/unrelated data will silently reappear.
//
// Excluded on purpose: "Copy of EP-36" (identical rows to EP-36), "DS (4th)"
// (older duplicate of "DS(4th)", which has an extra installment column),
// "DS (5th)" (opens with the same two students as "DS(EP-32)" — a renamed
// duplicate), and the non-batch tabs (Sheet20/27/30/36/40, "Installments",
// "Installments (Dates)", "Confirmations", "Cursor Subscriptions",
// "Summary", "Copy of installments").
const BATCH_TABS = [
  'Data science 3rd ',
  'DS(EP-32) ',
  'DS(4th)',
  'DS(EP-33) ',
  'EP-34',
  'EP-35',
  'EP-36',
  'EP-37',
  'EP-38',
  'EP-39',
  'EP-40',
  'EP-41',
  'EP-42',
  'EP-43',
  'EP-44',
  'Data science 2nd batch',
  'Data Analytics',
  'Gen AI',
];

// Column layout isn't identical across tabs — some lead with an "Enrollment
// Number" column before Customer Name, one tab's header cell is corrupted
// ("f" instead of "Customer Name"), and installment-column count/position
// varies. So every column is located by its header text, with a positional
// fallback for the two columns whose header sometimes isn't usable.
function locateColumns(header) {
  let nameIndex = header.findIndex((h) => /customer\s*name/i.test(h || ''));
  if (nameIndex === -1) nameIndex = header.findIndex((h) => /^name$/i.test((h || '').trim()));
  if (nameIndex === -1) nameIndex = 0;

  let phoneIndex = header.findIndex((h) => /phone/i.test(h || ''));
  if (phoneIndex === -1) phoneIndex = 1;

  const emailIndex = header.findIndex((h) => /email/i.test(h || ''));
  const installmentIndexes = header
    .map((h, i) => (/installment/i.test(h || '') ? i : -1))
    .filter((i) => i !== -1);

  return { nameIndex, phoneIndex, emailIndex, installmentIndexes };
}

// GET — every student who has paid at least one installment, across every
// verified batch tab. Used by the Paid Students page.
export async function GET() {
  try {
    const spreadsheetId = process.env.INSTALLMENT_SHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Installment spreadsheet not configured' }, { status: 500 });
    }

    // One round trip for all tabs instead of one request per tab.
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: BATCH_TABS.map((tab) => `'${tab}'!A1:Z1000`),
    });

    const students = [];
    (response.data.valueRanges || []).forEach((valueRange, i) => {
      const tab = BATCH_TABS[i];
      const rows = valueRange.values || [];
      const header = rows[0] || [];
      const { nameIndex, phoneIndex, emailIndex, installmentIndexes } = locateColumns(header);

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const name = (row[nameIndex] || '').toString().trim();
        if (!name) continue;

        const installmentsPaid = installmentIndexes.filter(
          (idx) => (row[idx] || '').toString().trim().toLowerCase() === 'paid'
        ).length;
        if (installmentsPaid === 0) continue;

        students.push({
          name,
          phone: (row[phoneIndex] || '').toString().trim(),
          email: emailIndex >= 0 ? (row[emailIndex] || '').toString().trim() : '',
          installmentsPaid,
          totalInstallments: installmentIndexes.length,
          batch: tab.trim(),
        });
      }
    });

    return NextResponse.json({
      students,
      batches: BATCH_TABS.map((t) => t.trim()),
    });
  } catch (error) {
    console.error('Error fetching paid students:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch paid students' },
      { status: 500 }
    );
  }
}
