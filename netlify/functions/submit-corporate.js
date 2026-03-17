const { google } = require('googleapis');

async function verifyTurnstile(token) {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: token }),
  });
  const data = await res.json();
  return data.success === true;
}

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

    if (data.website) {
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    const turnstileOk = await verifyTurnstile(data.turnstileToken || '');
    if (!turnstileOk) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Bot verification failed. Please try again.' }) };
    }

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

    await sendEmail('info@shadwelldragons.co.uk', 'New Corporate Enquiry', html, data.email);

    console.log('Confirmation email target:', data.email);
    if (data.email) {
      const confirmHtml = `
        <p>Hi ${data.name || 'there'},</p>
        <p>Thank you for your corporate enquiry with Shadwell Dragons. We've received your message and will be in touch shortly.</p>
        <p>If you have any further questions in the meantime, please feel free to contact us info@shadwelldragons.co.uk.</p>
        <br>
        <p>Best wishes,<br>Shadwell Dragons</p>
        <br>
        <img src="https://shadwelldragons.netlify.app/images/SD_Logo_Transparent.png" alt="Shadwell Dragons" width="120" style="display:block;">
      `;
      try {
        await sendEmail(data.email, 'Thank you for your corporate enquiry – Shadwell Dragons', confirmHtml);
      } catch (confirmErr) {
        console.error('Confirmation email failed:', confirmErr);
      }
    }

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
