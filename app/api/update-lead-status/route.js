import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const getStatusColor = (status) => {
  switch (status) {
    case 'Call Received':
      return { red: 0.2, green: 0.8, blue: 0.2 }; // Green
    case 'Not Received':
      return { red: 0.8, green: 0.2, blue: 0.2 }; // Red
    case 'Call Later':
      return { red: 0.8, green: 0.8, blue: 0.2 }; // Yellow
    case 'Client Lost':
      return { red: 0.5, green: 0.5, blue: 0.5 }; // Gray
    case 'Confirmation':
      return { red: 0.2, green: 0.2, blue: 0.8 }; // Blue
    case 'Paid':
      return { red: 0.5, green: 0.2, blue: 0.8 }; // Purple
    default:
      return { red: 1, green: 1, blue: 1 }; // White
  }
};

const VALID_STATUSES = [
  'Call Received',
  'Not Received',
  'Call Later',
  'Client Lost',
  'Confirmation',
  'Paid'
];

// Cache for sheet IDs
let sheetIdCache = {};

// Helper function to get sheet ID
async function getSheetId(sheetName) {
  try {
    // Check cache first
    if (sheetIdCache[sheetName.toLowerCase()]) {
      return sheetIdCache[sheetName.toLowerCase()];
    }

    const response = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
    });
    
    if (!response.data.sheets) {
      throw new Error('No sheets found in the spreadsheet');
    }

    const sheet = response.data.sheets.find(s => 
      s.properties.title.toLowerCase() === sheetName.toLowerCase()
    );
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in the spreadsheet`);
    }

    // Cache the sheet ID using lowercase name
    sheetIdCache[sheetName.toLowerCase()] = sheet.properties.sheetId;
    return sheet.properties.sheetId;
  } catch (error) {
    console.error('Error getting sheet ID:', error);
    throw new Error(`Failed to get sheet ID for "${sheetName}": ${error.message}`);
  }
}

export async function POST(request) {
  try {
    const { rowIndex, status, owner } = await request.json();
    console.log('Received update request:', { rowIndex, status, owner });

    // Validate required fields
    if (rowIndex === undefined || rowIndex === null) {
      console.error('Row index is missing');
      return NextResponse.json({ error: 'Row index is required' }, { status: 400 });
    }

    if (!status) {
      console.error('Status is missing');
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    if (!owner) {
      console.error('Owner is missing');
      return NextResponse.json({ error: 'Owner is required' }, { status: 400 });
    }

    // Validate status values
    if (!VALID_STATUSES.includes(status)) {
      console.error('Invalid status:', status);
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    // Get the spreadsheet ID from environment variable
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.error('Spreadsheet ID not configured');
      return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 });
    }

    // Get sheet ID first
    let sheetId;
    try {
      sheetId = await getSheetId(owner);
    } catch (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    // Update the status in column F (6th column)
    const updateRange = `${owner.toLowerCase()}!F${rowIndex}`; // No need to add 1 since rowIndex is already correct
    console.log('Updating range:', updateRange);
    
    // Update only the value, don't touch formatting or validation
    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: updateRange,
      valueInputOption: 'RAW',
      resource: {
        values: [[status]]
      }
    });

    console.log('Update response:', updateResponse.data);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating lead status:', error);
    return NextResponse.json({ error: error.message || 'Failed to update status' }, { status: 500 });
  }
} 