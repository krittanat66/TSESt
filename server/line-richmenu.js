// The 2×2 rich menu: the four things worth doing without typing.
//
// LINE draws nothing of its own here — the image IS the menu, and the areas
// below are invisible rectangles laid over it. So the two have to be built
// from one description or they drift apart, and a tap lands on the wrong
// tile. `TILES` is that description; both the image and the areas come from
// it.

export const MENU_WIDTH = 1200;
export const MENU_HEIGHT = 800;

const NAVY = { bg: '#1E3A8A', edge: '#2563EB' };
const RED = { bg: '#991B1B', edge: '#DC2626' };

export const TILES = [
  {
    glyph: 'camera',
    title: 'สแกนสลิปด่วน',
    subtitle: 'ถ่ายรูป / เลือกจากอัลบั้ม',
    tone: RED,
    // Not a cameraRoll action: LINE allows camera and camera-roll actions only
    // in quick-reply buttons, and a rich menu carrying one is refused whole —
    // which is why the first install never showed. The tile sends a word
    // instead, and the answer carries the camera and album as quick replies.
    action: { type: 'message', label: 'สแกนสลิป', text: 'สแกนสลิป' },
  },
  {
    glyph: 'chat',
    title: 'โหมดพูดคุย',
    subtitle: 'คุยเล่นกับบอท',
    tone: NAVY,
    action: { type: 'message', label: 'พูดคุย', text: 'เข้าสู่โหมดพูดคุย' },
  },
  {
    glyph: 'bars',
    title: 'เช็คงบค่าใช้จ่าย',
    subtitle: 'เหลือใช้ได้เท่าไหร่',
    tone: NAVY,
    action: { type: 'message', label: 'เช็คงบ', text: 'เช็คงบ' },
  },
  {
    glyph: 'trend',
    title: 'เช็คพอร์ตเดือนนี้',
    subtitle: 'DCA และผลตอบแทน',
    tone: RED,
    action: { type: 'message', label: 'เช็คพอร์ต', text: 'เช็คพอร์ต' },
  },
];

const COLS = 2;
const CELL_W = MENU_WIDTH / COLS;
const CELL_H = MENU_HEIGHT / 2;

export function tileBounds(index) {
  return {
    x: (index % COLS) * CELL_W,
    y: Math.floor(index / COLS) * CELL_H,
    width: CELL_W,
    height: CELL_H,
  };
}

export function richMenu() {
  return {
    size: { width: MENU_WIDTH, height: MENU_HEIGHT },
    selected: true,
    name: 'MY WEALTH',
    // LINE caps this at 14 characters.
    chatBarText: 'MY WEALTH',
    areas: TILES.map((t, i) => ({ bounds: tileBounds(i), action: t.action })),
  };
}

// Drawn rather than set as emoji: the renderer that turns this SVG into the
// PNG has no emoji font, and a tile whose icon is a tofu box is worse than
// one with no icon at all. Each glyph is centred on (0,0) in a 100-unit box
// and placed by a transform, so the tiles stay interchangeable.
const GLYPHS = {
  camera: `<rect x="-46" y="-30" width="92" height="64" rx="12" fill="none" stroke="#FFFFFF" stroke-width="7"/>
    <path d="M-20 -30 l8 -14 h24 l8 14" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linejoin="round"/>
    <circle cx="0" cy="4" r="19" fill="none" stroke="#FFFFFF" stroke-width="7"/>`,
  chat: `<path d="M-46 -30 h92 a10 10 0 0 1 10 10 v40 a10 10 0 0 1 -10 10 h-56 l-26 20 v-20 h-10 a10 10 0 0 1 -10 -10 v-40 a10 10 0 0 1 10 -10 z"
      fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linejoin="round"/>
    <circle cx="-18" cy="0" r="5" fill="#FFFFFF"/><circle cx="2" cy="0" r="5" fill="#FFFFFF"/><circle cx="22" cy="0" r="5" fill="#FFFFFF"/>`,
  bars: `<path d="M-48 36 h96" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/>
    <rect x="-40" y="-6" width="20" height="34" rx="4" fill="#FFFFFF"/>
    <rect x="-10" y="-34" width="20" height="62" rx="4" fill="#FFFFFF"/>
    <rect x="20" y="-18" width="20" height="46" rx="4" fill="#FFFFFFB0"/>`,
  trend: `<path d="M-48 36 h96" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/>
    <path d="M-40 18 l24 -26 l18 16 l32 -38" fill="none" stroke="#FFFFFF" stroke-width="9"
      stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M14 -30 h20 v20" fill="none" stroke="#FFFFFF" stroke-width="9"
      stroke-linecap="round" stroke-linejoin="round"/>`,
};

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The menu artwork.
 *
 * Kept as SVG rather than a checked-in PNG so a wording change is a one-line
 * edit instead of a round trip through a design tool — the PNG LINE wants is
 * rasterised from this by `scripts/richmenu.mjs`.
 */
export function menuSvg({ fontFamily = 'Noto Sans Thai' } = {}) {
  const tiles = TILES.map((t, i) => {
    const { x, y, width, height } = tileBounds(i);
    // A hairline gap between tiles, so four flat rectangles read as four
    // buttons instead of one striped background.
    const g = 6;
    return `
  <g>
    <rect x="${x + g}" y="${y + g}" width="${width - g * 2}" height="${height - g * 2}"
          rx="28" fill="${t.tone.bg}"/>
    <rect x="${x + g}" y="${y + height - g - 8}" width="${width - g * 2}" height="8"
          rx="4" fill="${t.tone.edge}"/>
    <g transform="translate(${x + width / 2} ${y + height / 2 - 92})">${GLYPHS[t.glyph] ?? ''}</g>
    <text x="${x + width / 2}" y="${y + height / 2 + 46}" font-size="48" font-weight="700"
          text-anchor="middle" fill="#FFFFFF" font-family="${fontFamily}">${esc(t.title)}</text>
    <text x="${x + width / 2}" y="${y + height / 2 + 100}" font-size="30"
          text-anchor="middle" fill="#FFFFFFB0" font-family="${fontFamily}">${esc(t.subtitle)}</text>
  </g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${MENU_WIDTH}" height="${MENU_HEIGHT}" viewBox="0 0 ${MENU_WIDTH} ${MENU_HEIGHT}">
  <rect width="${MENU_WIDTH}" height="${MENU_HEIGHT}" fill="#0F172A"/>${tiles}
</svg>`;
}
