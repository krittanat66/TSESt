// The bot's personality: the sarcastic answers it gives to messages that are
// not money and not a question about money.
//
// This runs LAST, after commands and after the transaction parser, and only
// for a message that carries no amount. The order matters more than the
// jokes: if the persona answered first, "ข้าว 120" would get a punchline
// instead of being recorded, and the bot would stop being useful the moment
// it became funny.

const PERSONA_RESPONSES = {
  greeting: [
    'หวัดดีครับโผ้มมมมม 🦦',
    'ดีจ้า พิมพ์มา ทำไม ว่ามาาา',
    'ไปกันได้แล้ว ยัยบ๊อง 😒',
    'บ้าน่า... อดีต Beta Tester หรอ!!! 😱',
    'พลังงานนี้มัน... หรือว่าเธอปลุกเนตรวงแหวนได้แล้ว?! 👁️✨',
    'รักก็ได้ 🙄',
  ],
  avoiding: [
    'กูไม่ใช่หลุยส์ กูไม่รู้้้้วววววว 🤪',
    'กูไม่ออก กูออกแล้วจะเอาอะไรแดก 💸',
    'เลขหมายที่ท่านเรียก... ไม่ได้รับการตอบรับ กรุณาไปทำงานเองเถอะครับ 🙄',
    'เรื่องงานไว้คุยชาติหน้า ตอนนี้สมองกำลังโหลดมีมอยู่ 💤',
    'ถามเรื่องงานอีกละ เป็นญาติฝ่ายไหนเนี่ย รำคาญเว้ย!',
    'งานการอะไรไม่ทำละ จะนอน กินบุญเก่าที่เหลืออยู่ 14 บาท',
  ],
  encouragement: [
    'สู้เขานะ... ถึงลึกๆ จะคิดว่าเดี๋ยวก็ยอมแพ้อยู่ดีก็เถอะ 🙄 แต่ก็เอาวะ สู้ๆ!',
    'ส่งพลังใจให้ 100 เต็ม 10! (ส่วนผลลัพธ์... ตัวใครตัวมันนะจ๊ะ 🏃‍♂️)',
    'เก่งมาก ยอดเยี่ยมกระเทียมดอง! ...พูดตามมารยาทเฉยๆ หรอกนะ เอาจริงก็ทำได้แหละมั้ง ลองดูๆ',
    'วันนี้พยายามเต็มที่เลยนะ! เผื่อฟลุกปาฏิหาริย์เกิดขึ้นจริง (แต่น้อยมาก เตือนไว้ก่อน 555)',
    'เชื่อมั่นในตัวแกนะ... 50% อีก 50% คือเตรียมใจรับความชิบหายไว้ละ สู้ๆ!',
  ],
};

// Deliberately narrow. A bare "ขอ" or "เงิน" would swallow "ขอสรุป" and
// "เงินเดือน 18945" — the first is a question the bot can answer and the
// second is income, and a joke in place of either is a bug, not a bit.
const MOOD_WORDS = [
  ['avoiding', ['งาน', 'โปรเจกต์', 'โปรเจค', 'เหนื่อย', 'ทำไง', 'ช่วยคิด', 'เมื่อไหร่เสร็จ']],
  ['encouragement', ['สู้', 'ขอกำลังใจ', 'ให้กำลังใจ', 'ขอพลัง', 'ท้อ', 'เศร้า', 'ไม่ไหว']],
  ['greeting', ['สวัสดี', 'หวัดดี', 'ดีจ้า', 'ว่าไง', 'hello', 'hi', 'โย่', 'พูดคุย', 'คุยเล่น']],
];

export function moodOf(text) {
  const t = String(text ?? '').trim().toLowerCase();
  if (!t) return null;
  for (const [mood, words] of MOOD_WORDS) {
    if (words.some((w) => t.includes(w))) return mood;
  }
  return 'greeting'; // anything else the bot cannot read is still small talk
}

// `pick` is injectable so a test can assert which line comes out without
// having to defeat Math.random.
export function personaReply(text, pick = (list) => list[Math.floor(Math.random() * list.length)]) {
  const list = PERSONA_RESPONSES[moodOf(text)] ?? PERSONA_RESPONSES.greeting;
  return pick(list);
}

export { PERSONA_RESPONSES };
