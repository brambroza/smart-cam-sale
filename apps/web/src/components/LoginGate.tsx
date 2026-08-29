import { useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Loader2, LogIn, Sparkles, Store } from 'lucide-react';
import { login, register } from '../lib/api';

export function LoginGate({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onLoggedIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') void run(() => login(username.trim(), password));
    else void run(() => register(shopName.trim(), username.trim(), password));
  };

  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setError(null);
  };

  const inputCls =
    'mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none';

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong w-full max-w-sm p-8 shadow-card"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-400 to-cyan-400 grid place-items-center shadow-glow">
            <Cpu className="w-6 h-6 text-ink-950" />
          </div>
          <div>
            <div className="font-display font-bold text-lg text-slate-100">Smart Cam Sale</div>
            <div className="text-xs text-slate-400">
              {mode === 'login' ? 'เข้าสู่ระบบพนักงาน' : 'เปิดร้านของคุณ — ฟรี ไม่ต้องติดตั้งอะไร'}
            </div>
          </div>
        </div>

        {mode === 'register' && (
          <label className="block mb-3">
            <span className="text-[11px] text-slate-400 uppercase tracking-wide">ชื่อร้าน / กิจการ</span>
            <input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              autoFocus
              placeholder="ร้านกาแฟบ้านสวน"
              className={inputCls}
            />
          </label>
        )}

        <label className="block mb-3">
          <span className="text-[11px] text-slate-400 uppercase tracking-wide">
            {mode === 'login' ? 'ชื่อผู้ใช้ / อีเมล' : 'อีเมล (ใช้เข้าสู่ระบบ)'}
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete={mode === 'login' ? 'username' : 'email'}
            type={mode === 'register' ? 'email' : 'text'}
            autoFocus={mode === 'login'}
            placeholder={mode === 'register' ? 'you@example.com' : undefined}
            className={inputCls}
          />
        </label>
        <label className="block mb-5">
          <span className="text-[11px] text-slate-400 uppercase tracking-wide">
            รหัสผ่าน{mode === 'register' ? ' (8 ตัวขึ้นไป)' : ''}
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className={inputCls}
          />
        </label>

        {error && (
          <div className="mb-4 text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !username || !password || (mode === 'register' && shopName.trim().length < 2)}
          className="btn-primary w-full justify-center py-2.5 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : mode === 'login' ? (
            <LogIn className="w-4 h-4" />
          ) : (
            <Store className="w-4 h-4" />
          )}
          {mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครและเปิดร้านเลย'}
        </button>

        {mode === 'register' && (
          <p className="mt-2 text-[11px] text-slate-500 text-center">
            เริ่มที่แพ็กเกจ Lite: ระบบสมาชิก-แต้ม ค้นหาลูกค้าด้วยเบอร์โทร สคริปต์ขายจาก AI
            — อัปเกรดเป็นระบบกล้องได้ทุกเมื่อ
          </p>
        )}

        <button
          type="button"
          onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
          className="mt-4 w-full text-center text-xs text-cyan-300 hover:text-cyan-200"
        >
          {mode === 'login' ? 'ยังไม่มีบัญชี? สมัครใช้งานฟรี →' : '← มีบัญชีแล้ว? เข้าสู่ระบบ'}
        </button>

        {mode === 'login' && (
          <>
            <div className="my-4 flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex-1 h-px bg-white/10" />
              หรือ
              <span className="flex-1 h-px bg-white/10" />
            </div>

            <button
              type="button"
              onClick={() => void run(() => login('demo', 'demo@1234'))}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20 transition disabled:opacity-40"
            >
              <Sparkles className="w-4 h-4" />
              ลองเล่นโหมดเดโม — ไม่ต้องสมัคร
            </button>
            <p className="mt-2 text-[11px] text-slate-500 text-center">
              ร้านตัวอย่างพร้อมข้อมูลจำลอง ทดลองได้ทุกฟีเจอร์
              (user: <code>demo</code> / pass: <code>demo@1234</code>)
            </p>
          </>
        )}
      </motion.form>
    </div>
  );
}
