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
  Building2,
  Store,
  RefreshCw,
  Ban,
  Play,
  Receipt,
  Inbox,
  Video,
  Phone,
  Printer,
  Wallet,
} from 'lucide-react';
import { PrintPortal } from './Receipt';
import { apiJson, postJson, API_BASE, getUser } from '../lib/api';
import { formatThb, cn } from '../lib/utils';

type Tab = 'overview' | 'products' | 'members' | 'staff' | 'stores' | 'pos' | 'billing' | 'orgs';

const TABS: { key: Tab; label: string; icon: typeof Package; superadminOnly?: boolean }[] = [
  { key: 'overview', label: 'ภาพรวมขาย', icon: LayoutDashboard },
  { key: 'products', label: 'สินค้า', icon: Package },
  { key: 'members', label: 'สมาชิก', icon: Users },
  { key: 'staff', label: 'พนักงาน', icon: UserCog },
  { key: 'stores', label: 'สาขา', icon: Store },
  { key: 'pos', label: 'เชื่อม POS', icon: Plug },
  { key: 'billing', label: 'การเงิน', icon: Receipt },
  { key: 'orgs', label: 'องค์กร', icon: Building2, superadminOnly: true },
];

export function BackOffice({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const isSuperadmin = getUser()?.role === 'superadmin';
  const tabs = TABS.filter((t) => !t.superadminOnly || isSuperadmin);

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
              {tabs.map((t) => (
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
              {tab === 'stores' && <StoresTab />}
              {tab === 'pos' && <PosTab />}
              {tab === 'billing' && <BillingTab superadmin={isSuperadmin} />}
              {tab === 'orgs' && <OrgsTab />}
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
  store: string | null;
  totalSales: number;
  purchaseCount: number;
  byStore: { storeCode: string; total: number; count: number }[];
  daily: { day: string; total: number; count: number }[];
  topProducts: { productId: string; name: string; qty: number }[];
}

interface StoreRow {
  id: string;
  code: string;
  name: string;
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
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeFilter, setStoreFilter] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiJson<StoreRow[]>('/stores').then(setStores).catch(() => {});
  }, []);

  useEffect(() => {
    const q = storeFilter ? `&store=${encodeURIComponent(storeFilter)}` : '';
    Promise.all([
      apiJson<Summary>(`/purchases/summary?days=7${q}`),
      apiJson<RecentPurchase[]>('/purchases/recent?take=10'),
    ])
      .then(([s, r]) => {
        setSummary(s);
        setRecent(r);
      })
      .catch((e) => setErr((e as Error).message));
  }, [storeFilter]);

  if (err) return <ErrBanner msg={err} />;
  if (!summary) return <Spinner />;

  const maxDaily = Math.max(1, ...summary.daily.map((d) => d.total));
  const nameOfStore = new Map(stores.map((s) => [s.code, s.name]));

  return (
    <div className="space-y-5">
      {stores.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">สาขา:</span>
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
          >
            <option value="" className="bg-ink-900">ทุกสาขา</option>
            {stores.map((s) => (
              <option key={s.id} value={s.code} className="bg-ink-900">
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="ยอดขาย 7 วัน" value={formatThb(summary.totalSales)} />
        <StatCard label="จำนวนบิล" value={String(summary.purchaseCount)} />
        <StatCard
          label="เฉลี่ย/บิล"
          value={summary.purchaseCount ? formatThb(summary.totalSales / summary.purchaseCount) : '—'}
        />
      </div>

      <DayCloseCard store={storeFilter} storeNames={nameOfStore} />

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

      {!summary.store && summary.byStore.length > 1 && (
        <div className="glass p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            ยอดขายแยกสาขา
          </h3>
          <div className="space-y-1.5">
            {summary.byStore.map((s) => (
              <div key={s.storeCode} className="flex items-center gap-3 text-sm py-1 border-b border-white/5 last:border-0">
                <span className="flex-1 text-slate-200 truncate">
                  {nameOfStore.get(s.storeCode) ?? s.storeCode}
                  <span className="text-slate-500 font-mono text-[11px] ml-2">{s.storeCode}</span>
                </span>
                <span className="text-xs text-slate-400">{s.count} บิล</span>
                <span className="font-mono text-neon-cyan w-24 text-right">{formatThb(s.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <PromptPaySettingsCard />

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

// ─────────────────────── daily close (ปิดยอด) ───────────────────────

interface DayClose {
  date: string;
  store: string | null;
  billCount: number;
  total: number;
  avgTicket: number;
  pointsIssued: number;
  assistedBillCount: number;
  assistedTotal: number;
  byStore: { storeCode: string; total: number; count: number }[];
  topProducts: { productId: string; name: string; qty: number }[];
}

const todayBkk = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

function DayCloseCard({ store, storeNames }: { store: string; storeNames: Map<string, string> }) {
  const [date, setDate] = useState(todayBkk());
  const [data, setData] = useState<DayClose | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const q = store ? `&store=${encodeURIComponent(store)}` : '';
    apiJson<DayClose>(`/purchases/day?date=${date}${q}`)
      .then((d) => {
        setData(d);
        setErr(null);
      })
      .catch((e) => setErr((e as Error).message));
  }, [date, store]);

  return (
    <div className="glass p-4 border-lime-400/20">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex-1">
          ปิดยอดรายวัน{data?.store ? ` · ${storeNames.get(data.store) ?? data.store}` : ''}
        </h3>
        <input
          type="date"
          value={date}
          max={todayBkk()}
          onChange={(e) => setDate(e.target.value || todayBkk())}
          className="bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
        />
        <button
          onClick={() => window.print()}
          disabled={!data}
          className="btn-ghost text-xs py-1 px-2.5 disabled:opacity-40"
          title="พิมพ์สรุปปิดยอด"
        >
          <Printer className="w-3.5 h-3.5" /> พิมพ์
        </button>
      </div>
      {err && <ErrBanner msg={err} />}
      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
            <MiniStat label="จำนวนบิล" value={String(data.billCount)} />
            <MiniStat label="ยอดรวม" value={formatThb(data.total)} accent />
            <MiniStat label="เฉลี่ย/บิล" value={data.billCount ? formatThb(data.avgTicket) : '—'} />
            <MiniStat label="แต้มที่แจก" value={data.pointsIssued.toLocaleString()} />
            <MiniStat
              label="บิลที่ระบบช่วย"
              value={data.billCount ? `${data.assistedBillCount} (${formatThb(data.assistedTotal)})` : '—'}
            />
          </div>
          {data.topProducts.length > 0 && (
            <div className="mt-3 text-xs text-slate-400">
              ขายดีวันนี้:{' '}
              <span className="text-slate-200">
                {data.topProducts.map((p) => `${p.name} ×${p.qty}`).join(' · ')}
              </span>
            </div>
          )}
          {!data.store && data.byStore.length > 1 && (
            <div className="mt-2 text-xs text-slate-400">
              แยกสาขา:{' '}
              <span className="text-slate-200">
                {data.byStore
                  .map((s) => `${storeNames.get(s.storeCode) ?? s.storeCode} ${formatThb(s.total)} (${s.count} บิล)`)
                  .join(' · ')}
              </span>
            </div>
          )}

          {/* printable day-close slip */}
          <PrintPortal>
            <div style={{ fontFamily: 'monospace, sans-serif', width: '300px', color: '#000' }}>
              <div style={{ textAlign: 'center', fontWeight: 700 }}>สรุปปิดยอดรายวัน</div>
              <div style={{ textAlign: 'center', fontSize: 12 }}>
                วันที่ {data.date}
                {data.store ? ` · สาขา ${storeNames.get(data.store) ?? data.store}` : ' · ทุกสาขา'}
              </div>
              <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />
              {[
                ['จำนวนบิล', String(data.billCount)],
                ['ยอดขายรวม', `${data.total.toFixed(2)} บาท`],
                ['เฉลี่ยต่อบิล', data.billCount ? `${data.avgTicket.toFixed(2)} บาท` : '-'],
                ['แต้มที่แจก', data.pointsIssued.toLocaleString()],
                ['บิลที่ระบบช่วย', `${data.assistedBillCount} บิล (${data.assistedTotal.toFixed(2)} บาท)`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
              {data.topProducts.length > 0 && (
                <>
                  <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />
                  <div style={{ fontSize: 12, fontWeight: 700 }}>สินค้าขายดี</div>
                  {data.topProducts.map((p) => (
                    <div key={p.productId} style={{ display: 'flex', fontSize: 12 }}>
                      <span style={{ flex: 1 }}>{p.name}</span>
                      <span>×{p.qty}</span>
                    </div>
                  ))}
                </>
              )}
              <div style={{ textAlign: 'center', fontSize: 10, marginTop: 8 }}>
                พิมพ์ {new Date().toLocaleString('th-TH')} · Smart Cam Sale
              </div>
            </div>
          </PrintPortal>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl px-2 py-2.5">
      <div className={cn('font-mono font-bold text-sm', accent ? 'text-neon-lime' : 'text-slate-100')}>
        {value}
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

// ─────────────────── PromptPay settings (รับเงินหน้าร้าน) ───────────────────

function PromptPaySettingsCard() {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiJson<{ promptpayId: string | null }>('/org/settings')
      .then((s) => {
        setSaved(s.promptpayId);
        setValue(s.promptpayId ?? '');
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const save = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await postJson<{ promptpayId: string | null }>('/org/settings', {
        promptpayId: value,
      });
      setSaved(res.promptpayId);
      setValue(res.promptpayId ?? '');
      setMsg(res.promptpayId ? 'บันทึกแล้ว — QR รับเงินจะขึ้นตอนปิดการขาย' : 'ปิดการแสดง QR รับเงินแล้ว');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2 mb-2">
        <Wallet className="w-4 h-4 text-neon-cyan" />
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex-1">
          รับเงินด้วย PromptPay
        </h3>
        {saved && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border text-emerald-300 border-emerald-400/40 bg-emerald-500/10">
            เปิดใช้อยู่
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-2">
        ใส่พร้อมเพย์ของร้าน (เบอร์มือถือ / เลขบัตรประชาชน / e-Wallet) — ระบบจะแสดง QR
        พร้อมยอดบิลให้ลูกค้าสแกนตอนปิดการขาย เงินเข้าบัญชีร้านตรง ไม่ผ่านคนกลาง · เว้นว่างเพื่อปิด
      </p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="เช่น 081-234-5678"
          className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
        />
        <button onClick={save} disabled={busy} className="btn-primary py-2 px-4 text-sm disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'บันทึก'}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-emerald-300">{msg}</p>}
      {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
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

// ─────────────────────────── stores ───────────────────────────

function StoresTab() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '' });
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = () =>
    apiJson<StoreRow[]>('/stores')
      .then(setStores)
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoaded(true));

  useEffect(() => {
    refresh();
  }, []);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      await postJson('/stores', form);
      setForm({ code: '', name: '' });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rename = async (s: StoreRow) => {
    const name = window.prompt(`ชื่อใหม่ของสาขา ${s.code}:`, s.name);
    if (!name) return;
    try {
      await postJson(`/stores/${s.id}`, { name }, 'PATCH');
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const remove = async (s: StoreRow) => {
    if (!window.confirm(`ลบสาขา "${s.name}"? (ประวัติการขายของสาขานี้ยังอยู่ครบ)`)) return;
    try {
      await apiJson(`/stores/${s.id}`, { method: 'DELETE' });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div>
      <ErrBanner msg={err} />
      <p className="text-xs text-slate-500 mb-4">
        รหัสสาขา (code) ใช้ผูกกับยอดขายจาก POS และการกรองรายงาน — ตั้งให้ตรงกับ storeCode ของ API key ในแท็บเชื่อม POS
      </p>
      <div className="glass p-4 mb-4 border-neon-cyan/20">
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <Input label="รหัสสาขา (a-z 0-9 - _) *" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder="BKK-01" />
          <Input label="ชื่อสาขา *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="สาขาลาดพร้าว" />
          <button onClick={create} disabled={busy || !form.code || !form.name} className="btn-primary py-2 px-4 text-sm disabled:opacity-40">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            เพิ่มสาขา
          </button>
        </div>
      </div>
      {!loaded ? (
        <Spinner />
      ) : (
        <div className="space-y-1">
          {stores.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border bg-white/[0.03] border-white/10 text-sm">
              <Store className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="font-mono text-neon-cyan w-24 truncate">{s.code}</span>
              <span className="flex-1 text-slate-100 truncate">{s.name}</span>
              <button onClick={() => rename(s)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => remove(s)} className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-300">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {stores.length === 0 && <div className="text-center text-slate-500 py-8 text-sm">ยังไม่มีสาขา</div>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── orgs (superadmin) ───────────────────────────

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  cameraEnabled: boolean;
  createdAt: string;
  memberCount: number;
  staffCount: number;
}

const EMPTY_ORG = { name: '', slug: '', adminUsername: '', adminPassword: '', cameraEnabled: true };

function OrgsTab() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_ORG });
  const [created, setCreated] = useState<{ name: string; bridgeToken: string; adminUsername: string } | null>(null);
  const [rotated, setRotated] = useState<{ orgId: string; bridgeToken: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = () =>
    apiJson<OrgRow[]>('/admin/orgs')
      .then(setOrgs)
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoaded(true));

  useEffect(() => {
    refresh();
  }, []);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson<{ name: string; bridgeToken: string; adminUsername: string }>(
        '/admin/orgs',
        form,
      );
      setCreated(res);
      setForm({ ...EMPTY_ORG });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const togglePlan = async (o: OrgRow) => {
    const next = o.plan === 'suspended' ? 'pilot' : 'suspended';
    const verb = next === 'suspended' ? 'ระงับ' : 'เปิดใช้งาน';
    if (!window.confirm(`${verb}องค์กร "${o.name}"?`)) return;
    try {
      await postJson(`/admin/orgs/${o.id}/plan`, { plan: next });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const toggleCamera = async (o: OrgRow) => {
    const next = !o.cameraEnabled;
    const verb = next ? 'เปิดกล้อง (อัปเกรดจาก Lite)' : 'ปิดกล้อง (ลดเป็น Lite)';
    if (!window.confirm(`${verb} ให้ "${o.name}"?`)) return;
    try {
      await postJson(`/admin/orgs/${o.id}/camera`, { enabled: next });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const rotate = async (o: OrgRow) => {
    if (!window.confirm(`ออก bridge token ใหม่ให้ "${o.name}"? token เดิมใช้ไม่ได้ทันที — ต้องอัปเดตที่เครื่อง bridge ของร้าน`)) return;
    try {
      const res = await postJson<{ orgId: string; bridgeToken: string }>(
        `/admin/orgs/${o.id}/rotate-bridge-token`,
        {},
      );
      setRotated(res);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <ErrBanner msg={err} />
      <div className="glass p-4 border-neon-cyan/20">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">เปิดองค์กรลูกค้าใหม่</h3>
        <div className="grid md:grid-cols-4 gap-3">
          <Input label="ชื่อองค์กร *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="ร้านกาแฟบ้านสวน" />
          <Input label="Slug (a-z 0-9 -) *" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} placeholder="baansuan" />
          <Input label="Username admin ร้าน *" value={form.adminUsername} onChange={(v) => setForm({ ...form, adminUsername: v })} />
          <Input label="รหัสผ่าน admin (8+) *" value={form.adminPassword} onChange={(v) => setForm({ ...form, adminPassword: v })} type="password" />
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!form.cameraEnabled}
            onChange={(e) => setForm({ ...form, cameraEnabled: !e.target.checked })}
            className="accent-cyan-400"
          />
          <Phone className="w-3.5 h-3.5 text-cyan-300" />
          แพ็กเกจ Lite — ไม่ใช้กล้อง (พนักงานค้นหาลูกค้าด้วยเบอร์โทร)
        </label>
        <button
          onClick={create}
          disabled={busy || !form.name || !form.slug || !form.adminUsername || form.adminPassword.length < 8}
          className="btn-primary mt-3 py-2 px-4 text-sm disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
          สร้างองค์กร
        </button>

        {created && (
          <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/[0.07] p-3 text-xs">
            <div className="text-amber-300 font-semibold mb-1.5">
              ⚠️ สร้าง "{created.name}" แล้ว — ข้อมูลนี้แสดงครั้งเดียว จดส่งให้ร้าน:
            </div>
            <div className="text-slate-200">Login: <code className="bg-black/40 px-1.5 rounded">{created.adminUsername}</code> + รหัสที่ตั้งไว้</div>
            <div className="mt-1 text-slate-200">Bridge token (ใส่ที่เครื่อง bridge ของร้าน):</div>
            <code className="block mt-1 font-mono text-slate-100 bg-black/40 rounded-lg px-3 py-2 break-all">{created.bridgeToken}</code>
          </div>
        )}
        {rotated && (
          <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/[0.07] p-3 text-xs">
            <div className="text-amber-300 font-semibold mb-1">⚠️ Bridge token ใหม่ (แสดงครั้งเดียว):</div>
            <code className="block font-mono text-slate-100 bg-black/40 rounded-lg px-3 py-2 break-all">{rotated.bridgeToken}</code>
          </div>
        )}
      </div>

      {!loaded ? (
        <Spinner />
      ) : (
        <div className="space-y-1">
          {orgs.map((o) => (
            <div
              key={o.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm',
                o.plan === 'suspended'
                  ? 'bg-rose-500/[0.04] border-rose-400/25 opacity-70'
                  : 'bg-white/[0.03] border-white/10',
              )}
            >
              <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-slate-100 truncate">{o.name}</div>
                <div className="text-[11px] text-slate-500 font-mono">{o.slug} · {o.id}</div>
              </div>
              <span className="text-[11px] text-slate-400 hidden md:block">
                สมาชิก {o.memberCount} · พนักงาน {o.staffCount}
              </span>
              {!o.cameraEnabled && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border text-cyan-300 border-cyan-400/40 bg-cyan-500/10">
                  LITE
                </span>
              )}
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border',
                  o.plan === 'suspended'
                    ? 'text-rose-300 border-rose-400/40'
                    : 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10',
                )}
              >
                {o.plan}
              </span>
              <button
                onClick={() => toggleCamera(o)}
                title={o.cameraEnabled ? 'ลดเป็น Lite (ปิดกล้อง)' : 'อัปเกรด — เปิดกล้อง'}
                className={cn(
                  'p-1.5 rounded-lg hover:bg-white/10',
                  o.cameraEnabled ? 'text-slate-400' : 'text-cyan-300',
                )}
              >
                {o.cameraEnabled ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => rotate(o)} title="ออก bridge token ใหม่" className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => togglePlan(o)}
                title={o.plan === 'suspended' ? 'เปิดใช้งาน' : 'ระงับ'}
                className={cn(
                  'p-1.5 rounded-lg',
                  o.plan === 'suspended'
                    ? 'hover:bg-emerald-500/20 text-emerald-300'
                    : 'hover:bg-rose-500/20 text-rose-300',
                )}
              >
                {o.plan === 'suspended' ? <Play className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── billing ───────────────────────────

interface Usage {
  orgName: string;
  period: string;
  stores: number;
  billableStores: number;
  pricePerStore: number;
  estimatedAmount: number;
  members: number;
  newMembers: number;
  visits: number;
  purchases: number;
  salesTotal: number;
}

interface InvoiceRow {
  id: string;
  number: string;
  period: string;
  amount: number;
  status: string;
  note: string | null;
  dueDate: string | null;
  issuedAt: string;
  paidAt: string | null;
  org?: { name: string; slug: string } | null;
}

interface Roi {
  period: string;
  method: string;
  recognitions: number;
  assisted: { count: number; total: number; avgTicket: number };
  unassisted: { count: number; total: number; avgTicket: number };
  upliftPerBill: number | null;
  estimatedUpliftTotal: number;
  subscriptionCost: number;
  roiMultiple: number | null;
}

interface LeadRow {
  id: string;
  name: string;
  storeName: string;
  phone: string;
  email: string | null;
  message: string | null;
  status: string;
  createdAt: string;
}

const INV_STATUS: Record<string, string> = {
  draft: 'text-slate-400 border-white/15',
  sent: 'text-amber-300 border-amber-400/40 bg-amber-500/10',
  paid: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10',
  void: 'text-rose-300 border-rose-400/30 opacity-60',
};

function BillingTab({ superadmin }: { superadmin: boolean }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [roi, setRoi] = useState<Roi | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [genOrg, setGenOrg] = useState('');
  const [genPeriod, setGenPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [genAmount, setGenAmount] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    apiJson<Usage>('/billing/usage').then(setUsage).catch(() => {});
    apiJson<Roi>('/billing/roi').then(setRoi).catch(() => {});
    if (superadmin) {
      apiJson<InvoiceRow[]>('/admin/billing/invoices').then(setInvoices).catch((e) => setErr((e as Error).message));
      apiJson<LeadRow[]>('/admin/signups').then(setLeads).catch(() => {});
      apiJson<OrgRow[]>('/admin/orgs').then(setOrgs).catch(() => {});
    } else {
      apiJson<InvoiceRow[]>('/billing/invoices').then(setInvoices).catch((e) => setErr((e as Error).message));
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async () => {
    if (!genOrg) return;
    setBusy(true);
    setErr(null);
    try {
      await postJson('/admin/billing/invoices', {
        orgId: genOrg,
        period: genPeriod,
        amount: genAmount ? Number(genAmount) : undefined,
      });
      setGenAmount('');
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setInvStatus = async (inv: InvoiceRow, status: string) => {
    try {
      await postJson(`/admin/billing/invoices/${inv.id}/status`, { status });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const setLeadStatus = async (lead: LeadRow, status: string) => {
    try {
      await postJson(`/admin/signups/${lead.id}/status`, { status });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const roiPct =
    roi && roi.upliftPerBill !== null && roi.unassisted.avgTicket > 0
      ? Math.round((roi.upliftPerBill / roi.unassisted.avgTicket) * 100)
      : null;
  const maxAvg = roi ? Math.max(roi.assisted.avgTicket, roi.unassisted.avgTicket, 1) : 1;

  return (
    <div className="space-y-5">
      <ErrBanner msg={err} />

      {roi && (
        <div className="glass p-4 border-lime-400/25">
          <h3 className="text-xs font-semibold text-neon-lime uppercase tracking-wide mb-3">
            📈 ผลตอบแทนจากระบบ (ROI) — {roi.period}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard label={`ยอดขายที่ระบบมีส่วนช่วย (${roi.assisted.count} บิล)`} value={formatThb(roi.assisted.total)} />
            <StatCard
              label="ยอดส่วนเพิ่มโดยประมาณ"
              value={roi.upliftPerBill !== null ? formatThb(roi.estimatedUpliftTotal) : '—'}
            />
            <StatCard
              label={`เทียบค่าบริการ ${formatThb(roi.subscriptionCost)}`}
              value={roi.roiMultiple !== null && roi.estimatedUpliftTotal > 0 ? `คุ้ม ${roi.roiMultiple.toFixed(1)}×` : '—'}
            />
            <StatCard label="ครั้งที่ระบบจำลูกค้าได้" value={roi.recognitions.toLocaleString()} />
          </div>

          {(roi.assisted.count > 0 || roi.unassisted.count > 0) && (
            <div className="space-y-2 mb-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-56 shrink-0 text-slate-300">บิลหลังระบบจำลูกค้าได้ (เฉลี่ย)</span>
                <div className="flex-1 h-4 rounded bg-white/[0.04] overflow-hidden">
                  <div className="h-full rounded bg-gradient-to-r from-lime-400/80 to-emerald-400/80" style={{ width: `${(roi.assisted.avgTicket / maxAvg) * 100}%` }} />
                </div>
                <span className="font-mono text-neon-lime w-24 text-right shrink-0">
                  {roi.assisted.count > 0 ? formatThb(roi.assisted.avgTicket) : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-56 shrink-0 text-slate-400">บิลสมาชิกอื่น ๆ (เฉลี่ย)</span>
                <div className="flex-1 h-4 rounded bg-white/[0.04] overflow-hidden">
                  <div className="h-full rounded bg-slate-500/60" style={{ width: `${(roi.unassisted.avgTicket / maxAvg) * 100}%` }} />
                </div>
                <span className="font-mono text-slate-300 w-24 text-right shrink-0">
                  {roi.unassisted.count > 0 ? formatThb(roi.unassisted.avgTicket) : '—'}
                </span>
              </div>
              {roiPct !== null && (
                <div className={cn('text-xs font-semibold', roiPct >= 0 ? 'text-neon-lime' : 'text-amber-300')}>
                  {roiPct >= 0 ? `▲ บิลที่ระบบช่วย สูงกว่าเฉลี่ย ${roiPct}%` : `▼ ต่ำกว่าเฉลี่ย ${Math.abs(roiPct)}% — ข้อมูลยังน้อย รอสะสมเพิ่ม`}
                </div>
              )}
            </div>
          )}
          {roi.assisted.count === 0 && roi.unassisted.count === 0 && (
            <div className="text-sm text-slate-500 py-2">ยังไม่มีบิลเดือนนี้ — ตัวเลขจะเริ่มสะสมเมื่อมีการขายจริง</div>
          )}
          <p className="text-[11px] text-slate-500 mt-2">{roi.method}</p>
        </div>
      )}

      {usage && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            การใช้งานเดือนนี้ ({usage.period})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label={`ค่าบริการโดยประมาณ (${usage.billableStores} สาขา × ${formatThb(usage.pricePerStore)})`} value={formatThb(usage.estimatedAmount)} />
            <StatCard label="ลูกค้าเดินเข้าร้าน (visits)" value={usage.visits.toLocaleString()} />
            <StatCard label={`สมาชิก (ใหม่ +${usage.newMembers})`} value={usage.members.toLocaleString()} />
            <StatCard label={`ยอดขายผ่านระบบ (${usage.purchases} บิล)`} value={formatThb(usage.salesTotal)} />
          </div>
        </div>
      )}

      {superadmin && (
        <div className="glass p-4 border-neon-cyan/20">
          <h3 className="text-sm font-semibold text-slate-100 mb-3">ออกใบแจ้งหนี้</h3>
          <div className="grid md:grid-cols-4 gap-3 items-end">
            <label className="block">
              <span className="text-[11px] text-slate-400 uppercase tracking-wide">องค์กร *</span>
              <select
                value={genOrg}
                onChange={(e) => setGenOrg(e.target.value)}
                className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
              >
                <option value="" className="bg-ink-900">— เลือกองค์กร —</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id} className="bg-ink-900">{o.name}</option>
                ))}
              </select>
            </label>
            <Input label="งวด (YYYY-MM)" value={genPeriod} onChange={setGenPeriod} />
            <Input label="ยอดกำหนดเอง (เว้น = คิดตามสาขา)" value={genAmount} onChange={setGenAmount} type="number" />
            <button onClick={generate} disabled={busy || !genOrg} className="btn-primary py-2 px-4 text-sm disabled:opacity-40">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
              ออกใบแจ้งหนี้
            </button>
          </div>
        </div>
      )}

      <div className="glass p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          ใบแจ้งหนี้{superadmin ? 'ทั้งหมด' : 'ของร้าน'}
        </h3>
        {invoices.length === 0 && <div className="text-sm text-slate-500 py-4 text-center">ยังไม่มีใบแจ้งหนี้</div>}
        <div className="space-y-1.5">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-white/5 last:border-0">
              <span className="font-mono text-[12px] text-slate-300 w-36 shrink-0">{inv.number}</span>
              {superadmin && <span className="text-slate-300 w-32 truncate shrink-0">{inv.org?.name ?? inv.id}</span>}
              <span className="font-mono text-[11px] text-slate-500 w-16 shrink-0">{inv.period}</span>
              <span className="flex-1 text-[11px] text-slate-500 truncate">{inv.note ?? ''}</span>
              <span className="font-mono text-neon-cyan w-24 text-right shrink-0">{formatThb(inv.amount)}</span>
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full border w-14 text-center shrink-0', INV_STATUS[inv.status] ?? '')}>
                {inv.status}
              </span>
              {superadmin && inv.status !== 'void' && (
                <span className="flex gap-1 shrink-0">
                  {inv.status === 'draft' && (
                    <button onClick={() => setInvStatus(inv, 'sent')} className="text-[10px] px-2 py-0.5 rounded border border-amber-400/40 text-amber-300 hover:bg-amber-500/10">ส่งแล้ว</button>
                  )}
                  {inv.status !== 'paid' && (
                    <button onClick={() => setInvStatus(inv, 'paid')} className="text-[10px] px-2 py-0.5 rounded border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10">รับเงิน</button>
                  )}
                  <button onClick={() => setInvStatus(inv, 'void')} className="text-[10px] px-2 py-0.5 rounded border border-rose-400/30 text-rose-300 hover:bg-rose-500/10">void</button>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {superadmin && (
        <div className="glass p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Inbox className="w-3.5 h-3.5" /> คำขอเปิดใช้งานจากหน้าเว็บ ({leads.filter((l) => l.status === 'new').length} ใหม่)
          </h3>
          {leads.length === 0 && <div className="text-sm text-slate-500 py-4 text-center">ยังไม่มีคำขอ</div>}
          <div className="space-y-1.5">
            {leads.map((l) => (
              <div key={l.id} className="flex items-start gap-3 text-sm py-2 border-b border-white/5 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-slate-100">
                    {l.storeName} <span className="text-slate-400">— {l.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {l.phone}{l.email ? ` · ${l.email}` : ''} · {new Date(l.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                  {l.message && <div className="text-[12px] text-slate-400 mt-0.5 truncate">{l.message}</div>}
                </div>
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border shrink-0',
                  l.status === 'new' ? 'text-neon-cyan border-cyan-400/40 bg-cyan-500/10'
                    : l.status === 'converted' ? 'text-emerald-300 border-emerald-400/40'
                    : l.status === 'rejected' ? 'text-rose-300 border-rose-400/30 opacity-60'
                    : 'text-amber-300 border-amber-400/40',
                )}>
                  {l.status}
                </span>
                {l.status !== 'converted' && l.status !== 'rejected' && (
                  <span className="flex gap-1 shrink-0">
                    {l.status === 'new' && (
                      <button onClick={() => setLeadStatus(l, 'contacted')} className="text-[10px] px-2 py-0.5 rounded border border-amber-400/40 text-amber-300 hover:bg-amber-500/10">ติดต่อแล้ว</button>
                    )}
                    <button onClick={() => setLeadStatus(l, 'converted')} className="text-[10px] px-2 py-0.5 rounded border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10">ปิดดีล</button>
                    <button onClick={() => setLeadStatus(l, 'rejected')} className="text-[10px] px-2 py-0.5 rounded border border-rose-400/30 text-rose-300 hover:bg-rose-500/10">ไม่สนใจ</button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
