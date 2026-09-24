// Account pickers as LINE quick-reply buttons.
//
// A chat message almost never names an account in a form the sheet knows, and
// asking someone to type an account number defeats the point of a chat bot.
// The bot asks instead, and the answer comes back as a tap.
//
// The chosen accounts ride in the postback data rather than being parked on
// the server, so nothing has to be remembered between one tap and the next —
// a restart mid-conversation cannot lose the answer already given.

const MAX_ITEMS = 13; // LINE's own limit on quick-reply buttons
const MAX_LABEL = 20; // and on a button's label

// "SCB Emergency Reserve Account" does not fit, so the words that carry no
// information are dropped before anything is cut off mid-word.
export function buttonLabel(name) {
  const trimmed = String(name).replace(/\s*Account$/i, '').trim();
  if (trimmed.length <= MAX_LABEL) return trimmed;
  return `${trimmed.slice(0, MAX_LABEL - 1)}…`;
}

// step|inboxId|answers…  — kept short because LINE caps postback data at 300.
export function encode(step, inboxId, answers = []) {
  return [step, inboxId, ...answers].join('|');
}

export function decode(data) {
  const [step, inboxId, ...answers] = String(data ?? '').split('|');
  return { step, inboxId, answers };
}

export function accountButtons(step, inboxId, accounts, answers = []) {
  return {
    items: accounts.slice(0, MAX_ITEMS).map((a) => ({
      type: 'action',
      action: {
        type: 'postback',
        label: buttonLabel(a.name),
        data: encode(step, inboxId, [...answers, a.name]),
        // Shows the tap in the chat, so the thread reads as a conversation
        // rather than the bot talking to itself.
        displayText: a.name,
      },
    })),
  };
}

// Which accounts make sense to offer, and in what order. A transfer or a
// trade has two ends; spending has one.
export function needsTwoAccounts(type) {
  return type === 'Transfer' || type === 'Buy' || type === 'Sell';
}

export function orderAccounts(accounts, preferred) {
  if (!preferred) return accounts;
  return [...accounts].sort((a, b) => (a.name === preferred ? -1 : b.name === preferred ? 1 : 0));
}

// --- slip confirmation ----------------------------------------------------
//
// A slip ends on a card with a confirm button rather than booking on the last
// account tap: a photo is easier to misread than a sentence, so the whole
// reading — amount, from, to — is shown once more before anything moves.
//
// The card is drawn after the account taps, when nothing but the postback
// data is to hand, so the row's own figures ride along with the answers:
//
//   step|inboxId|type|amount|currency|account…
//
// Reading them back from the sheet instead would cost a round trip on every
// tap and a lag behind the write that just happened.

export const SLIP_STEPS = new Set(['se', 'sa', 'sb', 'ok', 'chg', 'no']);

export function encodeSlip(step, inboxId, meta, accounts = []) {
  return encode(step, inboxId, [meta.type, meta.amount, meta.currency || 'THB', ...accounts]);
}

export function decodeSlip(answers) {
  const [type, amount, currency, ...accounts] = answers ?? [];
  return { meta: { type, amount: Number(amount), currency: currency || 'THB' }, accounts };
}

/** Account picker for a slip. Same buttons as a typed row, slip steps inside. */
export function slipAccountButtons(step, inboxId, meta, accounts, answers = []) {
  return {
    items: accounts.slice(0, MAX_ITEMS).map((a) => ({
      type: 'action',
      action: {
        type: 'postback',
        label: buttonLabel(a.name),
        data: encodeSlip(step, inboxId, meta, [...answers, a.name]),
        displayText: a.name,
      },
    })),
  };
}
