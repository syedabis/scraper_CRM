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

// The installment spreadsheet has 30+ tabs, most hidden, and its own tab
// names are never hardcoded here — a new batch tab must show up automatically
// without a code change. Instead every tab's header row is inspected and it's
// treated as a real batch cohort only if it has BOTH a Phone column and at
// least one installment column with a digit in its header (e.g. "1st
// Installment", "4rth Installment") — that shape reliably separates batch
// tabs from the unrelated scratch sheets living in the same file (old lead
// dumps, a store-name list, "Cursor Subscriptions", summary rollups — none of
// which have that combination). A plain "Installments" column with no digit
// (seen on one stray tab) is deliberately not enough on its own.
//
// Shape alone can't tell a batch apart from a stale duplicate copy of it,
// though — "Copy of EP-36" is a byte-for-byte duplicate of "EP-36", and
// "DS (4th)" / "DS (5th)" open with the exact same students as "DS(4th)" /
// "DS(EP-32)" under a slightly different tab name. Those were confirmed by
// hand against the live sheet, so they're the one thing that IS still a
// short, explicit list — because "this is a duplicate of that other tab" is
// not something a shape check can infer, unlike "a new batch got added".
const EXCLUDED_DUPLICATE_TABS = ['Copy of EP-36', 'DS (4th)', 'DS (5th)'];

function looksLikeBatchTab(header) {
  const hasPhone = header.some((h) => /phone/i.test(h || ''));
  const hasOrdinalInstallment = header.some((h) => /\d/.test(h || '') && /installment/i.test(h || ''));
  return hasPhone && hasOrdinalInstallment;
}

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
    .map((h, i) => (/\d/.test(h || '') && /installment/i.test(h || '') ? i : -1))
    .filter((i) => i !== -1);

  return { nameIndex, phoneIndex, emailIndex, installmentIndexes };
}

// GET — every student who has paid at least one installment, across every
// tab that looks like a batch cohort. Used by the Paid Students page.
export async function GET() {
  try {
    const spreadsheetId = process.env.INSTALLMENT_SHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Installment spreadsheet not configured' }, { status: 500 });
    }

    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const allTabs = (meta.data.sheets || [])
      .map((s) => s.properties.title)
      .filter((title) => !EXCLUDED_DUPLICATE_TABS.includes(title));

    if (allTabs.length === 0) {
      return NextResponse.json({ students: [], batches: [] });
    }

    // One round trip for every tab's data instead of one request per tab.
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: allTabs.map((tab) => `'${tab}'!A1:Z1000`),
    });

    const students = [];
    const batches = [];
    (response.data.valueRanges || []).forEach((valueRange, i) => {
      const tab = allTabs[i];
      const rows = valueRange.values || [];
      const header = rows[0] || [];
      if (!looksLikeBatchTab(header)) return;

      batches.push(tab.trim());
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

    return NextResponse.json({ students, batches });
  } catch (error) {
    console.error('Error fetching paid students:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch paid students' },
      { status: 500 }
    );
  }
}
