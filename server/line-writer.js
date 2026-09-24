// Overridable so the reply payload can be inspected against a local stand-in;
// nothing but a test ever sets it.
const LINE_API = process.env.LINE_API_BASE || 'https://api.line.me';

// Apps Script Web Apps answer a POST with a 302 to googleusercontent and
// occasionally lose one on the way — a 404 or a 5xx that the identical next
// request answers normally. One dropped call costs a recorded expense, so a
// transport-level failure is retried; a refusal from the script itself
// (`ok: false`, e.g. "already confirmed") is an answer and is not.
async function postToAppsScript(payload, attempts = 3) {
  const url = process.env.APPS_SCRIPT_URL;
  const token = process.env.APPS_SCRIPT_TOKEN;
  if (!url || !token) {
    throw new Error('Missing APPS_SCRIPT_URL or APPS_SCRIPT_TOKEN. See server/README.md.');
  }

  let lastError = '';
  for (let i = 0; i < attempts; i += 1) {
    if (i) await new Promise((r) => setTimeout(r, 400 * i));
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...payload }),
      });
    } catch (err) {
      lastError = err.message;
      continue;
    }

    const body = await res.json().catch(() => ({}));
    // The script answered and said no. Retrying cannot change that, and on a
    // confirm it would risk booking the same row twice.
    if (body.ok === false) throw new Error(body.error || 'Apps Script refused the write');
    if (res.ok) return body;

    lastError = `Apps Script responded ${res.status}`;
    console.error(`apps-script: ${lastError} (attempt ${i + 1}/${attempts})`);
  }
  throw new Error(lastError);
}

// Posts inbox rows through the Apps Script Web App, the same write path the
// DCA scores use — the Sheets API key is read-only.

export async function writeInboxRows(rows) {
  const body = await postToAppsScript({ kind: 'inbox', rows });
  return body.ids ?? [];
}

// Confirm moves a reviewed row into 04_TRANSACTIONS; reject marks it and
// leaves the ledger alone. Both go through Apps Script for the same reason
// the inbox write does — the Sheets API key cannot write.
export async function reviewInboxRow(inboxId, action, accounts = {}) {
  return postToAppsScript({
    kind: action === 'confirm' ? 'inbox-confirm' : 'inbox-reject',
    inboxId,
    sourceAccount: accounts.source || '',
    destAccount: accounts.destination || '',
  });
}

// Who sent the message a reply token answers, kept briefly. Used only when
// the reply itself is refused — see replyToLine.
const senders = new Map();
const SENDER_TTL_MS = 10 * 60 * 1000;

export function rememberSender(replyToken, userId) {
  if (!replyToken || !userId) return;
  senders.set(replyToken, userId);
  const t = setTimeout(() => senders.delete(replyToken), SENDER_TTL_MS);
  t.unref?.();
}

async function linePost(path, payload) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  return fetch(`${LINE_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

// `body` is a string for a plain answer, a built message object for a card,
// or an array of either to send several in the one reply — a reply token is
// single-use, so a second reply on the same token is always refused.
//
// A reply token lasts about a minute. When the server was asleep and LINE
// redelivers the message later, the token has expired and the reply is
// refused; the answer then goes out as a push to the sender instead, so the
// message is still answered rather than silently dropped.
export async function replyToLine(replyToken, body, quickReply = null) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !replyToken) return false;

  const messages = (Array.isArray(body) ? body : [body]).map((b) =>
    typeof b === 'string' ? { type: 'text', text: b } : { ...b }
  );
  // Quick replies belong on the last message, where LINE shows them.
  if (quickReply) messages[messages.length - 1].quickReply = quickReply;

  const res = await linePost('/v2/bot/message/reply', { replyToken, messages });
  if (res.ok) return true;

  const detail = await res.text().catch(() => '');
  const to = senders.get(replyToken);
  if (res.status === 400 && to) {
    const pushed = await linePost('/v2/bot/message/push', { to, messages });
    if (pushed.ok) {
      console.log('line reply expired; answered by push instead');
      return true;
    }
    console.error('line push fallback failed', pushed.status, await pushed.text().catch(() => ''));
    return false;
  }
  console.error('line reply failed', res.status, detail);
  return false;
}

// Broadcast reaches every friend of the bot. For a personal account that is
// the owner and nobody else, which avoids having to store a user id anywhere.
export async function broadcastToLine(text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set.');

  const res = await fetch(`${LINE_API}/v2/bot/message/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: [{ type: 'text', text }] }),
  });
  if (!res.ok) {
    throw new Error(`LINE broadcast responded ${res.status}`);
  }
  return true;
}
