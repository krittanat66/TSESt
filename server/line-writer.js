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

// LINE's reply token is single-use and expires in about a minute, so a failed
// reply is logged rather than retried — the row is already saved either way.
//
// `body` is a string for a plain answer or a built message object for a card,
// so a caller that has a card to send does not need a second function that
// differs only in the shape of one field.
export async function replyToLine(replyToken, body, quickReply = null) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !replyToken) return false;

  const message = typeof body === 'string' ? { type: 'text', text: body } : { ...body };
  if (quickReply) message.quickReply = quickReply;

  const res = await fetch(`${LINE_API}/v2/bot/message/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ replyToken, messages: [message] }),
  });
  if (!res.ok) console.error('line reply failed', res.status, await res.text().catch(() => ''));
  return res.ok;
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
