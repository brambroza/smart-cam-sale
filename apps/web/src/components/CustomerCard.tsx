import * as React from 'react';
import { motion } from 'framer-motion';
import { Crown, Sparkles, User, Users, ShoppingBag, Clock, TrendingUp, UserPlus, Lock } from 'lucide-react';
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
}: {
  result: RecognitionResult;
  held?: HeldSlice;
  compact?: boolean;
}) {
  // Merge live-smoothed fields (age/matchConfidence/bbox) with held display data
  const displayMember = held?.member ?? result.member;
  const displayScript = held?.suggestedScript ?? result.suggestedScript;
  const displayPurchases = held?.recentPurchases ?? result.recentPurchases;
  const displayRecs = held?.recommendations ?? result.recommendations;
  const isMember = result.isMember && displayMember;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ type: 'spring', stiffness: 220, damping: 28 }}
      className={cn(
        'glass-strong shadow-card relative overflow-hidden',
        compact ? 'p-3' : 'p-5',
      )}
    >
      <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-gradient-to-br from-violet-500/30 to-cyan-400/20 blur-3xl" />

      <div className="relative flex items-start gap-4">
        <motion.div
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          className={cn(
            'w-16 h-16 rounded-2xl grid place-items-center shadow-glow',
            isMember ? `tier-${displayMember!.tier}` : 'bg-white/10',
          )}
        >
          {isMember ? <Crown className="w-8 h-8" /> : <User className="w-8 h-8 text-slate-300" />}
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold truncate">
              {isMember ? displayMember!.displayName : 'ลูกค้าใหม่'}
            </h2>
            {isMember && (
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', `tier-${displayMember!.tier}`)}>
                {displayMember!.tier.toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 truncate">
            {isMember ? displayMember!.fullName : 'ยังไม่ใช่สมาชิก · ชวนสมัครวันนี้'}
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge icon={<User className="w-3.5 h-3.5" />}>
              อายุ ~ {result.estimatedAge} ปี · {ageBucketLabel(result.ageBucket)}
            </Badge>
            <Badge icon={<Users className="w-3.5 h-3.5" />}>
              {result.gender === 'male' ? 'ชาย' : result.gender === 'female' ? 'หญิง' : 'ไม่ระบุ'}
            </Badge>
            {result.matchConfidence !== undefined && (
              <Badge icon={<Sparkles className="w-3.5 h-3.5 text-neon-lime" />}>
                match {(result.matchConfidence * 100).toFixed(0)}%
              </Badge>
            )}
          </div>
        </div>
      </div>

      {!compact && isMember && (
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat label="แต้มสะสม" value={displayMember!.points.toLocaleString()} accent="text-neon-cyan" />
          <Stat label="ยอดซื้อรวม" value={formatThb(displayMember!.totalSpend)} accent="text-neon-lime" />
          <Stat label="เข้าร้าน" value={`${displayMember!.visitCount} ครั้ง`} accent="text-neon-violet" />
        </div>
      )}

      {compact ? (
        // Compact secondary face — show only top recommendation + script hint
        displayRecs[0] && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
            <TrendingUp className="w-3.5 h-3.5 text-neon-lime shrink-0" />
            <span className="truncate">
              แนะ <span className="font-semibold text-slate-100">{displayRecs[0].name}</span> · {formatThb(displayRecs[0].price)}
            </span>
          </div>
        )
      ) : (
        <>
          <div className="mt-5">
            <SectionHeader
              icon={<Sparkles className="w-4 h-4 text-neon-violet" />}
              title="สคริปต์แนะนำพนักงาน"
              badge={held ? <HoldChip since={held.heldSince} /> : undefined}
            />
            <motion.div
              key={displayScript}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="mt-2 p-3 rounded-xl border border-violet-400/30 bg-violet-500/10 text-slate-100 leading-relaxed"
            >
              <span className="font-medium">"{displayScript}"</span>
            </motion.div>
          </div>

          {displayPurchases.length > 0 && (
            <div className="mt-5">
              <SectionHeader icon={<Clock className="w-4 h-4 text-neon-cyan" />} title="ประวัติซื้อ" />
              <ul className="mt-2 space-y-1.5">
                {displayPurchases.slice(0, 3).map((p) => (
                  <li key={p.productId} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-white/[0.03]">
                    <span className="truncate">{p.productName}</span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {p.totalTimes}× · {relativeTime(p.lastBoughtAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5">
            <SectionHeader
              icon={<TrendingUp className="w-4 h-4 text-neon-lime" />}
              title={isMember ? 'แนะนำสำหรับลูกค้าคนนี้' : 'สินค้ายอดนิยมช่วงนี้'}
            />
            <div className="mt-3 grid grid-cols-1 gap-2">
              {displayRecs.map((r, i) => (
                <motion.div
                  key={r.productId}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400/30 to-violet-500/30 grid place-items-center">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold truncate">{r.name}</span>
                      <span className="text-sm font-mono text-neon-cyan">{formatThb(r.price)}</span>
                    </div>
                    <div className="text-xs text-slate-400 truncate">{r.reason}</div>
                  </div>
                  <ScoreBar score={r.score} />
                </motion.div>
              ))}
            </div>
          </div>

          {!isMember && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-5 w-full btn-primary justify-center py-3 text-base"
            >
              <UserPlus className="w-5 h-5" /> ชวนสมัครสมาชิกฟรี · รับส่วนลด 10%
            </motion.button>
          )}
        </>
      )}
    </motion.div>
  );
}

function Badge({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10">
      {icon}
      {children}
    </span>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="glass px-3 py-2.5">
      <div className={cn('font-mono font-bold text-lg', accent)}>{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
      {icon}
      <span>{title}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
      {badge}
    </div>
  );
}

function HoldChip({ since }: { since: number }) {
  const HOLD_MS = 10_000;
  return (
    <motion.span
      key={since}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/30 text-[10px] text-violet-200"
    >
      <Lock className="w-2.5 h-2.5" />
      <span className="normal-case tracking-normal">
        <CountdownText total={HOLD_MS} start={since} />
      </span>
    </motion.span>
  );
}

function CountdownText({ total, start }: { total: number; start: number }) {
  const [remaining, setRemaining] = React.useState(() => Math.max(0, total - (Date.now() - start)));
  React.useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, total - (Date.now() - start)));
    }, 500);
    return () => clearInterval(id);
  }, [total, start]);
  return <>ล็อค {(remaining / 1000).toFixed(0)}s</>;
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="w-14 h-1.5 rounded-full bg-white/10 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(score * 100)}%` }}
        transition={{ duration: 0.6 }}
        className="h-full bg-gradient-to-r from-cyan-400 to-violet-500"
      />
    </div>
  );
}
