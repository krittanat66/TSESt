import { createHmac, timingSafeEqual } from 'node:crypto';
import { parseLineMessage } from './line-parser.js';
import { matchCommand } from './line-commands.js';
import { decode } from './line-buttons.js';

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

// A tap on an account button. Carries everything needed to finish the row,
// so no conversation state is held anywhere.
export function buildPostbacks(events) {
  return (events ?? [])
    .filter((e) => e?.type === 'postback' && e?.postback?.data)
    .map((e) => ({ ...decode(e.postback.data), replyToken: e.replyToken ?? '' }));
}

// A photo is a slip until proven otherwise. It is collected separately from
// text because reading it costs a call to a vision model, which the caller
// may not have configured.
export function buildImageEvents(events) {
  return (events ?? [])
    .filter((e) => e?.type === 'message' && e?.message?.type === 'image')
    .map((e) => ({
      messageId: e.message.id,
      replyToken: e.replyToken ?? '',
      receivedAt: e.timestamp ? new Date(e.timestamp).toISOString() : '',
    }));
}

export function buildInboxRows(events) {
  const rows = [];
  for (const event of events ?? []) {
    if (event?.type !== 'message' || event?.message?.type !== 'text') continue;

    // A question is answered, not filed. Without this "สรุป" would become an
    // uncategorised row in the inbox.
    const command = matchCommand(event.message.text);
    if (command) {
      rows.push({ command, replyToken: event.replyToken ?? '' });
      continue;
    }

    const parsed = parseLineMessage(event.message.text);
    if (!parsed.ok) {
      // No amount anywhere in it, so there is nothing to record. Filing it
      // would leave the reviewer a row with a blank in every money column;
      // answering it as small talk at least admits the bot did not
      // understand. This is last on purpose — a message that IS money has
      // already been taken by the branches above.
      rows.push({ chat: String(event.message.text ?? ''), replyToken: event.replyToken ?? '' });
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
      asset: parsed.asset ?? '',
      accountNumbers: parsed.accountNumbers ?? [],
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
  if (row.command) return null; // answered from sheet data by the caller
  const amount = Number(row.amount).toLocaleString('th-TH');
  // A transfer moves money without spending or earning it, so it gets neither
  // sign — showing "-500" for money you still have reads as a loss.
  if (row.transactionType === 'Transfer') {
    return `บันทึกแล้ว ย้ายเงิน ${amount} บาท (ไม่นับเป็นรายจ่าย)`;
  }
  if (row.transactionType === 'Buy' || row.transactionType === 'Sell') {
    const verb = row.transactionType === 'Buy' ? 'ซื้อ' : 'ขาย';
    const unit = row.currency === 'USD' ? 'USD' : 'บาท';
    return `บันทึกแล้ว ${verb} ${row.asset} ${amount} ${unit}`;
  }
  const sign = row.transactionType === 'Income' ? '+' : '-';
  return `บันทึกแล้ว ${sign}${amount} บาท · ${row.category}`;
}
