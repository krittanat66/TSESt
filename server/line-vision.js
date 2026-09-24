// Reading a payment slip photo.
//
// The photo is fetched from LINE, handed to a vision model, and comes back as
// one of the three things a slip can be: money spent, money put into an
// asset, or money moved between accounts you already own. Which of the three
// it is changes the sheet a great deal — a transfer booked as spending
// inflates the month's expenses by the whole amount — so the model is asked
// to say which, and the answer is checked rather than trusted.
//
// Nothing here writes to a sheet. The read produces an inbox row like any
// chat message, and an account tap still books it.

const LINE_DATA_API = process.env.LINE_DATA_API_BASE || 'https://api-data.line.me';
const GEMINI_API = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com';
// Google retires model names on its own schedule, and a retired name answers
// 404 — which is how the first real slip failed. So the name is not trusted:
// the ones below are tried in order, and if every one is gone the API is
// asked which models this key can use. Whichever works is remembered for
// the life of the process.
const MODEL_CANDIDATES = [process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash'].filter(
  Boolean
);
let workingModel = null;

// A phone photo of a slip is well under this. The cap is here so a malformed
// or hostile upload cannot pull an unbounded body into memory.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function visionConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Downloads the image bytes LINE is holding for one message id. */
export async function fetchLineImage(messageId) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set.');

  const res = await fetch(`${LINE_DATA_API}/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`LINE content responded ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error('รูปใหญ่เกินไป');
  return { buffer: buf, mimeType: res.headers.get('content-type') || 'image/jpeg' };
}

const PROMPT = `คุณกำลังอ่านสลิปธนาคารหรือใบเสร็จของประเทศไทย ตอบกลับเป็น JSON อย่างเดียว ห้ามมีข้อความอื่น

โครงสร้าง:
{
  "kind": "Expense" | "Investment" | "Transfer",
  "amount": number,
  "currency": "THB" | "USD",
  "date": "YYYY-MM-DD",
  "merchant": string,
  "fromAccountNumber": string,
  "toAccountNumber": string,
  "asset": string,
  "note": string,
  "confidence": number
}

วิธีแยกประเภท:
- Transfer = โอนระหว่างบัญชีของเจ้าของเอง (ปลายทางเป็นชื่อเดียวกับผู้โอน หรือเป็นบัญชีออมทรัพย์/ฉุกเฉิน/Dime ของตัวเอง)
- Investment = ซื้อหุ้น กองทุน ทอง หรือ DCA (ให้ใส่ ticker ใน asset)
- Expense = จ่ายให้ร้านค้าหรือบุคคลอื่น
ถ้าไม่แน่ใจระหว่าง Transfer กับ Expense ให้ตอบ Expense และตั้ง confidence ต่ำ
merchant คือชื่อผู้รับเงิน/ร้านค้า (เช่น "เคเอฟซี" ไม่ใช่ Biller ID)

เลขบัญชี:
- สลิปธนาคารมักปิดบางหลัก เช่น "xxx-xxx069-0" ให้ตอบเฉพาะตัวเลขที่มองเห็นตามลำดับ คือ "0690"
- ห้ามเดาหลักที่ถูกปิด ห้ามใส่ Biller ID รหัสร้านค้า หรือรหัสอ้างอิงลงในช่องเลขบัญชี
- ถ้าปลายทางเป็นร้านค้าหรือ Biller ไม่ใช่บัญชี ให้ toAccountNumber เป็น ""

วันที่:
- สลิปไทยใช้ปี พ.ศ. ให้ลบ 543 เป็น ค.ศ. เช่น "23 ก.ย. 2569" คือ "2026-09-23"

confidence คือ 0 ถึง 1`;

