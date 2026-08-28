import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  LayoutDashboard,
  Package,
  Users,
  UserCog,
  Plug,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ScanFace,
  Search,
} from 'lucide-react';
import { apiJson, postJson, API_BASE, getUser } from '../lib/api';
import { formatThb, cn } from '../lib/utils';

type Tab = 'overview' | 'products' | 'members' | 'staff' | 'pos';

const TABS: { key: Tab; label: string; icon: typeof Package }[] = [
  { key: 'overview', label: 'ภาพรวมขาย', icon: LayoutDashboard },
  { key: 'products', label: 'สินค้า', icon: Package },
  { key: 'members', label: 'สมาชิก', icon: Users },
  { key: 'staff', label: 'พนักงาน', icon: UserCog },
  { key: 'pos', label: 'เชื่อม POS', icon: Plug },
];

export function BackOffice({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm p-3 md:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.97, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 12 }}
            className="glass-strong w-full h-full max-w-6xl mx-auto flex flex-col overflow-hidden border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-white/10 overflow-x-auto">
              <h2 className="font-display font-bold text-lg text-slate-100 mr-4 whitespace-nowrap">
                🗄️ หลังบ้าน
              </h2>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition whitespace-nowrap',
                    tab === t.key
                      ? 'text-neon-cyan border-neon-cyan'
                      : 'text-slate-400 border-transparent hover:text-slate-200',
                  )}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
              <button
                onClick={onClose}
                className="ml-auto p-2 rounded-lg hover:bg-white/10 transition text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-5">
              {tab === 'overview' && <OverviewTab />}
              {tab === 'products' && <ProductsTab />}
              {tab === 'members' && <MembersTab />}
              {tab === 'staff' && <StaffTab />}
              {tab === 'pos' && <PosTab />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────── shared bits ───────────────────────────

function ErrBanner({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-400/10 border border-rose-400/30 rounded-lg px-3 py-2 mb-3">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span className="break-words">{msg}</span>
    </div>
  );
}

function Spinner() {
  return (
    <div className="py-10 text-center">
      <Loader2 className="w-6 h-6 animate-spin mx-auto text-neon-cyan" />
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
      />
    </label>
  );
}

// ─────────────────────────── overview ───────────────────────────

interface Summary {
  days: number;
  totalSales: number;
  purchaseCount: number;
  daily: { day: string; total: number; count: number }[];
  topProducts: { productId: string; name: string; qty: number }[];
}

interface RecentPurchase {
  id: string;
  total: number;
  boughtAt: string;
  storeCode: string;
  member: { id: string; displayName: string } | null;
  items: { qty: number; product: { name: string } }[];
}

function OverviewTab() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<RecentPurchase[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiJson<Summary>('/purchases/summary?days=7'),
      apiJson<RecentPurchase[]>('/purchases/recent?take=10'),
    ])
      .then(([s, r]) => {
        setSummary(s);
        setRecent(r);
      })
      .catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <ErrBanner msg={err} />;
  if (!summary) return <Spinner />;

  const maxDaily = Math.max(1, ...summary.daily.map((d) => d.total));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="ยอดขาย 7 วัน" value={formatThb(summary.totalSales)} />
        <StatCard label="จำนวนบิล" value={String(summary.purchaseCount)} />
        <StatCard
          label="เฉลี่ย/บิล"
          value={summary.purchaseCount ? formatThb(summary.totalSales / summary.purchaseCount) : '—'}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            ยอดขายรายวัน
          </h3>
          {summary.daily.length === 0 && (
            <div className="text-sm text-slate-500 py-4 text-center">ยังไม่มีการขายในช่วงนี้</div>
          )}
          <div className="space-y-2">
            {summary.daily.map((d) => (
              <div key={d.day} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-slate-400 w-20 shrink-0">{d.day.slice(5)}</span>
                <div className="flex-1 h-4 rounded bg-white/[0.04] overflow-hidden">
                  <div
                    className="h-full rounded bg-gradient-to-r from-cyan-400/70 to-violet-500/70"
                    style={{ width: `${(d.total / maxDaily) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-neon-cyan w-20 text-right shrink-0">
                  {formatThb(d.total)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            ขายดี 7 วัน
          </h3>
          {summary.topProducts.length === 0 && (
            <div className="text-sm text-slate-500 py-4 text-center">ยังไม่มีข้อมูล</div>
          )}
          <div className="space-y-1.5">
            {summary.topProducts.map((p, i) => (
              <div key={p.productId} className="flex items-center gap-2 text-sm">
                <span className="text-slate-500 font-mono w-5">{i + 1}.</span>
                <span className="flex-1 text-slate-200 truncate">{p.name}</span>
                <span className="font-mono text-xs text-slate-400">×{p.qty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          บิลล่าสุด
        </h3>
        {recent.length === 0 && (
          <div className="text-sm text-slate-500 py-4 text-center">ยังไม่มีการขาย</div>
        )}
        <div className="space-y-1.5">
          {recent.map((p) => (
            <div key={p.id} className="flex items-center gap-3 text-sm py-1 border-b border-white/5 last:border-0">
              <span className="font-mono text-[11px] text-slate-500 w-28 shrink-0">
                {new Date(p.boughtAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
              <span className="text-slate-200 w-28 truncate shrink-0">
                {p.member?.displayName ?? '—'}
              </span>
              <span className="flex-1 text-xs text-slate-400 truncate">
                {p.items.map((i) => `${i.product.name}×${i.qty}`).join(', ')}
              </span>
              <span className="font-mono text-neon-cyan shrink-0">{formatThb(p.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass p-4">
      <div className="font-display font-bold text-xl text-slate-100">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
}

// ─────────────────────────── products ───────────────────────────

interface Product {
  id: string;
  name: string;
  category: string;
  sku: string | null;
  price: number;
  active: boolean;
}

const EMPTY_PRODUCT = { name: '', category: '', price: '', sku: '' };

function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_PRODUCT });
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = () =>
    apiJson<Product[]>(`/products?all=1${q ? `&q=${encodeURIComponent(q)}` : ''}`)
      .then(setProducts)
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoaded(true));

  useEffect(() => {
    const t = setTimeout(refresh, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_PRODUCT });
    setFormOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditId(p.id);
    setForm({ name: p.name, category: p.category, price: String(p.price), sku: p.sku ?? '' });
    setFormOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body = {
        name: form.name,
        category: form.category,
        price: Number(form.price),
        sku: form.sku,
      };
      if (editId) await postJson(`/products/${editId}`, body, 'PATCH');
      else await postJson('/products', body);
      setFormOpen(false);
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (p: Product) => {
    try {
      await postJson(`/products/${p.id}`, { active: !p.active }, 'PATCH');
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div>
      <ErrBanner msg={err} />
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อ / barcode..."
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
          />
        </div>
        <span className="text-xs text-slate-500 font-mono">({products.length})</span>
        <button onClick={openCreate} className="btn-primary ml-auto py-2 px-4 text-sm">
          <Plus className="w-4 h-4" /> เพิ่มสินค้า
        </button>
      </div>

      {formOpen && (
        <div className="glass p-4 mb-4 border-neon-cyan/30">
          <h3 className="text-sm font-semibold text-slate-100 mb-3">
            {editId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
          </h3>
          <div className="grid md:grid-cols-4 gap-3">
            <Input label="ชื่อสินค้า *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input label="หมวดหมู่ *" value={form.category} onChange={(v) => setForm({ ...form, category: v })} placeholder="coffee / snack / meal ..." />
            <Input label="ราคา (บาท) *" value={form.price} onChange={(v) => setForm({ ...form, price: v })} type="number" />
            <Input label="Barcode / SKU" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} placeholder="8850999xxxxxx" />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={save}
              disabled={busy || !form.name || !form.category || !form.price}
              className="btn-primary py-2 px-4 text-sm disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              บันทึก
            </button>
            <button onClick={() => setFormOpen(false)} className="btn-ghost text-sm">
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {!loaded ? (
        <Spinner />
      ) : (
        <div className="space-y-1">
          {products.map((p) => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl border text-sm',
                p.active ? 'bg-white/[0.03] border-white/10' : 'bg-white/[0.01] border-white/5 opacity-50',
              )}
            >
              <span className="flex-1 text-slate-100 truncate">{p.name}</span>
              <span className="text-[11px] text-slate-500 w-24 truncate hidden md:block">{p.category}</span>
              <span className="font-mono text-[11px] text-slate-500 w-32 truncate hidden lg:block">
                {p.sku ?? '—'}
              </span>
              <span className="font-mono text-neon-cyan w-20 text-right">{formatThb(p.price)}</span>
              <button
                onClick={() => toggleActive(p)}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border w-16 text-center',
                  p.active
                    ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10'
                    : 'text-slate-400 border-white/10',
                )}
              >
                {p.active ? 'ขายอยู่' : 'ปิดขาย'}
              </button>
              <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {products.length === 0 && (
            <div className="text-center text-slate-500 py-8">ไม่พบสินค้า</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── members ───────────────────────────

interface MemberRow {
  id: string;
  fullName: string;
  displayName: string;
  phone: string | null;
  tier: string;
  points: number;
  memberSince: string;
  faceOptIn: boolean;
}

interface MemberDetail extends MemberRow {
  purchases: { id: string; total: number; boughtAt: string; items: { qty: number; product: { name: string } }[] }[];
}

interface ConsentRow {
  id: string;
  action: string;
  policyVersion: string;
  staffUsername: string | null;
  createdAt: string;
}

function MembersTab() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<MemberDetail | null>(null);
  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = () =>
    apiJson<MemberRow[]>('/members?take=100')
      .then(setMembers)
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoaded(true));

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter(
      (m) =>
        m.displayName.toLowerCase().includes(needle) ||
        m.fullName.toLowerCase().includes(needle) ||
        (m.phone ?? '').includes(needle),
    );
  }, [members, q]);

  const openDetail = async (id: string) => {
    setErr(null);
    try {
      const [detail, cons] = await Promise.all([
        apiJson<MemberDetail>(`/members/${id}`),
        apiJson<ConsentRow[]>(`/members/${id}/consents`),
      ]);
      setSelected(detail);
      setConsents(cons);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const removeFace = async () => {
    if (!selected) return;
    if (!window.confirm(`ลบข้อมูลใบหน้าของ "${selected.displayName}"? (บันทึกเป็นการถอนความยินยอมตาม PDPA)`))
      return;
    try {
      await apiJson(`/members/${selected.id}/face`, { method: 'DELETE' });
      await openDetail(selected.id);
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (selected) {
    return (
      <div>
        <ErrBanner msg={err} />
        <button onClick={() => setSelected(null)} className="btn-ghost text-xs mb-3">
          ← กลับรายชื่อ
        </button>
        <div className="glass p-4 mb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="font-display font-bold text-lg text-slate-100">
                {selected.displayName}
                <span className="text-sm text-slate-400 font-normal ml-2">{selected.fullName}</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {selected.phone ?? 'ไม่มีเบอร์'} · tier {selected.tier} ·{' '}
                <span className="text-neon-cyan font-mono">{selected.points} แต้ม</span> · สมัคร{' '}
                {new Date(selected.memberSince).toLocaleDateString('th-TH')}
              </div>
            </div>
            {selected.faceOptIn ? (
              <button
                onClick={removeFace}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border text-rose-300 border-rose-400/40 hover:bg-rose-500/10"
              >
                <ScanFace className="w-3.5 h-3.5" /> ลบข้อมูลใบหน้า (ถอน consent)
              </button>
            ) : (
              <span className="text-[11px] text-slate-500">ไม่มีข้อมูลใบหน้า</span>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="glass p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              ประวัติซื้อล่าสุด
            </h3>
            {selected.purchases.length === 0 && (
              <div className="text-sm text-slate-500 py-3">ยังไม่มีประวัติ</div>
            )}
            <div className="space-y-1.5 text-sm">
              {selected.purchases.map((p) => (
                <div key={p.id} className="flex gap-2 py-1 border-b border-white/5 last:border-0">
                  <span className="font-mono text-[11px] text-slate-500 w-24 shrink-0">
                    {new Date(p.boughtAt).toLocaleDateString('th-TH')}
                  </span>
                  <span className="flex-1 text-xs text-slate-300 truncate">
                    {p.items.map((i) => `${i.product.name}×${i.qty}`).join(', ')}
                  </span>
                  <span className="font-mono text-neon-cyan text-xs shrink-0">{formatThb(p.total)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              หลักฐานความยินยอม (PDPA)
            </h3>
            {consents.length === 0 && (
              <div className="text-sm text-slate-500 py-3">ไม่มีบันทึก</div>
            )}
            <div className="space-y-1.5 text-xs">
              {consents.map((c) => (
                <div key={c.id} className="flex gap-2 py-1 border-b border-white/5 last:border-0">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full border shrink-0',
                      c.action === 'granted'
                        ? 'text-emerald-300 border-emerald-400/40'
                        : 'text-amber-300 border-amber-400/40',
                    )}
                  >
                    {c.action === 'granted' ? 'ยินยอม' : 'ถอน'}
                  </span>
                  <span className="text-slate-400">v{c.policyVersion}</span>
                  <span className="flex-1 text-slate-500 truncate">
                    โดย {c.staffUsername ?? '—'}
                  </span>
                  <span className="font-mono text-slate-500 shrink-0">
                    {new Date(c.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ErrBanner msg={err} />
      <div className="relative max-w-xs mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อ / เบอร์โทร..."
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
        />
      </div>
      {!loaded ? (
        <Spinner />
      ) : (
        <div className="space-y-1">
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => openDetail(m.id)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border bg-white/[0.03] border-white/10 hover:border-neon-cyan/30 text-sm text-left transition"
            >
              <span className="flex-1 text-slate-100 truncate">{m.displayName}</span>
              <span className="text-xs text-slate-500 w-28 hidden md:block">{m.phone ?? '—'}</span>
              <span className="text-[10px] text-slate-400 w-16">{m.tier}</span>
              <span className="font-mono text-neon-cyan text-xs w-16 text-right">{m.points} pt</span>
              {m.faceOptIn && <ScanFace className="w-3.5 h-3.5 text-emerald-300" />}
            </button>
          ))}
          {filtered.length === 0 && <div className="text-center text-slate-500 py-8">ไม่พบสมาชิก</div>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── staff ───────────────────────────

interface StaffRow {
  id: string;
  username: string;
  displayName: string;
  role: string;
  createdAt: string;
}

function StaffTab() {
  const [users, setUsers] = useState<StaffRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ username: '', displayName: '', password: '', role: 'staff' });
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const me = getUser();

  const refresh = () =>
    apiJson<StaffRow[]>('/auth/users')
      .then(setUsers)
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoaded(true));

  useEffect(() => {
    refresh();
  }, []);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      await postJson('/auth/users', form);
      setFormOpen(false);
      setForm({ username: '', displayName: '', password: '', role: 'staff' });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (u: StaffRow) => {
    const pw = window.prompt(`รหัสผ่านใหม่ของ ${u.username} (8 ตัวขึ้นไป):`);
    if (!pw) return;
    try {
      await postJson(`/auth/users/${u.id}/reset-password`, { newPassword: pw });
      window.alert('เปลี่ยนรหัสแล้ว');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const remove = async (u: StaffRow) => {
    if (!window.confirm(`ลบบัญชี ${u.username}?`)) return;
    try {
      await apiJson(`/auth/users/${u.id}`, { method: 'DELETE' });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div>
      <ErrBanner msg={err} />
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">
          บัญชีพนักงานสำหรับเข้าหน้า console — role <b>admin</b> เท่านั้นที่เข้าหลังบ้านได้
        </span>
        <button onClick={() => setFormOpen((v) => !v)} className="btn-primary py-2 px-4 text-sm">
          <Plus className="w-4 h-4" /> เพิ่มพนักงาน
        </button>
      </div>

      {formOpen && (
        <div className="glass p-4 mb-4 border-neon-cyan/30">
          <div className="grid md:grid-cols-4 gap-3">
            <Input label="Username *" value={form.username} onChange={(v) => setForm({ ...form, username: v })} placeholder="a-z 0-9 _ . -" />
            <Input label="ชื่อที่แสดง *" value={form.displayName} onChange={(v) => setForm({ ...form, displayName: v })} />
            <Input label="รหัสผ่าน (8+) *" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
            <label className="block">
              <span className="text-[11px] text-slate-400 uppercase tracking-wide">Role</span>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
              >
                <option value="staff" className="bg-ink-900">staff — หน้าขายอย่างเดียว</option>
                <option value="admin" className="bg-ink-900">admin — เข้าหลังบ้านได้</option>
              </select>
            </label>
          </div>
          <button
            onClick={create}
            disabled={busy || !form.username || !form.displayName || form.password.length < 8}
            className="btn-primary mt-3 py-2 px-4 text-sm disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            สร้างบัญชี
          </button>
        </div>
      )}

      {!loaded ? (
        <Spinner />
      ) : (
        <div className="space-y-1">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-3 py-2 rounded-xl border bg-white/[0.03] border-white/10 text-sm"
            >
              <span className="font-mono text-slate-100 w-32 truncate">{u.username}</span>
              <span className="flex-1 text-slate-300 truncate">{u.displayName}</span>
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border',
                  u.role === 'admin'
                    ? 'text-violet-300 border-violet-400/40 bg-violet-500/10'
                    : 'text-slate-400 border-white/10',
                )}
              >
                {u.role}
              </span>
              <button
                onClick={() => resetPassword(u)}
                title="เปลี่ยนรหัสผ่าน"
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400"
              >
                <KeyRound className="w-3.5 h-3.5" />
              </button>
              {u.id !== me?.id && (
                <button
                  onClick={() => remove(u)}
                  title="ลบบัญชี"
                  className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── POS ───────────────────────────

interface PosKey {
  id: string;
  name: string;
  storeCode: string;
  enabled: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

function PosTab() {
  const [keys, setKeys] = useState<PosKey[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [storeCode, setStoreCode] = useState('main');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const apiUrl = API_BASE || window.location.origin;

  const refresh = () =>
    apiJson<PosKey[]>('/pos/keys')
      .then(setKeys)
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoaded(true));

  useEffect(() => {
    refresh();
  }, []);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson<{ apiKey: string }>('/pos/keys', { name, storeCode });
      setNewKey(res.apiKey);
      setName('');
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (k: PosKey) => {
    try {
      await postJson(`/pos/keys/${k.id}`, { enabled: !k.enabled }, 'PATCH');
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const remove = async (k: PosKey) => {
    if (!window.confirm(`ลบ key "${k.name}"? POS ที่ใช้ key นี้จะส่งยอดขายเข้ามาไม่ได้อีก`)) return;
    try {
      await apiJson(`/pos/keys/${k.id}`, { method: 'DELETE' });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const copyKey = () => {
    if (!newKey) return;
    navigator.clipboard?.writeText(newKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <ErrBanner msg={err} />

      <div className="glass p-4">
        <h3 className="text-sm font-semibold text-slate-100 mb-1">เชื่อมต่อ POS เดิมของร้าน</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          สร้าง API key ให้แต่ละสาขา แล้วให้ POS ยิงยอดขายเข้ามาที่{' '}
          <code className="text-neon-cyan bg-white/5 px-1 rounded">POST {apiUrl}/pos/sales</code>{' '}
          พร้อม header <code className="text-neon-cyan bg-white/5 px-1 rounded">x-api-key</code> —
          ระบบจับคู่สมาชิกด้วยเบอร์โทร และจับคู่สินค้าด้วย barcode (ไม่รู้จักจะสร้างให้อัตโนมัติ)
          แต้มเข้าเหมือนขายผ่านหน้า console ทุกอย่าง · คู่มือเต็ม: <code className="bg-white/5 px-1 rounded">docs/POS-INTEGRATION.md</code>
        </p>
      </div>

      <div className="glass p-4 border-neon-cyan/20">
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <Input label="ชื่อ key (เช่น ชื่อสาขา) *" value={name} onChange={setName} placeholder="POS สาขาลาดพร้าว" />
          <Input label="รหัสสาขา (storeCode)" value={storeCode} onChange={setStoreCode} />
          <button onClick={create} disabled={busy || !name.trim()} className="btn-primary py-2 px-4 text-sm disabled:opacity-40">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            สร้าง API key
          </button>
        </div>

        {newKey && (
          <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/[0.07] p-3">
            <div className="text-xs text-amber-300 font-semibold mb-1.5">
              ⚠️ key นี้แสดงครั้งเดียว — คัดลอกเก็บทันที (ระบบเก็บเฉพาะ hash)
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs text-slate-100 bg-black/40 rounded-lg px-3 py-2 break-all">
                {newKey}
              </code>
              <button onClick={copyKey} className="btn-ghost text-xs shrink-0">
                {copied ? <CheckCircle2 className="w-4 h-4 text-neon-lime" /> : <Copy className="w-4 h-4" />}
                {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
              </button>
            </div>
          </div>
        )}
      </div>

      {!loaded ? (
        <Spinner />
      ) : (
        <div className="space-y-1">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center gap-3 px-3 py-2 rounded-xl border bg-white/[0.03] border-white/10 text-sm"
            >
              <KeyRound className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="flex-1 text-slate-100 truncate">{k.name}</span>
              <span className="font-mono text-[11px] text-slate-500 w-16">{k.storeCode}</span>
              <span className="text-[11px] text-slate-500 w-36 hidden md:block">
                {k.lastUsedAt
                  ? `ใช้ล่าสุด ${new Date(k.lastUsedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}`
                  : 'ยังไม่เคยใช้'}
              </span>
              <button
                onClick={() => toggle(k)}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border w-16 text-center',
                  k.enabled
                    ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10'
                    : 'text-slate-400 border-white/10',
                )}
              >
                {k.enabled ? 'เปิดใช้' : 'ปิดอยู่'}
              </button>
              <button onClick={() => remove(k)} className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-300">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {keys.length === 0 && (
            <div className="text-center text-slate-500 py-6 text-sm">
              ยังไม่มี key — สร้างอันแรกด้านบนแล้วเอาไปตั้งใน POS ของร้าน
            </div>
          )}
        </div>
      )}
    </div>
  );
}
