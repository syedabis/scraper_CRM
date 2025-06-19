import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export async function POST(request) {
  try {
    const { rowIndex, owner, name, email, phone } = await request.json();

    if (!rowIndex || !owner || !name || !email || !phone) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Update the specific cells for the lead information
    // Column C (index 2) = Name, Column D (index 3) = Email, Column E (index 4) = Phone
    const range = `${owner}!C${rowIndex}:E${rowIndex}`;
    
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[name, email, phone]]
      },
    });

    console.log('Lead information updated successfully:', response.data);

    return Response.json({ 
      success: true, 
      message: 'Lead information updated successfully',
      updatedCells: response.data.updatedCells 
    });

  } catch (error) {
    console.error('Error updating lead information:', error);
    return Response.json({ 
      error: 'Failed to update lead information',
      details: error.message 
    }, { status: 500 });
  }
} 