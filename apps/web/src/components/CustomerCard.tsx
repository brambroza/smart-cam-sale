import * as React from 'react';
import { motion } from 'framer-motion';
import { Award, User, ShoppingBag, Clock, TrendingUp, UserPlus, Lock } from 'lucide-react';
import type { RecognitionResult, MemberProfile, PurchaseSummary, RecommendedProduct } from '@smart-cam/shared-types';
import { ageBucketLabel, cn, formatThb, relativeTime } from '../lib/utils';

interface HeldSlice {
  suggestedScript: string;
  recentPurchases: PurchaseSummary[];
  recommendations: RecommendedProduct[];
  member?: MemberProfile;
  heldSince: number;
}

export function CustomerCard({
  result,
  held,
  compact = false,
  onEnroll,
}: {
  result: RecognitionResult;
  held?: HeldSlice;
  compact?: boolean;
  onEnroll?: () => void;
}) {
  const displayMember = held?.member ?? result.member;
  const displayScript = held?.suggestedScript ?? result.suggestedScript;
  const displayPurchases = held?.recentPurchases ?? result.recentPurchases;
  const displayRecs = held?.recommendations ?? result.recommendations;
  const isMember = result.isMember && displayMember;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 240, damping: 30 }}
      className={cn(
        'surface-raised relative overflow-hidden',
        compact ? 'p-3' : 'p-5',
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'w-14 h-14 rounded-md grid place-items-center flex-shrink-0',
            isMember ? `tier-${displayMember!.tier}` : 'bg-paper-200 text-ink-500',
          )}
        >
          {isMember ? <Award className="w-6 h-6" /> : <User className="w-6 h-6" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-[22px] leading-tight font-bold text-ink-900 truncate">
              {isMember ? displayMember!.displayName : 'ลูกค้าใหม่'}
            </h2>
            {isMember && (
              <span
                className={cn(
                  'text-[9.5px] font-bold px-1.5 py-0.5 rounded tracking-widest uppercase',
                  `tier-${displayMember!.tier}`,
                )}
              >
                {displayMember!.tier}
              </span>
            )}
          </div>
          <p className="text-sm text-ink-500 truncate mt-0.5">
            {isMember ? displayMember!.fullName : 'ยังไม่ใช่สมาชิก'}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip>
              อายุ ~ {result.estimatedAge} · {ageBucketLabel(result.ageBucket)}
            </Chip>
            <Chip>
              {result.gender === 'male' ? 'ชาย' : result.gender === 'female' ? 'หญิง' : 'ไม่ระบุ'}
            </Chip>
            {result.matchConfidence !== undefined && (
              <Chip tone="moss">match {(result.matchConfidence * 100).toFixed(0)}%</Chip>
            )}
          </div>
        </div>
      </div>

      {/* Member stats row */}
      {!compact && isMember && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="แต้ม" value={displayMember!.points.toLocaleString()} tone="terracotta" />
          <Stat label="ยอดซื้อรวม" value={formatThb(displayMember!.totalSpend)} tone="moss" />
          <Stat label="เข้าร้าน" value={`${displayMember!.visitCount}×`} tone="brass" />
        </div>
      )}

      {/* Compact tail */}
      {compact ? (
        displayRecs[0] && (
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-700">
            <TrendingUp className="w-3.5 h-3.5 text-moss shrink-0" />
            <span className="truncate">
              แนะ <span className="font-semibold text-ink-900">{displayRecs[0].name}</span> · {formatThb(displayRecs[0].price)}
            </span>
          </div>
        )
      ) : (
        <>
          <Divider />

          {/* Script */}
          <SectionHead
            title="สคริปต์แนะนำพนักงาน"
            badge={held ? <HoldChip since={held.heldSince} /> : undefined}
          />
          <motion.div
            key={displayScript}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="mt-2 p-3 rounded-md bg-terracotta-tint border border-terracotta/25 text-ink-900 leading-relaxed font-display"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            <span className="text-terracotta-deep font-serif text-lg leading-none mr-1">“</span>
            {displayScript}
            <span className="text-terracotta-deep font-serif text-lg leading-none ml-1">”</span>
          </motion.div>

          {displayPurchases.length > 0 && (
            <>
              <Divider />
              <SectionHead title="ประวัติซื้อ" icon={<Clock className="w-3.5 h-3.5" />} />
              <ul className="mt-2 space-y-1">
                {displayPurchases.slice(0, 3).map((p) => (
                  <li
                    key={p.productId}
                    className="flex items-center justify-between text-sm py-1.5 px-2 rounded"
                  >
                    <span className="truncate text-ink-900">{p.productName}</span>
                    <span className="text-xs font-mono text-ink-500 shrink-0">
                      {p.totalTimes}× · {relativeTime(p.lastBoughtAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <Divider />

          <SectionHead
            title={isMember ? 'แนะนำสำหรับลูกค้าคนนี้' : 'สินค้ายอดนิยมช่วงนี้'}
            icon={<TrendingUp className="w-3.5 h-3.5" />}
          />
          <div className="mt-2 space-y-1.5">
            {displayRecs.map((r, i) => (
              <motion.div
                key={r.productId}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i }}
                className="flex items-center gap-3 p-2.5 rounded surface-sunken"
              >
                <div className="w-9 h-9 rounded bg-paper-300 grid place-items-center text-ink-700 shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-ink-900 truncate">{r.name}</span>
                    <span className="text-sm font-mono text-terracotta-deep">
                      {formatThb(r.price)}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-500 truncate">{r.reason}</div>
                </div>
                <ScoreBar score={r.score} />
              </motion.div>
            ))}
          </div>

          {!isMember && (
            <button
              onClick={onEnroll}
              className="mt-4 w-full btn-primary justify-center py-2.5 text-sm"
            >
              <UserPlus className="w-4 h-4" /> ชวนสมัครสมาชิก · รับส่วนลด 10%
            </button>
          )}
        </>
      )}
    </motion.div>
  );
}

function Chip({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'moss' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border font-medium',
        tone === 'moss'
          ? 'bg-moss-tint text-moss-deep border-moss/30'
          : 'bg-paper-200 text-ink-700 border-paper-400',
      )}
    >
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'terracotta' | 'moss' | 'brass';
}) {
  const color =
    tone === 'terracotta'
      ? 'text-terracotta-deep'
      : tone === 'moss'
        ? 'text-moss-deep'
        : 'text-brass-deep';
  return (
    <div className="surface-sunken px-2.5 py-2">
      <div className={cn('font-mono font-bold text-[15px] tabular-nums', color)}>{value}</div>
      <div className="label-eyebrow mt-1">{label}</div>
    </div>
  );
}

function SectionHead({
  title,
  icon,
  badge,
}: {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mt-3">
      {icon && <span className="text-ink-500">{icon}</span>}
      <span className="label-eyebrow">{title}</span>
      <div className="flex-1 perforated" />
      {badge}
    </div>
  );
}

function Divider() {
  return <div className="my-3 perforated" />;
}

function HoldChip({ since }: { since: number }) {
  const HOLD_MS = 10_000;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brass-tint text-brass-deep text-[10px] font-mono border border-brass/30">
      <Lock className="w-2.5 h-2.5" />
      <CountdownText total={HOLD_MS} start={since} />
    </span>
  );
}

function CountdownText({ total, start }: { total: number; start: number }) {
  const [remaining, setRemaining] = React.useState(() =>
    Math.max(0, total - (Date.now() - start)),
  );
  React.useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, total - (Date.now() - start)));
    }, 500);
    return () => clearInterval(id);
  }, [total, start]);
  return <>hold {(remaining / 1000).toFixed(0)}s</>;
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="w-12 h-1 rounded-full bg-paper-400 overflow-hidden shrink-0">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(score * 100)}%` }}
        transition={{ duration: 0.5 }}
        className="h-full bg-terracotta"
      />
    </div>
  );
}
