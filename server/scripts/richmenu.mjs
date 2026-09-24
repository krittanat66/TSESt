// Builds the rich menu artwork and installs it on the LINE channel.
//
//   node scripts/richmenu.mjs build     — writes assets/richmenu.png only
//   node scripts/richmenu.mjs install   — builds, uploads, sets as default
//
// Run once, and again whenever the tiles in line-richmenu.js change. It is a
// script rather than something the server does at boot because installing a
// menu is a change to the channel, not to a request.

import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import sharp from 'sharp';
import { menuSvg, richMenu } from '../line-richmenu.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(HERE, '../assets');
const FONT_DIR = resolve(ASSETS, 'fonts');
const PNG = resolve(ASSETS, 'richmenu.png');

// Thai text renders as empty boxes without a Thai face installed, and the
// container this runs in has none. The font is fetched once and kept beside
// the artwork so the second run — and a run on a machine with no system Thai
// font at all — produces the same image.
const FONT_URL =
  'https://fonts.gstatic.com/s/notosansthai/v29/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU3NqpzE.ttf';
const FONT_FILE = resolve(FONT_DIR, 'NotoSansThai-Bold.ttf');

const exists = (p) => access(p).then(() => true, () => false);

async function ensureFont() {
  if (await exists(FONT_FILE)) return;
  await mkdir(FONT_DIR, { recursive: true });
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error(`ดาวน์โหลดฟอนต์ไม่ได้ (HTTP ${res.status})`);
  await writeFile(FONT_FILE, Buffer.from(await res.arrayBuffer()));
  console.log(`ฟอนต์: ${FONT_FILE}`);
}

// librsvg finds fonts through fontconfig, which by default looks only at the
// system directories. Pointing it at ours costs one generated config file and
// removes the "install this font first" step entirely.
async function useLocalFont() {
  const conf = resolve(ASSETS, 'fonts.conf');
  await writeFile(
    conf,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${FONT_DIR}</dir>
  <cachedir>${resolve(ASSETS, '.fontcache')}</cachedir>
</fontconfig>
`
  );
  process.env.FONTCONFIG_FILE = conf;
}

async function build() {
  await mkdir(ASSETS, { recursive: true });
  await ensureFont();
  await useLocalFont();
  await sharp(Buffer.from(menuSvg())).png().toFile(PNG);
  console.log(`รูปเมนู: ${PNG}`);
  return PNG;
}

function lineHeaders() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN');
  return { Authorization: `Bearer ${token}` };
}

async function lineJson(path, method, body) {
  const res = await fetch(`https://api.line.me${path}`, {
    method,
    headers: { ...lineHeaders(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LINE ${path} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

// A channel may hold only so many menus, and re-running this would otherwise
// leave the old ones behind until the limit is hit.
async function removeOld() {
  const { richmenus = [] } = await lineJson('/v2/bot/richmenu/list', 'GET');
  for (const m of richmenus) {
    await lineJson(`/v2/bot/richmenu/${m.richMenuId}`, 'DELETE');
    console.log(`ลบเมนูเก่า ${m.richMenuId}`);
  }
}

async function install() {
  await build();
  await removeOld();

  const { richMenuId } = await lineJson('/v2/bot/richmenu', 'POST', richMenu());
  console.log(`สร้างเมนู ${richMenuId}`);

  const png = await readFile(PNG);
  const up = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: { ...lineHeaders(), 'Content-Type': 'image/png' },
    body: png,
  });
  if (!up.ok) throw new Error(`อัปโหลดรูปไม่สำเร็จ ${up.status} ${await up.text()}`);

  await lineJson(`/v2/bot/user/all/richmenu/${richMenuId}`, 'POST');
  console.log('ตั้งเป็นเมนูหลักเรียบร้อย — เปิดแชทใหม่เพื่อเห็นเมนู');
}

const cmd = process.argv[2] ?? 'build';
try {
  if (cmd === 'install') await install();
  else await build();
} catch (err) {
  console.error(`ล้มเหลว: ${err.message}`);
  process.exitCode = 1;
}
