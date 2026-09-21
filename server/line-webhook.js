import { createHmac, timingSafeEqual } from 'node:crypto';
import { parseLineMessage } from './line-parser.js';

// LINE signs every delivery with the channel secret. Without checking it the
// endpoint is a public write into the sheet for anyone who finds the URL, so
// an unverifiable request is refused rather than parsed.
export function verifySignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  let given;
  try {
    given = Buffer.from(String(signature), 'base64');
  } catch {
    return false;
  }
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

export function buildInboxRows(events) {
  const rows = [];
  for (const event of events ?? []) {
    if (event?.type !== 'message' || event?.message?.type !== 'text') continue;

    const parsed = parseLineMessage(event.message.text);
    if (!parsed.ok) {
      rows.push({
        source: 'LINE',
        inputType: 'Text',
        rawData: String(event.message.text ?? '').slice(0, 500),
        // Kept rather than dropped: an unparsed message is still something the
        // sender meant to record, and it is visible for review this way.
        transactionType: '',
        amount: '',
        category: '',
        confidence: 'Low',
        status: 'Need Review',
        receivedAt: event.timestamp ? new Date(event.timestamp).toISOString() : '',
        replyToken: event.replyToken ?? '',
        error: parsed.error,
      });
      continue;
    }

    rows.push({
      source: 'LINE',
      inputType: 'Text',
      rawData: parsed.text.slice(0, 500),
      transactionType: parsed.transactionType,
      amount: parsed.amount,
      currency: parsed.currency,
      category: parsed.category,
      confidence: parsed.confidence,
      // Everything waits for a human. Nothing reaches 04_TRANSACTIONS from here.
      status: 'Need Review',
      receivedAt: event.timestamp ? new Date(event.timestamp).toISOString() : '',
      replyToken: event.replyToken ?? '',
    });
  }
  return rows;
}

export function replyText(row) {
  if (row.error === 'no-amount') {
    return 'ไม่เจอจำนวนเงินในข้อความ ลองพิมพ์แบบนี้: ข้าว 120';
  }
  const sign = row.transactionType === 'Income' ? '+' : '-';
  return `บันทึกแล้ว ${sign}${Number(row.amount).toLocaleString('th-TH')} บาท · ${row.category}\nรอยืนยันในแอป`;
}
