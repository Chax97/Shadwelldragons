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

// Content scoring. Each signal adds one point; a submission scoring at or
// above this threshold is flagged - recorded in the sheet with a marker, but
// no notification or confirmation email is sent. Needing two signals keeps a
// real person with one unusual detail (a dotted email, an unusual name) safe.
const CONTENT_SCORE_THRESHOLD = 2;

// Tor exit list. Every spam submission observed so far arrived from a Tor
// exit node, which is also why per-IP rate limiting did nothing: each one
// used a different exit. The list is fetched once per container and reused.
const TOR_LIST_URL = 'https://check.torproject.org/torbulkexitlist';
const TOR_CACHE_MS = 6 * 60 * 60 * 1000;
const TOR_FETCH_TIMEOUT_MS = 3000;
let torCache = { ips: null, fetchedAt: 0 };

// Lambda containers are reused between invocations, so this survives across
// requests that land on the same warm instance. It is not shared between
// concurrent containers, which makes the limits a best-effort ceiling rather
// than an exact quota - enough to blunt a sustained run.
const hits = new Map();

// Resolves to a Set of exit-node addresses, or null if the list is
// unavailable. Never throws: if the fetch fails the caller simply skips the
// Tor check rather than turning a list outage into a broken contact form.
async function getTorExitIps() {
  const now = Date.now();
  if (torCache.ips && now - torCache.fetchedAt < TOR_CACHE_MS) {
    return torCache.ips;
  }
  try {
    const res = await fetch(TOR_LIST_URL, {
      signal: AbortSignal.timeout(TOR_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const text = await res.text();
    const ips = new Set(
      text.split('\n').map((line) => line.trim()).filter(Boolean)
    );
    if (!ips.size) throw new Error('empty list');
    torCache = { ips, fetchedAt: now };
    return ips;
  } catch (err) {
    console.error('Tor exit list unavailable:', err.message);
    // Serve a stale list if we have one; otherwise skip the check.
    return torCache.ips;
  }
}

// Call before checkSubmission. Returns true when the request came from a
// known Tor exit node.
async function isTorExit(event) {
  const ips = await getTorExitIps();
  if (!ips) return false;
  return ips.has(clientIp(event));
}

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

// Gmail ignores dots, so bots scatter them through an address to reach a real
// inbox while looking unique. Real addresses rarely have more than two.
function isDottedGmail(email) {
  const match = String(email || '').toLowerCase().match(/^([^@]+)@(gmail|googlemail)\.com$/);
  if (!match) return false;
  const local = match[1].split('+')[0];
  const dots = (local.match(/\./g) || []).length;
  return dots >= 3;
}

// A word with four or more consonants in a row, e.g. "Mzzlkb" or "Hfxhpy".
// Y counts as a vowel so real names like "Glynn" and "Lynch" are not caught.
//
// A vowel-ratio test was tried here and removed: short real surnames score
// identically to the junk ones ("John" and "Azkh" are both 0.25), so it
// flagged Smith, Wong and Jenkins without catching anything extra.
function looksLikeGibberishName(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return words.some((w) => /[bcdfghjklmnpqrstvwxz]{4,}/i.test(w.replace(/[^a-z]/gi, '')));
}

// A single token with no spaces and frequent case flips, e.g. "RuEmsCF" or
// "MBlVLGbRaDjduGvYueyIu". Real messages contain spaces; bare links are left
// alone. The 6-letter floor matches the short junk strings seen in practice.
function looksLikeGibberishMessage(message) {
  const text = String(message || '').trim();
  if (/\s/.test(text) || /^https?:\/\//i.test(text)) return false;
  const letters = text.replace(/[^a-z]/gi, '');
  if (letters.length < 6) return false;
  let flips = 0;
  for (let i = 1; i < letters.length; i++) {
    const prevUpper = letters[i - 1] === letters[i - 1].toUpperCase();
    const currUpper = letters[i] === letters[i].toUpperCase();
    if (prevUpper !== currUpper) flips++;
  }
  return flips / letters.length > 0.3;
}

function contentScore(data) {
  const reasons = [];
  if (isDottedGmail(data.email)) reasons.push('dotted gmail');
  if (looksLikeGibberishName(data.name)) reasons.push('gibberish name');
  if (looksLikeGibberishMessage(data.message)) reasons.push('gibberish message');
  return { score: reasons.length, reasons };
}

// Returns { reject } to stop the request, or { flagged, reasons } to continue.
// A flagged submission is still recorded, so a wrongly flagged enquiry is
// recoverable from the sheet rather than lost silently.
function checkSubmission(event, data) {
  const now = Date.now();

  // 5. Honeypot. The field is hidden with CSS, so a person never fills it in.
  if (data.website) {
    return { reject: { statusCode: 200, body: JSON.stringify({ success: true }) } };
  }

  // 4. Time-to-submit. A missing or unparseable timestamp is treated as a
  // failure: every current form sends one, so its absence means the submission
  // did not come from the live form.
  const renderedAt = Number(data.formRenderedAt);
  if (!Number.isFinite(renderedAt) || renderedAt <= 0) {
    return { reject: { statusCode: 400, body: JSON.stringify({ error: 'Invalid submission. Please reload the page and try again.' }) } };
  }
  const elapsed = now - renderedAt;
  if (elapsed < MIN_FILL_MS || elapsed > MAX_FORM_AGE_MS) {
    return { reject: { statusCode: 400, body: JSON.stringify({ error: 'Invalid submission. Please reload the page and try again.' }) } };
  }

  // 3. Rate limiting, per IP and overall.
  const ip = clientIp(event);
  if (tooMany(`ip:${ip}`, IP_LIMIT, IP_WINDOW_MS, now)) {
    return {
      reject: {
        statusCode: 429,
        body: JSON.stringify({
          error: 'You have reached the submission limit for today. Please email us at info@shadwelldragons.co.uk and we will get straight back to you.',
        }),
      },
    };
  }
  if (tooMany('global', GLOBAL_LIMIT, GLOBAL_WINDOW_MS, now)) {
    return { reject: { statusCode: 429, body: JSON.stringify({ error: 'Too many submissions. Please try again later.' }) } };
  }

  // Content pattern check. Flagged submissions are recorded but generate no
  // email, so junk stops reaching the inbox while nothing is silently lost.
  //
  // A gibberish message is decisive on its own: against the observed spam it
  // matched 6 of 7 junk messages and none of the genuine ones, because a real
  // enquiry always contains a space. The weaker name and email signals still
  // need to appear together.
  const { score, reasons } = contentScore(data);
  if (reasons.includes('gibberish message') || score >= CONTENT_SCORE_THRESHOLD) {
    console.log('Flagged by content check', { ip, reasons, name: data.name, email: data.email });
    return { flagged: true, reasons };
  }

  return { flagged: false, reasons: [] };
}

module.exports = { checkSubmission, contentScore, isTorExit };
