// Installs the rich menu on the LINE channel: check it, clear the old ones,
// create it, attach the artwork, make it everyone's default.
//
// Lives in the server rather than only in a script so it can be run from a
// button in the app — the first install never happened because running a
// Node script needs a terminal the owner does not have open.

import { richMenu } from './line-richmenu.js';

const LINE_API = () => process.env.LINE_API_BASE || 'https://api.line.me';
const LINE_DATA_API = () => process.env.LINE_DATA_API_BASE || 'https://api-data.line.me';

function headers(extra = {}) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN');
  return { Authorization: `Bearer ${token}`, ...extra };
}

// LINE's error body names the field it objects to ("areas[0].action.type:
// invalid"). Without it a refused menu is a bare 400 and no clue.
async function call(base, path, method, body, contentType = 'application/json') {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: headers(body ? { 'Content-Type': contentType } : {}),
    body: body == null ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body,
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text);
      detail = [j.message, ...(j.details ?? []).map((d) => `${d.property}: ${d.message}`)]
        .filter(Boolean)
        .join(' · ');
    } catch {
      /* not JSON — keep the raw text */
    }
    throw new Error(`LINE ${method} ${path} → ${res.status} ${detail}`.slice(0, 400));
  }
  return text ? JSON.parse(text) : {};
}

/**
 * @param {Buffer} png the 1200×800 artwork
 * @returns {{ richMenuId: string, removed: string[] }}
 */
export async function installRichMenu(png) {
  if (!png?.length) throw new Error('ไม่พบรูปเมนู (assets/richmenu.png)');
  const menu = richMenu();

  // Checked before anything is deleted, so a menu LINE would refuse cannot
  // take the working one down with it.
  await call(LINE_API(), '/v2/bot/richmenu/validate', 'POST', menu);

  const { richmenus = [] } = await call(LINE_API(), '/v2/bot/richmenu/list', 'GET');
  const { richMenuId } = await call(LINE_API(), '/v2/bot/richmenu', 'POST', menu);

  try {
    await call(LINE_DATA_API(), `/v2/bot/richmenu/${richMenuId}/content`, 'POST', png, 'image/png');
    await call(LINE_API(), `/v2/bot/user/all/richmenu/${richMenuId}`, 'POST');
  } catch (err) {
    // A menu with no image cannot be shown; leaving it behind would only
    // count against the channel's limit.
    await call(LINE_API(), `/v2/bot/richmenu/${richMenuId}`, 'DELETE').catch(() => {});
    throw err;
  }

  // The old menus go last, once the new one is live — never a moment with
  // none at all.
  const removed = [];
  for (const m of richmenus) {
    await call(LINE_API(), `/v2/bot/richmenu/${m.richMenuId}`, 'DELETE').catch(() => {});
    removed.push(m.richMenuId);
  }
  return { richMenuId, removed };
}
