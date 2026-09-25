const { google } = require('googleapis');
const { checkSubmission, isTorExit } = require('./antispam');

// Escape user input before putting it into email HTML
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function getClientIp(event) {
  const h = event.headers || {};
  return (
    h['x-nf-client-connection-ip'] ||
    (h['x-forwarded-for'] || '').split(',')[0].trim() ||
    'unknown'
  );
}

async function verifyTurnstile(token, ip) {
  const payload = { secret: process.env.TURNSTILE_SECRET_KEY, response: token };
  if (ip && ip !== 'unknown') payload.remoteip = ip;

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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

  const ip = getClientIp(event);
  const userAgent = (event.headers && event.headers['user-agent']) || '';
  const submittedAt = new Date().toISOString();

  try {
    const data = JSON.parse(event.body || '{}');

    console.log('Form submission', {
      ip,
      userAgent,
      submittedAt,
      email: data.email,
      name: data.name,
      source: data.source,
    });

    const { reject, flagged, reasons } = checkSubmission(event, data);
    if (reject) {
      console.log('Rejected by antispam', { ip, email: data.email });
      return reject;
    }

    // Tor is flagged rather than rejected: it is a strong spam signal here,
    // but a legitimate visitor using it for privacy still reaches the sheet.
    const viaTor = await isTorExit(event);
    const allReasons = viaTor ? [...reasons, 'tor exit node'] : reasons;
    const isFlagged = flagged || viaTor;
    if (viaTor) console.log('Tor exit node', { ip, email: data.email });

    const turnstileOk = await verifyTurnstile(data.turnstileToken || '', ip);
    if (!turnstileOk) {
      console.log('Turnstile failed', { ip, email: data.email });
      return { statusCode: 400, body: JSON.stringify({ error: 'Bot verification failed. Please try again.' }) };
    }

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:J',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          submittedAt,
          data.name || '',
          data.email || '',
          data.phone || '',
          data.referral_source || '',
          data.message || '',
          data.source || 'website',
          ip,
          userAgent,
          isFlagged ? `SUSPECTED_SPAM: ${allReasons.join(', ')}` : ''
        ]]
      }
    });

    // A flagged submission is kept in the sheet but generates no email, so a
    // wrongly flagged enquiry can still be found and answered by hand.
    if (isFlagged) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Form submitted successfully!' })
      };
    }

    const isContact = data.source === 'website-contact';
    const subject = isContact ? 'New Contact Enquiry' : 'New Booking Enquiry';
    const html = `
      <h2>${subject}</h2>
      <p><strong>Name:</strong> ${esc(data.name) || 'N/A'}</p>
      <p><strong>Email:</strong> ${esc(data.email) || 'N/A'}</p>
      ${data.phone ? `<p><strong>Phone:</strong> ${esc(data.phone)}</p>` : ''}
      ${data.referral_source ? `<p><strong>Heard About Us:</strong> ${esc(data.referral_source)}</p>` : ''}
      ${data.message ? `<p><strong>Message:</strong> ${esc(data.message)}</p>` : ''}
      <p><strong>Source:</strong> ${esc(data.source || 'website')}</p>
      <p><strong>Submitted:</strong> ${new Date(submittedAt).toLocaleString('en-GB')}</p>
      <p style="color:#888;font-size:12px;"><strong>IP:</strong> ${esc(ip)}</p>
    `;

    // Notify the team, with reply-to set to the submitter
    await sendEmail('info@shadwelldragons.co.uk', subject, html, data.email);

    // Send confirmation to the submitter
    console.log('Confirmation email target:', data.email, 'from IP:', ip);
    if (data.email) {
      const confirmHtml = `
        <p>Hi ${esc(data.name) || 'there'},</p>
        <p>Thanks for getting in touch! We've received your message and will get back to you shortly.</p>
        <p>If you have any further questions in the meantime, please feel free to contact us info@shadwelldragons.com</p>
        <p>If you've signed up for the free taster session, please fill out this form before your first session: http://bit.ly/40RdL92</p>
        <br>
        <p>Best wishes,<br>Shadwell Dragons</p>
        <br>
        <img src="https://shadwelldragons.netlify.app/images/SD_Logo_Colour.png" alt="Shadwell Dragons" width="120" style="display:block;">
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
    console.error('Error submitting form:', { ip, message: error.message });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to submit form' })
    };
  }
};