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
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

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
          data.email || '',
          data.phone || '',
          data.session || '',
          data.message || '',
          data.source || 'website'
        ]]
      }
    });

    const isContact = data.source === 'website-contact';
    const subject = isContact ? 'New Contact Enquiry' : 'New Booking Enquiry';
    const html = `
      <h2>${subject}</h2>
      <p><strong>Name:</strong> ${data.name || 'N/A'}</p>
      <p><strong>Email:</strong> ${data.email || 'N/A'}</p>
      ${data.phone ? `<p><strong>Phone:</strong> ${data.phone}</p>` : ''}
      ${data.session ? `<p><strong>Session:</strong> ${data.session}</p>` : ''}
      ${data.message ? `<p><strong>Message:</strong> ${data.message}</p>` : ''}
      <p><strong>Source:</strong> ${data.source || 'website'}</p>
      <p><strong>Submitted:</strong> ${new Date().toLocaleString('en-GB')}</p>
    `;

    await sendEmail(subject, html);

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