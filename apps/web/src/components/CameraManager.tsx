import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Video, Plus, Trash2, Pencil, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

interface BrandProfile {
  brand: string;
  label: string;
  defaultPort: number;
  models: string[];
  note: string | null;
  needsCustomPath: boolean;
}

interface Camera {
  id: string;
  name: string;
  brand: string;
  model: string | null;
  host: string;
  port: number;
  username: string;
  streamPath: string | null;
  quality: string;
  channel: string;
  bridgeId: string;
  enabled: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onUseChannel: (channel: string) => void;
}

const EMPTY_FORM = {
  name: '',
  brand: 'hikvision',
  model: '',
  host: '',
  port: 554,
  username: 'admin',
  password: '',
  streamPath: '',
  quality: 'sub' as 'main' | 'sub',
  bridgeId: 'default',
};

export function CameraManager({ open, onClose, onUseChannel }: Props) {
  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    fetch(`${API_BASE}/cameras`)
      .then((r) => r.json())
      .then(setCameras)
      .catch(() => setCameras([]));

  useEffect(() => {
    if (!open) return;
    fetch(`${API_BASE}/cameras/profiles`)
      .then((r) => r.json())
      .then(setProfiles)
      .catch(() => {});
    refresh();
    setMode('list');
    setError(null);
  }, [open]);

  const profile = profiles.find((p) => p.brand === form.brand);

  const selectBrand = (brand: string) => {
    const p = profiles.find((x) => x.brand === brand);
    setForm((f) => ({ ...f, brand, port: p?.defaultPort ?? 554, model: '' }));
  };

  const startAdd = () => {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setError(null);
    setMode('form');
  };

  const startEdit = (cam: Camera) => {
    setForm({
      name: cam.name,
      brand: cam.brand,
      model: cam.model ?? '',
      host: cam.host,
      port: cam.port,
      username: cam.username,
      password: '',
      streamPath: cam.streamPath ?? '',
      quality: (cam.quality as 'main' | 'sub') ?? 'sub',
      bridgeId: cam.bridgeId,
    });
    setEditId(cam.id);
    setError(null);
    setMode('form');
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        brand: form.brand,
        model: form.model || undefined,
        host: form.host.trim(),
        port: Number(form.port) || 554,
        username: form.username.trim() || 'admin',
        quality: form.quality,
        bridgeId: form.bridgeId.trim() || 'default',
        streamPath: form.streamPath.trim() || undefined,
      };
      if (form.password) body.password = form.password;
      if (!editId && !form.password) throw new Error('ต้องกรอกรหัสผ่านกล้อง');

      const res = await fetch(editId ? `${API_BASE}/cameras/${editId}` : `${API_BASE}/cameras`, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} — ${text.slice(0, 120)}`);
      }
      await refresh();
      setMode('list');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('ลบกล้องนี้?')) return;
    await fetch(`${API_BASE}/cameras/${id}`, { method: 'DELETE' }).catch(() => {});
    refresh();
  };

  const toggleEnabled = async (cam: Camera) => {
    await fetch(`${API_BASE}/cameras/${cam.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !cam.enabled }),
    }).catch(() => {});
    refresh();
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
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 16 }}
            className="glass-strong w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-glow border-white/20 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-ink-900/85 backdrop-blur-xl border-b border-white/10">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-neon-cyan" />
                <h2 className="font-display font-bold text-lg text-slate-100">จัดการกล้อง IP</h2>
              </div>
              <div className="flex items-center gap-2">
                {mode === 'list' && (
                  <button onClick={startAdd} className="btn-primary py-1.5 px-3 text-sm">
                    <Plus className="w-4 h-4" /> เพิ่มกล้อง
                  </button>
                )}
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {mode === 'list' && (
                <>
                  {cameras.length === 0 && (
                    <div className="text-center py-10 text-slate-500">
                      ยังไม่มีกล้อง — กด "เพิ่มกล้อง" เพื่อเริ่มต้น
                    </div>
                  )}
                  <div className="space-y-2">
                    {cameras.map((cam) => (
                      <div
                        key={cam.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10"
                      >
                        <button
                          onClick={() => toggleEnabled(cam)}
                          title={cam.enabled ? 'กดเพื่อปิด' : 'กดเพื่อเปิด'}
                          className={cn(
                            'w-2.5 h-2.5 rounded-full shrink-0',
                            cam.enabled ? 'bg-emerald-400' : 'bg-slate-600',
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-100 truncate">{cam.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-400 uppercase">
                              {cam.brand}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate">
                            {cam.host}:{cam.port} · channel: {cam.channel} · bridge: {cam.bridgeId}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            onUseChannel(cam.channel);
                            onClose();
                          }}
                          className="btn-ghost text-xs py-1 px-2.5"
                          title="ดูกล้องนี้ใน console"
                        >
                          ดูภาพ
                        </button>
                        <button onClick={() => startEdit(cam)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => remove(cam.id)} className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 p-3 rounded-xl bg-cyan-400/5 border border-cyan-400/20 text-xs text-slate-400 leading-relaxed">
                    💡 กล้องที่เพิ่มจะถูกดึงไปใช้โดย <span className="font-mono text-neon-cyan">camera-bridge</span> ที่รันในร้าน
                    (อ่านวิธีติดตั้งใน docs/CAMERA-SOURCES.md) — bridge จะเห็นกล้องใหม่ภายใน ~30 วินาที ไม่ต้อง restart
                  </div>
                </>
              )}

              {mode === 'form' && (
                <div className="space-y-3">
                  <Field label="ชื่อกล้อง *" placeholder="เช่น หน้าประตูเข้า" value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })} />

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wide">ยี่ห้อ *</span>
                      <select
                        value={form.brand}
                        onChange={(e) => selectBrand(e.target.value)}
                        className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
                      >
                        {profiles.map((p) => (
                          <option key={p.brand} value={p.brand} className="bg-ink-900">
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wide">รุ่น</span>
                      <select
                        value={form.model}
                        onChange={(e) => setForm({ ...form, model: e.target.value })}
                        className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
                      >
                        <option value="" className="bg-ink-900">— เลือกรุ่น —</option>
                        {(profile?.models ?? []).map((m) => (
                          <option key={m} value={m} className="bg-ink-900">{m}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {profile?.note && (
                    <div className="text-[11px] text-amber-300/90 bg-amber-400/10 border border-amber-400/25 rounded-lg px-3 py-2">
                      ⚠️ {profile.note}
                    </div>
                  )}

                  <div className="grid grid-cols-[2fr_1fr] gap-2">
                    <Field label="IP Address *" placeholder="192.168.1.64" value={form.host}
                      onChange={(v) => setForm({ ...form, host: v })} />
                    <Field label="Port" placeholder="554" value={String(form.port)}
                      onChange={(v) => setForm({ ...form, port: Number(v) || 554 })} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Username" placeholder="admin" value={form.username}
                      onChange={(v) => setForm({ ...form, username: v })} />
                    <Field label={editId ? 'Password (เว้นว่าง = ใช้ตัวเดิม)' : 'Password *'} type="password"
                      value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wide">คุณภาพสตรีม</span>
                      <select
                        value={form.quality}
                        onChange={(e) => setForm({ ...form, quality: e.target.value as 'main' | 'sub' })}
                        className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
                      >
                        <option value="sub" className="bg-ink-900">Sub stream (แนะนำ — เบากว่า)</option>
                        <option value="main" className="bg-ink-900">Main stream (คมชัด)</option>
                      </select>
                    </label>
                    <Field label="Bridge ID" placeholder="default" value={form.bridgeId}
                      onChange={(v) => setForm({ ...form, bridgeId: v })} />
                  </div>

                  {profile?.needsCustomPath && (
                    <Field label="Stream Path *" placeholder="/live/ch0" value={form.streamPath}
                      onChange={(v) => setForm({ ...form, streamPath: v })} />
                  )}

                  {error && (
                    <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2 break-words">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setMode('list')} className="btn-ghost flex-1 justify-center py-2.5">
                      ยกเลิก
                    </button>
                    <button
                      onClick={submit}
                      disabled={busy || !form.name || !form.host}
                      className="btn-primary flex-1 justify-center py-2.5"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {editId ? 'บันทึกการแก้ไข' : 'เพิ่มกล้อง'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none placeholder:text-slate-600"
      />
    </label>
  );
}