// Models wrap JSON in ```json fences often enough that stripping them is
// cheaper than failing the read over punctuation.
function parseJsonReply(raw) {
  const cleaned = String(raw ?? '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('อ่านสลิปไม่ออก');
  return JSON.parse(cleaned.slice(start, end + 1));
}

const KINDS = new Set(['Expense', 'Investment', 'Transfer']);

/**
 * Asks the vision model what the slip says.
 *
 * Returns the raw reading. Turning it into an inbox row — and deciding
 * whether it is trustworthy enough to pre-fill anything — is `slipToRow`.
 */
function geminiUrl(model, action, key) {
  return `${GEMINI_API}/v1beta/models/${model}:${action}?key=${encodeURIComponent(key)}`;
}

// Google's error body says why — "model not found", "API key not valid",
// "quota exceeded" — and without it every failure reads as a bare status
// code, as the first one did.
async function geminiError(res) {
  const body = await res.json().catch(() => ({}));
  const why = body?.error?.message ? ` — ${body.error.message}` : '';
  return new Error(`Gemini responded ${res.status}${why}`.slice(0, 300));
}

/**
 * The newest flash model this key can call. Only used once every name in
 * MODEL_CANDIDATES has come back 404.
 */
export async function discoverModel(key) {
  const res = await fetch(`${GEMINI_API}/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`);
  if (!res.ok) throw await geminiError(res);
  const { models = [] } = await res.json();
  return pickModel(models);
}

// Plain flash models that read images: not the image-generating, speech or
// live variants, and a stable name before an experiment. Newest version
// first, since an old name is the one about to be retired.
export function pickModel(models) {
  const version = (name) => Number((name.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const usable = models
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => String(m.name ?? '').replace(/^models\//, ''))
    .filter((n) => /flash/.test(n) && !/image|tts|audio|live|embedding|thinking/.test(n));
  usable.sort((a, b) => {
    const unstable = (n) => (/exp|preview/.test(n) ? 1 : 0);
    return unstable(a) - unstable(b) || version(b) - version(a) || /lite/.test(a) - /lite/.test(b);
  });
  if (!usable.length) throw new Error('ไม่พบโมเดล Gemini ที่อ่านรูปได้สำหรับคีย์นี้');
  return usable[0];
}

async function generate(model, key, request) {
  return fetch(geminiUrl(model, 'generateContent', key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

/**
 * Asks the vision model what the slip says.
 *
 * Returns the raw reading. Turning it into an inbox row — and deciding
 * whether it is trustworthy enough to pre-fill anything — is `slipToRow`.
 */
export async function readSlip({ buffer, mimeType }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('ยังไม่ได้ตั้งค่า GEMINI_API_KEY');

  const request = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } },
        ],
      },
    ],
    // Reading a number off a picture has one right answer, so there is
    // nothing for sampling to explore.
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  };

  let res = null;
  const tried = workingModel ? [workingModel] : MODEL_CANDIDATES;
  for (const model of tried) {
    res = await generate(model, key, request);
    if (res.status !== 404) {
      if (res.ok) workingModel = model;
      break;
    }
    console.error(`gemini: model ${model} not found, trying the next`);
  }
  if (res.status === 404) {
    // Every known name is retired (or the remembered one just was): ask.
    workingModel = null;
    const model = await discoverModel(key);
    console.log(`gemini: using discovered model ${model}`);
    res = await generate(model, key, request);
    if (res.ok) workingModel = model;
  }
  if (!res.ok) throw await geminiError(res);

  const body = await res.json();
  const textPart = body?.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === 'string');
  if (!textPart) throw new Error('อ่านสลิปไม่ออก');

  const out = parseJsonReply(textPart.text);
  if (!KINDS.has(out.kind)) out.kind = 'Expense';
  out.amount = Number(String(out.amount).replace(/,/g, ''));
  if (!Number.isFinite(out.amount) || out.amount <= 0) throw new Error('อ่านยอดเงินไม่ออก');
  return out;
}

const TYPE_BY_KIND = { Expense: 'Expense', Investment: 'Buy', Transfer: 'Transfer' };

/**
 * A slip reading as a 16_INBOX row.
 *
 * `confidence` is carried through from the model rather than fixed, because a
 * blurry slip and a clean one should not arrive at the reviewer looking the
 * same.
 */
export function slipToRow(slip, { receivedAt = '' } = {}) {
  // Thai slips mask most of an account number ("xxx-xxx069-0"), so what
  // survives is often the last four digits. Those are kept — the caller
  // matches them against the end of each account number — while anything
  // shorter could match too many accounts to mean one.
  //
  // Positions are kept, blanks included: [from, to]. Dropping an unreadable
  // "from" would promote the "to" into its place and book the money out of
  // the account it went into.
  const numbers = [slip.fromAccountNumber, slip.toAccountNumber]
    .map((n) => String(n ?? '').replace(/\D/g, ''))
    .map((n) => (n.length >= 4 ? n : ''));

  const confidence = Number(slip.confidence);
  return {
    source: 'LINE',
    inputType: 'Image',
    rawData: [slip.merchant, slip.note, slip.date].filter(Boolean).join(' · ').slice(0, 500),
    // The whole reading, kept beside the row: when a figure looks wrong the
    // reviewer can see what the model actually thought it saw.
    aiResult: JSON.stringify(slip).slice(0, 500),
    transactionType: TYPE_BY_KIND[slip.kind] ?? 'Expense',
    amount: slip.amount,
    currency: slip.currency === 'USD' ? 'USD' : 'THB',
    category: slip.kind === 'Expense' ? 'Other' : '',
    asset: slip.kind === 'Investment' ? String(slip.asset ?? '').toUpperCase() : '',
    merchant: slip.merchant ?? '',
    date: slip.date ?? '',
    accountNumbers: numbers,
    transactionDate: /^\d{4}-\d{2}-\d{2}$/.test(String(slip.date ?? '')) ? slip.date : '',
    confidence: confidence >= 0.85 ? 'High' : confidence >= 0.6 ? 'Medium' : 'Low',
    // Same rule as a typed message: a read waits for a human. A slip is
    // easier to misread than a sentence, not harder.
    status: 'Need Review',
    receivedAt,
  };
}
