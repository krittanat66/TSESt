// Posts inbox rows through the Apps Script Web App, the same write path the
// DCA scores use — the Sheets API key is read-only.

export async function writeInboxRows(rows) {
  const url = process.env.APPS_SCRIPT_URL;
  const token = process.env.APPS_SCRIPT_TOKEN;
  if (!url || !token) {
    throw new Error('Missing APPS_SCRIPT_URL or APPS_SCRIPT_TOKEN. See server/README.md.');
  }

  const res = await fetch(url, {
    method: 'POST',
    // Apps Script follows a 302 to its own googleusercontent host on the way out.
    redirect: 'follow',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, kind: 'inbox', rows }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `Apps Script responded ${res.status}`);
  }
  return body.written ?? rows.length;
}

// LINE's reply token is single-use and expires in about a minute, so a failed
// reply is logged rather than retried — the row is already saved either way.
export async function replyToLine(replyToken, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !replyToken) return false;

  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
  return res.ok;
}

// Broadcast reaches every friend of the bot. For a personal account that is
// the owner and nobody else, which avoids having to store a user id anywhere.
export async function broadcastToLine(text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set.');

  const res = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: [{ type: 'text', text }] }),
  });
  if (!res.ok) {
    throw new Error(`LINE broadcast responded ${res.status}`);
  }
  return true;
}
