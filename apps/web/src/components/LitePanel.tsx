import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  Search,
  Loader2,
  UserPlus,
  ShoppingCart,
  Sparkles,
  History,
  Star,
  CheckCircle2,
} from 'lucide-react';
import { apiJson, postJson } from '../lib/api';
import { formatThb, cn } from '../lib/utils';
import { SaleModal } from './SaleModal';
import type { MemberProfile, PurchaseSummary, RecommendedProduct } from '@smart-cam/shared-types';

type LookupResult =
  | { found: false }
  | {
      found: true;
      member: MemberProfile;
      recentPurchases: PurchaseSummary[];
      recommendations: RecommendedProduct[];
      suggestedScript: string;
    };

const TIER_STYLE: Record<string, string> = {
  bronze: 'text-amber-300 border-amber-400/40 bg-amber-500/10',
  silver: 'text-slate-200 border-slate-300/40 bg-slate-400/10',
  gold: 'text-yellow-300 border-yellow-400/40 bg-yellow-500/10',
  platinum: 'text-cyan-200 border-cyan-300/40 bg-cyan-400/10',
};

/**
 * แพ็กเกจ Lite: ระบุลูกค้าด้วยเบอร์โทรแทนกล้อง — ใช้เอนจินเดิมทั้งหมด
 * (ประวัติซื้อ สินค้าแนะนำ สคริปต์ AI แต้มสะสม) เพียงเปลี่ยนวิธีค้นหา
 */
