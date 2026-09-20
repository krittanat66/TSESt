import { useEffect, useState } from 'react';
import { useWealth } from '../data/WealthContext';

export function PasscodeGate() {
  const { unlock, error } = useWealth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [show, setShow] = useState(false);
  const [health, setHealth] = useState(null);

  // /api/health needs no passcode. Reading it here puts the one fact that
  // separates "I typed it wrong" from "the server holds something else" on
  // the screen where the login fails, instead of behind a URL nobody thinks
  // to open while locked out.
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setResult(await unlock(code.trim()));
    setBusy(false);
  };

  const typed = code.trim();
  const expected = health?.passcodeLength;
  const rejected = result === 'unauthorized';
  const lengthGap = rejected && typeof expected === 'number' && expected !== typed.length;

  // A phone keyboard left in Thai turns "Louis1" into Thai letters, and a
  // masked field hides that completely — the passcode simply never works and
  // nothing on screen says why.
  const nonAscii = [...typed].filter((c) => c.charCodeAt(0) > 127);

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-xs">
        <h1 className="text-2xl font-bold text-white mb-1">MY WEALTH</h1>
        <p className="text-sm text-text-tertiary mb-6">ใส่รหัสผ่านเพื่อเปิดดูข้อมูล</p>

        <div className="relative">
          <input
            id="passcode"
            type={show ? 'text' : 'password'}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setResult(null);
            }}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            autoComplete="off"
            placeholder="รหัสผ่าน"
            className="w-full bg-bg-card border border-border-soft rounded-lg pl-4 pr-16 py-3
              text-white placeholder:text-text-tertiary outline-none font-mono tracking-wide
              focus:border-cyan focus:ring-1 focus:ring-cyan"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cyan px-1 py-1"
          >
            {show ? 'ซ่อน' : 'ดู'}
          </button>
        </div>

        <p className="text-text-tertiary text-[11px] mt-2">
          พิมพ์ไปแล้ว {typed.length} ตัว
          {typeof expected === 'number' && expected > 0 && ` · ต้องการ ${expected} ตัว`}
        </p>

        {nonAscii.length > 0 && (
          <p className="text-gold text-xs mt-2">
            เจอตัวอักษรไทย “{nonAscii.join('')}” — คีย์บอร์ดยังอยู่โหมดภาษาไทย
            กดปุ่มลูกโลก 🌐 สลับเป็น English แล้วพิมพ์ใหม่
          </p>
        )}

        {result === 'unconfigured' && (
          <p className="text-coral text-xs mt-2">
            เซิร์ฟเวอร์ยังไม่ได้ตั้งรหัสผ่าน (APP_PASSCODE) — ใส่รหัสยังไงก็ยังเข้าไม่ได้
            จนกว่าจะตั้งค่าในฝั่งเซิร์ฟเวอร์
          </p>
        )}

        {rejected && (
          <p className="text-coral text-xs mt-2">
            รหัสผ่านไม่ถูกต้อง
            {lengthGap && (
              <>
                {' '}— เซิร์ฟเวอร์เก็บรหัสยาว <b>{expected}</b> ตัว แต่คุณพิมพ์{' '}
                <b>{typed.length}</b> ตัว
              </>
            )}
          </p>
        )}

        {result === 'sheet-error' && (
          <div className="text-xs mt-2 space-y-1">
            <p className="text-gold">
              <b>รหัสผ่านถูกต้องแล้ว</b> — แต่เซิร์ฟเวอร์อ่าน Google Sheet ไม่ได้
            </p>
            <p className="text-text-tertiary break-words">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !typed}
          className="w-full mt-4 bg-cyan text-bg-primary font-semibold rounded-lg py-3
            disabled:opacity-40 transition-opacity"
        >
          {busy ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}
        </button>

        {health && (
          <p className="text-text-tertiary text-[11px] mt-4 text-center">
            เซิร์ฟเวอร์ตั้งรหัสไว้ {health.passcodeLength || 0} ตัวอักษร
          </p>
        )}
      </form>
    </div>
  );
}
