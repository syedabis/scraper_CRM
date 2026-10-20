import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { splitSlotEntries } from '../../lib/pendingConfirmations';
import { sendMetaCapiEvent } from '../../lib/metaCapi';

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
  'New Lead',
  'Connected',
  'No Answer',
  'Follow Up',
  'Registration',
  'Payment Pending (Confirmation)',
  'Demo',
  'Enrolled',
  'Lost'
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
    const { rowIndex, status, owner, timeSlot, notes, statusDate } = await request.json();
    console.log('Received update request:', { rowIndex, status, owner, timeSlot, notes, statusDate });

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

    // Enrolled / Payment Pending (Confirmation) require a mandatory date, recorded in column N
    if ((status === 'Enrolled' || status === 'Payment Pending (Confirmation)') && !statusDate) {
      console.error('Status date is missing for status:', status);
      return NextResponse.json({ error: 'A date is required for Enrolled/Payment Pending (Confirmation)' }, { status: 400 });
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

    // Fetch the row's current slot values up front — needed both to append
    // to (rather than overwrite) a reused time-slot cell, and to recompute
    // Number of Attempts from the true entry count across all 4 slots below.
    const SLOT_COLUMN_TO_INDEX = { G: 6, H: 7, I: 8, J: 9 }; // within A:K
    const rowRange = `${owner.toLowerCase()}!A${rowIndex}:S${rowIndex}`;
    const rowResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rowRange,
    });
    const rowData = rowResponse.data.values?.[0] || [];

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

    // Update the corresponding time slot column with status and time. A
    // slot is a fixed time-of-day window, not an attempt number — if this
    // lead was already called during this same window before, append the
    // new entry instead of overwriting and silently destroying the earlier
    // call's record.
    let newSlotValue = null;
    if (timeSlotColumn) {
      const existingSlotValue = (rowData[SLOT_COLUMN_TO_INDEX[timeSlotColumn]] || '').toString().trim();
      const entry = `${status} (${currentTime})`;
      newSlotValue = existingSlotValue ? `${existingSlotValue},${entry}` : entry;

      const timeSlotRange = `${owner.toLowerCase()}!${timeSlotColumn}${rowIndex}`;
      console.log('Updating time slot range:', timeSlotRange, 'with value:', newSlotValue);

      const timeSlotResponse = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: timeSlotRange,
        valueInputOption: 'RAW',
        resource: {
          values: [[newSlotValue]]
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

    // Update the Confirmation Date column (Column N). Confirmation writes the
    // promised date as-is; Paid closes out any pending confirmation by
    // overwriting it with "Closed (date)" instead.
    if (statusDate) {
      try {
        const statusDateRange = `${owner.toLowerCase()}!N${rowIndex}`;
        const statusDateValue = status === 'Enrolled' ? `Closed (${statusDate})` : statusDate;
        console.log('Updating status date range:', statusDateRange, 'with value:', statusDateValue);

        const statusDateResponse = await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: statusDateRange,
          valueInputOption: 'RAW',
          resource: {
            values: [[statusDateValue]]
          }
        });

        console.log('Status date update response:', statusDateResponse.data);
      } catch (error) {
        console.error('Error updating status date:', error);
        // Don't fail the entire request if the status date update fails
      }
    }

    // Calculate and update the Number of Attempts column (Column K). Slots
    // G-J are time-of-day windows, not attempt numbers, and a window can now
    // hold more than one comma-separated entry once it's been reused — so
    // the true attempt count is the total number of entries across all 4
    // slots (using rowData fetched above, plus the slot we just wrote),
    // not just how many of the 4 cells are non-empty.
    try {
      const slotValues = ['G', 'H', 'I', 'J'].map((col) =>
        col === timeSlotColumn ? newSlotValue : (rowData[SLOT_COLUMN_TO_INDEX[col]] || '')
      );

      const numberOfAttempts = slotValues.reduce((sum, val) => sum + splitSlotEntries(val).length, 0);

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

    // Asynchronously dispatch to Meta Conversions API for milestones (Demo, Registration, Payment Pending, Enrolled)
    // Only leads with Column M === 'A' are pushed to Meta CAPI
    const isAdLead = (rowData[12] || '').toString().trim().toUpperCase() === 'A';
    if (isAdLead) {
      sendMetaCapiEvent({
        status,
        previousStatus: rowData[5] || '',
        phone: rowData[4] || '',
        email: rowData[3] || '',
        leadDate: rowData[0] || '',
        owner,
        sheets,
        spreadsheetId,
        rowIndex,
      }).catch((capiErr) => console.error('[Meta CAPI] Background error in update-lead-status:', capiErr));
    } else {
      console.log(`[Meta CAPI] Skipped: Lead at row ${rowIndex} has Column M = '${rowData[12] || 'empty'}'. Only 'A' is sent to Meta.`);
    }

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