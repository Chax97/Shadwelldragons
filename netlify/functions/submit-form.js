const { google } = require('googleapis');

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Parse form data
    const data = JSON.parse(event.body || '{}');
    
    // Get credentials from environment variables
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Authenticate with Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Append data to sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:G',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          new Date().toISOString(),
          data.name || '',
          data.email || '',
          data.phone || '',
          data.session || '',
          data.message || '',
          data.source || 'website'
        ]]
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Form submitted successfully!' })
    };

  } catch (error) {
    console.error('Error submitting form:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to submit form' })
    };
  }
};