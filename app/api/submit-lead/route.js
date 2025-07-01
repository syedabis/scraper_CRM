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

async function getNextProspectNumber(sheetName) {
  try {
    // Get all values from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!C:C`, // Get all values from column C (name column)
    });

    const values = response.data.values || [];
    let maxNumber = 0;

    // Find the highest prospect number
    values.forEach(row => {
      if (row[0] && row[0].startsWith('prospect_')) {
        const number = parseInt(row[0].split('_')[1]);
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    });

    return maxNumber + 1;
  } catch (error) {
    console.error('Error getting next prospect number:', error);
    return 1; // Default to 1 if there's an error
  }
}

function getPakistanDateTime() {
  const date = new Date().toLocaleString('en-PK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Karachi'
  });

  const time = new Date().toLocaleString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi'
  });

  return { date, time };
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { name, email, phoneNumber, countryCode, lead } = data;

    // Generate prospect name if no name is provided
    let finalName = name;
    if (!name || name.trim() === '') {
      const nextNumber = await getNextProspectNumber(lead);
      finalName = `prospect_${nextNumber}`;
    }

    const { date, time } = getPakistanDateTime();

    // Prepare the row data
    const rowData = [
      [
        date, // Date column
        time, // Time column
        finalName, // Name (or generated prospect name)
        email || '', // Email (optional)
        `${countryCode}${phoneNumber}`, // Full phone number
        '', // Status column (F) - empty initially
        '', // Slot 1 (G) - 9:00 AM - 11:00 AM - empty initially
        '', // Slot 2 (H) - 11:00 AM - 1:00 PM - empty initially
        '', // Slot 3 (I) - 1:00 PM - 4:00 PM - empty initially
        '', // Slot 4 (J) - 4:00 PM - 9:00 AM - empty initially
        0,  // Number of Attempts (K) - 0 initially
        '', // Notes (L) - empty initially
      ],
    ];

    // Append the data to the lead owner's sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${lead}!A:L`, // Updated range to include Notes column
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