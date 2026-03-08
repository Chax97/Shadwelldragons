const { google } = require('googleapis');

async function sendEmail(to, subject, html, replyTo) {
  const body = {
    from: 'noreply@shadwelldragons.com',
    to,
    subject,
    html,
  };
  if (replyTo) body.reply_to = replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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

    // Notify the team, with reply-to set to the submitter
    await sendEmail('faisal.chaklader97@gmail.com', subject, html, data.email);

    // Send confirmation to the submitter
    console.log('Confirmation email target:', data.email);
    if (data.email) {
      const confirmHtml = `
        <p>Hi ${data.name || 'there'},</p>
        <p>Thanks for getting in touch! We've received your message and will get back to you shortly.</p>
        <p>If you have any further questions in the meantime, please feel free to contact us info@shadwelldragons.co.uk.</p>
        <p>If you've signed up for the free taster session, please fill out this form before your first session: http://bit.ly/40RdL92</p>
        <br>
        <p>Best wishes,<br>Shadwell Dragons</p>
        <br>
        <img src="https://www.shadwelldragons.co.uk/images/SD_Logo_Transparent.png" alt="Shadwell Dragons" width="120" style="display:block;">
      `;
      try {
        await sendEmail(data.email, 'Thanks for contacting Shadwell Dragons', confirmHtml);
      } catch (confirmErr) {
        console.error('Confirmation email failed:', confirmErr);
      }
    }

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