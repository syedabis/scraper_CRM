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

export async function POST(request) {
  try {
    const data = await request.json();
    const { name, email, phoneNumber, countryCode, lead } = data;

    // Prepare the row data
    const rowData = [
      [
        new Date().toISOString(), // Timestamp
        name || '', // Name (optional)
        email || '', // Email (optional)
        `${countryCode}${phoneNumber}`, // Full phone number
      ],
    ];

    // Append the data to the lead owner's sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${lead}!A:D`, // Use lead owner's name as sheet name
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rowData,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error submitting to Google Sheets:', error);
    return NextResponse.json(
      { error: 'Failed to submit data' },
      { status: 500 }
    );
  }
} 