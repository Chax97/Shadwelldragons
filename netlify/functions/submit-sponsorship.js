const { google } = require('googleapis');

async function sendEmail(subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: 'info@shadwelldragons.co.uk',
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body || '{}');

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_SPONSORSHIP;

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:G',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          new Date().toISOString(),
          data.name || '',
          data.company || '',
          data.email || '',
          data.level || '',
          data.message || '',
          data.source || 'sponsorship-page'
        ]]
      }
    });

    const html = `
      <h2>New Sponsorship Enquiry</h2>
      <p><strong>Name:</strong> ${data.name || 'N/A'}</p>
      <p><strong>Company:</strong> ${data.company || 'N/A'}</p>
      <p><strong>Email:</strong> ${data.email || 'N/A'}</p>
      ${data.level ? `<p><strong>Sponsorship Level:</strong> ${data.level}</p>` : ''}
      ${data.message ? `<p><strong>Message:</strong> ${data.message}</p>` : ''}
      <p><strong>Submitted:</strong> ${new Date().toLocaleString('en-GB')}</p>
    `;

    await sendEmail('New Sponsorship Enquiry', html);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Sponsorship enquiry submitted successfully!' })
    };

  } catch (error) {
    console.error('Error submitting sponsorship form:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to submit form' })
    };
  }
};