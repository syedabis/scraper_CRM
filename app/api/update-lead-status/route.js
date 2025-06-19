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
    case 'Demo':
      return { red: 0.3, green: 0.2, blue: 0.8 }; // Indigo
    case 'Form Filled':
      return { red: 0.2, green: 0.5, blue: 0.5 }; // Teal
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
  'Paid',
  'Demo',
  'Form Filled'
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
    const { rowIndex, status, owner, timeSlot, notes } = await request.json();
    console.log('Received update request:', { rowIndex, status, owner, timeSlot, notes });

    // Get current time for logging and time slot updates
    const currentTime = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    });

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

    // Determine which time slot column to update
    let timeSlotColumn = '';
    if (timeSlot && timeSlot.includes('Slot 1')) {
      timeSlotColumn = 'G'; // Column G for Slot 1 (9:00 AM - 11:00 AM)
    } else if (timeSlot && timeSlot.includes('Slot 2')) {
      timeSlotColumn = 'H'; // Column H for Slot 2 (11:00 AM - 1:00 PM)
    } else if (timeSlot && timeSlot.includes('Slot 3')) {
      timeSlotColumn = 'I'; // Column I for Slot 3 (1:00 PM - 4:00 PM)
    } else if (timeSlot && timeSlot.includes('Slot 4')) {
      timeSlotColumn = 'J'; // Column J for Slot 4 (4:00 PM - 9:00 AM)
    }

    // Update the status in column F (6th column)
    const updateRange = `${owner.toLowerCase()}!F${rowIndex}`;
    console.log('Updating status range:', updateRange);
    
    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: updateRange,
      valueInputOption: 'RAW',
      resource: {
        values: [[status]]
      }
    });

    console.log('Status update response:', updateResponse.data);

    // Update the corresponding time slot column with status and time
    if (timeSlotColumn) {
      const timeSlotRange = `${owner.toLowerCase()}!${timeSlotColumn}${rowIndex}`;
      const timeSlotValue = `${status} (${currentTime})`;
      
      console.log('Updating time slot range:', timeSlotRange, 'with value:', timeSlotValue);
      
      const timeSlotResponse = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: timeSlotRange,
        valueInputOption: 'RAW',
        resource: {
          values: [[timeSlotValue]]
        }
      });

      console.log('Time slot update response:', timeSlotResponse.data);
    }

    // Update Notes column (Column L) if notes are provided
    if (notes && notes.trim()) {
      try {
        const notesRange = `${owner.toLowerCase()}!L${rowIndex}`;
        console.log('Updating notes range:', notesRange, 'with value:', notes.trim());
        
        const notesResponse = await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: notesRange,
          valueInputOption: 'RAW',
          resource: {
            values: [[notes.trim()]]
          }
        });

        console.log('Notes update response:', notesResponse.data);
      } catch (error) {
        console.error('Error updating notes:', error);
        // Don't fail the entire request if notes update fails
      }
    }

    // Calculate and update the Number of Attempts column (Column K)
    try {
      // First, get the current row data to count existing attempts
      const rowRange = `${owner.toLowerCase()}!A${rowIndex}:K${rowIndex}`;
      const rowResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: rowRange,
      });

      const rowData = rowResponse.data.values?.[0] || [];
      
      // Count non-empty slot values (columns G, H, I, J - indices 6, 7, 8, 9)
      const slotValues = [
        rowData[6] || '', // Slot 1 (G)
        rowData[7] || '', // Slot 2 (H) 
        rowData[8] || '', // Slot 3 (I)
        rowData[9] || ''  // Slot 4 (J)
      ];
      
      const numberOfAttempts = slotValues.filter(v => v && v.trim() !== '').length;
      
      // Update the Number of Attempts column (Column K)
      const attemptsRange = `${owner.toLowerCase()}!K${rowIndex}`;
      console.log('Updating attempts range:', attemptsRange, 'with value:', numberOfAttempts);
      
      const attemptsResponse = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: attemptsRange,
        valueInputOption: 'RAW',
        resource: {
          values: [[numberOfAttempts]]
        }
      });

      console.log('Attempts update response:', attemptsResponse.data);
    } catch (error) {
      console.error('Error updating number of attempts:', error);
      // Don't fail the entire request if attempts update fails
    }

    console.log('Time slot for this call:', timeSlot);
    console.log('Current time:', currentTime);
    console.log('Client said (status):', status);

    return NextResponse.json({ 
      success: true, 
      timeSlot,
      currentTime,
      timeSlotColumn: timeSlotColumn || 'None',
      clientSaid: status
    });
  } catch (error) {
    console.error('Error updating lead status:', error);
    return NextResponse.json({ error: error.message || 'Failed to update status' }, { status: 500 });
  }
} 