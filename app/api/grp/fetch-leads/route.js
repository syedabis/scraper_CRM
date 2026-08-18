import { google } from 'googleapis';
import { NextResponse } from 'next/server';

// GRP Leads live in a completely separate Google Spreadsheet. The service
// account that owns the main sheet also needs Editor access to this one —
// share the sheet with sales-portal@sales-crm-datacrumbs.iam.gserviceaccount.com.
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// EP-44 has 4 columns: A=Name, B=Phone, C=Stage, D=Notes.
// Returns: [rowNum, name, phone, stage, notes] for each data row.
export async function GET() {
  try {
    const spreadsheetId = process.env.GRP_SHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'GRP Spreadsheet ID not configured — add GRP_SHEET_ID to env vars' },
        { status: 500 }
      );
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'EP-44!A:D',
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return NextResponse.json([]);

    // Skip header row (row 1), prepend the 1-based sheet row number so the
    // mobile can write updates back to the exact right row.
    const leadsWithRowNumbers = rows
      .slice(1)
      .map((row, index) => {
        const paddedRow = [...row];
        while (paddedRow.length < 4) paddedRow.push('');
        // [rowNum, name, phone, stage, notes]
        return [index + 2, paddedRow[0], paddedRow[1], paddedRow[2], paddedRow[3]];
      })
      // Only rows that have a name or a phone number are real leads.
      .filter((row) => (row[1] || row[2] || '').toString().trim() !== '');

    return NextResponse.json(leadsWithRowNumbers);
  } catch (error) {
    console.error('Error fetching GRP leads:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch GRP leads' },
      { status: 500 }
    );
  }
}
