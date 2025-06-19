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
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return NextResponse.json([]);
    }

    // Skip header row and include row numbers in the data
    const leadsWithRowNumbers = rows.slice(1).map((row, index) => {
      // Pad the row to at least 10 columns (A-J)
      const paddedRow = [...row];
      while (paddedRow.length < 10) {
        paddedRow.push('');
      }
      // Count non-empty slot columns (Slot 1: G, Slot 2: H, Slot 3: I, Slot 4: J)
      const slotValues = [paddedRow[6], paddedRow[7], paddedRow[8], paddedRow[9]];
      const numberOfAttempts = slotValues.filter(v => v && v.trim() !== '').length;
      // Add row number as the first element, then padded row, then number of attempts
      return [index + 2, ...paddedRow, numberOfAttempts];
    });

    return NextResponse.json(leadsWithRowNumbers);
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch leads' }, { status: 500 });
  }
} 