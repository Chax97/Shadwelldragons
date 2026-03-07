const { google } = require('googleapis');

async function sendEmail(subject, html) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Shadwell Dragons <noreply@shadwelldragons.co.uk>',
      to: 'faisal.chaklader97@gmail.com',
      subject,
      html,
    }),
  });
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
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_CORPORATE;

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:I',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          new Date().toISOString(),
          data.name || '',
          data.company || '',
          data.email || '',
          data.phone || '',
          data.package || '',
          data.team_size || '',
          data.message || '',
          data.source || 'corporate-page'
        ]]
      }
    });

    const html = `
      <h2>New Corporate Enquiry</h2>
      <p><strong>Name:</strong> ${data.name || 'N/A'}</p>
      <p><strong>Company:</strong> ${data.company || 'N/A'}</p>
      <p><strong>Email:</strong> ${data.email || 'N/A'}</p>
      ${data.phone ? `<p><strong>Phone:</strong> ${data.phone}</p>` : ''}
      ${data.package ? `<p><strong>Package:</strong> ${data.package}</p>` : ''}
      ${data.team_size ? `<p><strong>Team Size:</strong> ${data.team_size}</p>` : ''}
      ${data.message ? `<p><strong>Message:</strong> ${data.message}</p>` : ''}
      <p><strong>Submitted:</strong> ${new Date().toLocaleString('en-GB')}</p>
    `;

    await sendEmail('New Corporate Enquiry', html);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Corporate enquiry submitted successfully!' })
    };

  } catch (error) {
    console.error('Error submitting corporate form:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to submit form' })
    };
  }
};
