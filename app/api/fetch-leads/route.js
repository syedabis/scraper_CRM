import { google } from 'googleapis';
import { NextResponse } from 'next/server';

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sheetName = searchParams.get('sheetName');

    if (!sheetName) {
      return NextResponse.json({ error: 'Sheet name is required' }, { status: 400 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:R`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return NextResponse.json([]);
    }

    // Skip header row and include row numbers in the data
    const leadsWithRowNumbers = rows
      .slice(1)
      .map((row, index) => {
        // Pad the row to at least 18 columns (A-R) — R holds the combined,
        // comma-separated Slot 1-4 summary used by the Leads by Attempts card.
        const paddedRow = [...row];
        while (paddedRow.length < 18) {
          paddedRow.push('');
        }

        // Add row number as the first element, then padded row
        return [index + 2, ...paddedRow];
      })
      // A row can have data in column R (e.g. a formula like
      // "=CONCATENATE(G,H,I,J)" filled down far past the real data,
      // producing just ",,," for otherwise-empty rows) without being a real
      // lead. Only count rows that actually have a date, name, or status.
      .filter((row) => (row[1] || row[3] || row[6] || '').toString().trim() !== '');

    return NextResponse.json(leadsWithRowNumbers);
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch leads' }, { status: 500 });
  }
} 