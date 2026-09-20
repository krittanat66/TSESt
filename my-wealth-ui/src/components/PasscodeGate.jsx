import { useEffect, useState } from 'react';
import { useWealth } from '../data/WealthContext';

export function PasscodeGate() {
  const { unlock, error } = useWealth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
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
    setFailed(!(await unlock(code.trim())));
    setBusy(false);
  };

  const expected = health?.passcodeLength;
  const mismatch = failed && typeof expected === 'number' && expected !== code.trim().length;

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-xs">
        <h1 className="text-2xl font-bold text-white mb-1">MY WEALTH</h1>
        <p className="text-sm text-text-tertiary mb-6">ใส่รหัสผ่านเพื่อเปิดดูข้อมูล</p>

        <input
          id="passcode"
          type="password"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setFailed(false);
          }}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          autoComplete="current-password"
          placeholder="รหัสผ่าน"
          className="w-full bg-bg-card border border-border-soft rounded-lg px-4 py-3
            text-white placeholder:text-text-tertiary outline-none
            focus:border-cyan focus:ring-1 focus:ring-cyan"
        />

        {error === 'server-unconfigured' ? (
          <p className="text-coral text-xs mt-2">
            เซิร์ฟเวอร์ยังไม่ได้ตั้งรหัสผ่าน (APP_PASSCODE) — ใส่รหัสยังไงก็ยังเข้าไม่ได้
            จนกว่าจะตั้งค่าในฝั่งเซิร์ฟเวอร์
          </p>
        ) : (
          failed && (
            <p className="text-coral text-xs mt-2">
              รหัสผ่านไม่ถูกต้อง
              {mismatch && (
                <>
                  {' '}— เซิร์ฟเวอร์เก็บรหัสยาว <b>{expected}</b> ตัว แต่คุณพิมพ์{' '}
                  <b>{code.trim().length}</b> ตัว
                </>
              )}
            </p>
          )
        )}

        <button
          type="submit"
          disabled={busy || !code.trim()}
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
