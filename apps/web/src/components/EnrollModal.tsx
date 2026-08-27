import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, X, Loader2, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import type { Socket } from 'socket.io-client';

interface Props {
  open: boolean;
  onClose: () => void;
  socket: Socket | null;
  guessGender?: 'male' | 'female' | 'unknown';
  guessAge?: number;
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export function EnrollModal({ open, onClose, socket, guessGender, guessAge }: Props) {
  const [step, setStep] = useState<'capture' | 'form' | 'saving' | 'done' | 'error'>('capture');
  const [embedding, setEmbedding] = useState<number[] | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    displayName: '',
    gender: guessGender ?? 'unknown',
    birthYear: guessAge ? new Date().getFullYear() - guessAge : '',
    phone: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep('capture');
      setEmbedding(null);
      setError(null);
    } else {
      // pre-fill guesses when opening
      setForm((f) => ({
        ...f,
        gender: guessGender ?? f.gender,
        birthYear: guessAge ? new Date().getFullYear() - guessAge : f.birthYear,
      }));
    }
  }, [open, guessAge, guessGender]);

  const capture = () => {
    if (!socket) {
      setError('ยังไม่ได้เชื่อมต่อ WebSocket — เปิด LIVE ก่อน');
      setStep('error');
      return;
    }
    if (!socket.connected) {
      setError('WebSocket ยังไม่พร้อม — รอสักครู่แล้วลองใหม่');
      setStep('error');
      return;
    }
    const timeout = setTimeout(() => {
      setError('รอ AI ตอบเกิน 5 วินาที — ระบบอาจกำลัง cold start');
      setStep('error');
      socket.off('captured_embedding', handler);
    }, 5000);
    const handler = (msg: { embedding: number[] | null }) => {
      clearTimeout(timeout);
      if (!msg.embedding || msg.embedding.length !== 512) {
        setError('ไม่พบใบหน้าในเฟรมล่าสุด — ให้ลูกค้าหันหน้าตรงเข้ากล้องชัด ๆ แล้วลองใหม่');
        setStep('error');
      } else {
        setEmbedding(msg.embedding);
        setStep('form');
      }
      socket.off('captured_embedding', handler);
    };
    socket.on('captured_embedding', handler);
    socket.emit('capture_embedding');
  };

  const submit = async () => {
    if (!embedding) {
      setError('ไม่มีข้อมูลใบหน้า');
      setStep('error');
      return;
    }
    setStep('saving');
    try {
      const body = {
        fullName: form.fullName.trim(),
        displayName: form.displayName.trim(),
        gender: form.gender,
        birthYear: form.birthYear ? Number(form.birthYear) : undefined,
        phone: form.phone.trim() || undefined,
        embedding,
      };
      const res = await fetch(`${API_BASE}/members/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} — ${text.slice(0, 100)}`);
      }
      setStep('done');
    } catch (e) {
      setError((e as Error).message);
      setStep('error');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 16 }}
            className="glass-strong w-full max-w-md shadow-glow border-white/20 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 rounded-lg hover:bg-white/10 transition text-slate-300 z-10"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 grid place-items-center text-ink-950 shadow-glow">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-xl text-slate-100">สมัครสมาชิกใหม่</h2>
                  <p className="text-xs text-slate-400 mt-0.5">รับส่วนลด 10% ทันที + 100 แต้มเริ่มต้น</p>
                </div>
              </div>

              {step === 'capture' && (
                <div className="text-center py-6">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-cyan-400/10 border border-cyan-400/30 grid place-items-center mb-4">
                    <Camera className="w-8 h-8 text-neon-cyan" />
                  </div>
                  <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                    ให้ลูกค้าหันหน้าเข้ากล้องชัด ๆ แล้วกดปุ่มด้านล่างเพื่อบันทึกใบหน้า
                  </p>
                  <button onClick={capture} className="btn-primary py-3 px-6 text-base">
                    <Camera className="w-5 h-5" /> ถ่ายและบันทึกใบหน้า
                  </button>
                </div>
              )}

              {step === 'form' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4" />
                    บันทึกใบหน้าสำเร็จ ({embedding?.length} มิติ)
                  </div>
                  <Field label="ชื่อ-นามสกุล *" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
                  <Field label="ชื่อเล่น *" value={form.displayName} onChange={(v) => setForm({ ...form, displayName: v })} />
                  <div className="grid grid-cols-2 gap-2">
                    <SelectField
                      label="เพศ"
                      value={form.gender}
                      options={[
                        { value: 'male', label: 'ชาย' },
                        { value: 'female', label: 'หญิง' },
                        { value: 'unknown', label: 'ไม่ระบุ' },
                      ]}
                      onChange={(v) => setForm({ ...form, gender: v as any })}
                    />
                    <Field
                      label="ปีเกิด"
                      value={String(form.birthYear ?? '')}
                      onChange={(v) => setForm({ ...form, birthYear: v as any })}
                    />
                  </div>
                  <Field label="เบอร์โทร (ไม่บังคับ)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                  <button
                    onClick={submit}
                    disabled={!form.fullName || !form.displayName}
                    className="btn-primary w-full mt-4 py-3 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ยืนยันสมัครสมาชิก
                  </button>
                </div>
              )}

              {step === 'saving' && (
                <div className="py-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-neon-cyan" />
                  <p className="mt-3 text-sm text-slate-300">กำลังบันทึก...</p>
                </div>
              )}

              {step === 'done' && (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-14 h-14 mx-auto text-neon-lime" />
                  <p className="mt-3 font-semibold text-lg text-slate-100">สมัครสำเร็จ! 🎉</p>
                  <p className="text-sm text-slate-400 mt-1">แจ้งลูกค้าว่าได้รับ 100 แต้ม + ส่วนลด 10%</p>
                  <button onClick={onClose} className="btn-primary mt-4 py-2 px-5">
                    ปิด
                  </button>
                </div>
              )}

              {step === 'error' && (
                <div className="py-6 text-center">
                  <AlertCircle className="w-10 h-10 mx-auto text-rose-400" />
                  <p className="mt-2 text-sm text-rose-300 break-words">{error}</p>
                  <button
                    onClick={() => setStep('capture')}
                    className="mt-4 btn-ghost"
                  >
                    ลองใหม่
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink-900 text-slate-100">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
