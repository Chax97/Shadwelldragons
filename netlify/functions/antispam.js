// Shared anti-spam helpers for the form submission functions.
//
// Turnstile already rejects forged tokens, but solver services defeat it, so
// these checks work on the submission itself rather than on proof of a browser.

// Minimum time a genuine person needs to fill in a form, in milliseconds.
const MIN_FILL_MS = 3000;

// Reject a form that was rendered implausibly long ago; the timestamp is
// client-supplied, so this only bounds how stale a replayed value can be.
const MAX_FORM_AGE_MS = 12 * 60 * 60 * 1000;

// Per-IP limits, and a global ceiling so a distributed run still gets capped.
// The per-IP cap is deliberately tight; note that visitors behind shared or
// carrier-grade NAT (an office, a school, mobile data) share one address.
const IP_LIMIT = 2;
const IP_WINDOW_MS = 24 * 60 * 60 * 1000;
const GLOBAL_LIMIT = 40;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;

// Lambda containers are reused between invocations, so this survives across
// requests that land on the same warm instance. It is not shared between
// concurrent containers, which makes the limits a best-effort ceiling rather
// than an exact quota - enough to blunt a sustained run.
const hits = new Map();

function prune(list, windowMs, now) {
  return list.filter((ts) => now - ts < windowMs);
}

function tooMany(key, limit, windowMs, now) {
  const seen = prune(hits.get(key) || [], windowMs, now);
  seen.push(now);
  hits.set(key, seen);
  return seen.length > limit;
}

function clientIp(event) {
  const headers = event.headers || {};
  const forwarded = headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || '';
  return forwarded.split(',')[0].trim() || 'unknown';
}

// Returns a handler response to return early, or null to continue.
function checkSubmission(event, data) {
  const now = Date.now();

  // 5. Honeypot. The field is hidden with CSS, so a person never fills it in.
  if (data.website) {
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  // 4. Time-to-submit. A missing or unparseable timestamp is treated as a
  // failure: every current form sends one, so its absence means the submission
  // did not come from the live form.
  const renderedAt = Number(data.formRenderedAt);
  if (!Number.isFinite(renderedAt) || renderedAt <= 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid submission. Please reload the page and try again.' }) };
  }
  const elapsed = now - renderedAt;
  if (elapsed < MIN_FILL_MS || elapsed > MAX_FORM_AGE_MS) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid submission. Please reload the page and try again.' }) };
  }

  // 3. Rate limiting, per IP and overall.
  const ip = clientIp(event);
  if (tooMany(`ip:${ip}`, IP_LIMIT, IP_WINDOW_MS, now)) {
    return {
      statusCode: 429,
      body: JSON.stringify({
        error: 'You have reached the submission limit for today. Please email us at info@shadwelldragons.co.uk and we will get straight back to you.',
      }),
    };
  }
  if (tooMany('global', GLOBAL_LIMIT, GLOBAL_WINDOW_MS, now)) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Too many submissions. Please try again later.' }) };
  }

  return null;
}

module.exports = { checkSubmission };