export function LitePanel() {
  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // enroll-lite form (แสดงเมื่อไม่พบเบอร์)
  const [enroll, setEnroll] = useState({ fullName: '', displayName: '', birthYear: '', gender: 'unknown' });
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [enrolled, setEnrolled] = useState(false);

  const lookup = async (p?: string) => {
    const q = (p ?? phone).trim();
    if (q.replace(/[^0-9+]/g, '').length < 9) {
      setError('กรอกเบอร์โทรอย่างน้อย 9 หลัก');
      return;
    }
    setSearching(true);
    setError(null);
    setEnrolled(false);
    try {
      const res = await apiJson<LookupResult>(`/members/lookup?phone=${encodeURIComponent(q)}`);
      setResult(res);
      if (!res.found) setEnroll({ fullName: '', displayName: '', birthYear: '', gender: 'unknown' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const submitEnroll = async () => {
    setEnrollBusy(true);
    setError(null);
    try {
      await postJson('/members/enroll-lite', {
        fullName: enroll.fullName,
        displayName: enroll.displayName,
        phone,
        gender: enroll.gender,
        birthYear: enroll.birthYear ? Number(enroll.birthYear) : undefined,
      });
      setEnrolled(true);
      await lookup(); // ดึงโปรไฟล์ที่เพิ่งสร้างขึ้นมาแสดงทันที
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnrollBusy(false);
    }
  };

  const member = result?.found ? result.member : null;

  return (
    <div className="flex flex-col gap-4">
      {/* ค้นหาด้วยเบอร์โทร */}
      <div className="glass-strong p-5 border-cyan-400/20">
        <div className="flex items-center gap-2 mb-3">
          <Phone className="w-4 h-4 text-neon-cyan" />
          <h2 className="font-display font-bold text-slate-100">ค้นหาลูกค้าด้วยเบอร์โทร</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full border text-cyan-300 border-cyan-400/40 bg-cyan-500/10">
            LITE
          </span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup();
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            autoFocus
            placeholder="08x-xxx-xxxx"
            className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-xl font-mono tracking-widest text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={searching}
            className="btn-primary px-5 justify-center disabled:opacity-40"
          >
            {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            ค้นหา
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
        {enrolled && (
          <p className="mt-2 text-xs text-emerald-300 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> สมัครสมาชิกแล้ว +100 แต้มต้อนรับ
          </p>
        )}
      </div>

      <AnimatePresence mode="wait">
        {result?.found && member && (
          <motion.div
            key={member.memberId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-strong p-5 border-emerald-400/20 space-y-4"
          >
            {/* โปรไฟล์สมาชิก */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display font-bold text-2xl text-slate-100">
                  {member.displayName}
                </div>
                <div className="text-sm text-slate-400">{member.fullName}</div>
                <div className="mt-1 text-xs text-slate-500">
                  สมาชิกตั้งแต่ {new Date(member.memberSince).toLocaleDateString('th-TH')} · ซื้อ{' '}
                  {member.visitCount} ครั้ง · รวม {formatThb(member.totalSpend)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span
                  className={cn(
                    'text-[11px] px-2.5 py-1 rounded-full border font-semibold uppercase',
                    TIER_STYLE[member.tier] ?? TIER_STYLE.bronze,
                  )}
                >
                  {member.tier}
                </span>
                <div className="mt-2 font-mono font-bold text-xl text-neon-lime">
                  {member.points.toLocaleString()} <span className="text-xs text-slate-400">แต้ม</span>
                </div>
              </div>
            </div>

            {/* สคริปต์แนะนำจาก AI */}
            {result.suggestedScript && (
              <div className="rounded-xl border border-violet-400/30 bg-violet-500/[0.08] p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-violet-300 font-semibold mb-1">
                  <Sparkles className="w-3.5 h-3.5" /> พูดกับลูกค้า
                </div>
                <p className="text-sm text-slate-100 leading-relaxed">{result.suggestedScript}</p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              {/* ประวัติซื้อล่าสุด */}
              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold mb-1.5">
                  <History className="w-3.5 h-3.5" /> ซื้อบ่อย
                </div>
                {result.recentPurchases.length === 0 ? (
                  <p className="text-xs text-slate-500">ยังไม่มีประวัติซื้อ</p>
                ) : (
                  <div className="space-y-1">
                    {result.recentPurchases.map((p) => (
                      <div
                        key={p.productId}
                        className="flex items-center justify-between text-xs bg-white/[0.03] border border-white/10 rounded-lg px-2.5 py-1.5"
                      >
                        <span className="text-slate-200 truncate">{p.productName}</span>
                        <span className="text-slate-500 font-mono shrink-0 ml-2">×{p.totalTimes}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* สินค้าแนะนำ */}
              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold mb-1.5">
                  <Star className="w-3.5 h-3.5" /> แนะนำวันนี้
                </div>
                {result.recommendations.length === 0 ? (
                  <p className="text-xs text-slate-500">ยังไม่มีสินค้าแนะนำ</p>
                ) : (
                  <div className="space-y-1">
                    {result.recommendations.slice(0, 4).map((r) => (
                      <div
                        key={r.productId}
                        className="flex items-center justify-between text-xs bg-white/[0.03] border border-white/10 rounded-lg px-2.5 py-1.5"
                      >
                        <span className="text-slate-200 truncate">{r.name}</span>
                        <span className="text-neon-cyan font-mono shrink-0 ml-2">{formatThb(r.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSaleOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-br from-lime-400 to-emerald-400 text-ink-950 font-bold shadow-glow hover:opacity-90 transition"
            >
              <ShoppingCart className="w-5 h-5" />
              บันทึกการขาย · {member.displayName}
            </button>
          </motion.div>
        )}

        {result && !result.found && (
          <motion.div
            key="not-found"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-strong p-5 border-amber-400/20"
          >
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-amber-300" />
              <h3 className="font-semibold text-slate-100">ไม่พบเบอร์นี้ — สมัครสมาชิกใหม่เลย</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <LiteField label="ชื่อ-นามสกุล *">
                <input
                  value={enroll.fullName}
                  onChange={(e) => setEnroll({ ...enroll, fullName: e.target.value })}
                  className="lite-input"
                  placeholder="สมหญิง ใจดี"
                />
              </LiteField>
              <LiteField label="ชื่อเล่น (ไว้เรียกลูกค้า) *">
                <input
                  value={enroll.displayName}
                  onChange={(e) => setEnroll({ ...enroll, displayName: e.target.value })}
                  className="lite-input"
                  placeholder="คุณหญิง"
                />
              </LiteField>
              <LiteField label="เพศ">
                <select
                  value={enroll.gender}
                  onChange={(e) => setEnroll({ ...enroll, gender: e.target.value })}
                  className="lite-input"
                >
                  <option value="unknown" className="bg-ink-900">ไม่ระบุ</option>
                  <option value="female" className="bg-ink-900">หญิง</option>
                  <option value="male" className="bg-ink-900">ชาย</option>
                </select>
              </LiteField>
              <LiteField label="ปีเกิด (ค.ศ.)">
                <input
                  value={enroll.birthYear}
                  onChange={(e) => setEnroll({ ...enroll, birthYear: e.target.value.replace(/\D/g, '') })}
                  className="lite-input"
                  placeholder="1995"
                  inputMode="numeric"
                />
              </LiteField>
            </div>
            <button
              onClick={submitEnroll}
              disabled={enrollBusy || !enroll.fullName.trim() || !enroll.displayName.trim()}
              className="btn-primary mt-3 py-2.5 px-5 disabled:opacity-40"
            >
              {enrollBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              สมัครสมาชิก (รับ 100 แต้มต้อนรับ)
            </button>
            <p className="mt-2 text-[11px] text-slate-500">
              เก็บเฉพาะชื่อและเบอร์โทรเพื่อระบบสมาชิก — ไม่เก็บข้อมูลใบหน้า
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <SaleModal
        open={saleOpen}
        onClose={() => {
          setSaleOpen(false);
          // รีเฟรชแต้ม/ประวัติหลังปิดหน้าขาย
          if (member) void lookup();
        }}
        member={member}
      />
    </div>
  );
}

function LiteField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}
