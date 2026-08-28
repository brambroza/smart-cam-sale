import { useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Loader2, LogIn } from 'lucide-react';
import { login } from '../lib/api';

export function LoginGate({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      onLoggedIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

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
            <div className="text-xs text-slate-400">เข้าสู่ระบบพนักงาน</div>
          </div>
        </div>

        <label className="block mb-3">
          <span className="text-[11px] text-slate-400 uppercase tracking-wide">ชื่อผู้ใช้</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
          />
        </label>
        <label className="block mb-5">
          <span className="text-[11px] text-slate-400 uppercase tracking-wide">รหัสผ่าน</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
          />
        </label>

        {error && (
          <div className="mb-4 text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !username || !password}
          className="btn-primary w-full justify-center py-2.5 disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          เข้าสู่ระบบ
        </button>
      </motion.form>
    </div>
  );
}
