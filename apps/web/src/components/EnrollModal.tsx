import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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
    birthYear: guessAge ? new Date().getFullYear() - guessAge : undefined,
    phone: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep('capture');
      setEmbedding(null);
      setError(null);
    }
  }, [open]);

  const capture = () => {
    if (!socket) return;
    socket.emit('capture_embedding');
    const handler = (msg: { embedding: number[] | null }) => {
      if (!msg.embedding) {
        setError('ไม่พบใบหน้าในเฟรมล่าสุด กรุณาให้ลูกค้าหันหน้าเข้ากล้องแล้วลองใหม่');
        setStep('error');
      } else {
        setEmbedding(msg.embedding);
        setStep('form');
      }
      socket.off('captured_embedding', handler);
    };
    socket.on('captured_embedding', handler);
  };

  const submit = async () => {
    if (!embedding) return;
    setStep('saving');
    try {
      const res = await fetch(`${API_BASE}/members/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          birthYear: form.birthYear ? Number(form.birthYear) : undefined,
          embedding,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
            className="glass-strong w-full max-w-md shadow-glow border-white/20 border rounded-3xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 rounded-lg hover:bg-white/10 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 grid place-items-center text-ink-950">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-xl">สมัครสมาชิกใหม่</h2>
                  <p className="text-xs text-slate-400">รับส่วนลด 10% ทันที + 100 แต้มเริ่มต้น</p>
                </div>
              </div>

              {step === 'capture' && (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-300 mb-4">
                    ให้ลูกค้าหันหน้าเข้ากล้อง แล้วกดถ่ายเพื่อบันทึกใบหน้า
                  </p>
                  <button onClick={capture} className="btn-primary py-3 px-6 text-base">
                    📸 ถ่ายและบันทึกใบหน้า
                  </button>
                </div>
              )}

              {step === 'form' && (
                <div className="space-y-3">
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
                      value={form.birthYear ? String(form.birthYear) : ''}
                      onChange={(v) => setForm({ ...form, birthYear: v ? Number(v) : undefined })}
                    />
                  </div>
                  <Field label="เบอร์โทร (ไม่บังคับ)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                  <button
                    onClick={submit}
                    disabled={!form.fullName || !form.displayName}
                    className="btn-primary w-full mt-4 py-3 justify-center disabled:opacity-40"
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
                  <p className="mt-3 font-semibold text-lg">สมัครสำเร็จ! 🎉</p>
                  <p className="text-sm text-slate-400 mt-1">แจ้งลูกค้าว่าได้รับ 100 แต้ม + ส่วนลด 10%</p>
                  <button onClick={onClose} className="btn-primary mt-4 py-2 px-5">
                    ปิด
                  </button>
                </div>
              )}

              {step === 'error' && (
                <div className="py-6 text-center">
                  <AlertCircle className="w-10 h-10 mx-auto text-rose-400" />
                  <p className="mt-2 text-sm text-rose-300">{error}</p>
                  <button
                    onClick={() => setStep('capture')}
                    className="mt-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
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
          <option key={o.value} value={o.value} className="bg-ink-900">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
