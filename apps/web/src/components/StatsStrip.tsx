import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserCheck, UserX, Store } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface Stats {
  totalMembers: number;
  memberVisits24h: number;
  guestVisits24h: number;
}

export function StatsStrip() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchStats = () =>
      apiFetch('/members/stats')
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {});
    fetchStats();
    const id = setInterval(fetchStats, 15000);
    return () => clearInterval(id);
  }, []);

  const items = [
    { label: 'สมาชิกทั้งหมด', value: stats?.totalMembers ?? '—', icon: Users, accent: 'from-violet-500 to-fuchsia-400' },
    { label: 'สมาชิกวันนี้', value: stats?.memberVisits24h ?? '—', icon: UserCheck, accent: 'from-cyan-400 to-emerald-400' },
    { label: 'ลูกค้าใหม่วันนี้', value: stats?.guestVisits24h ?? '—', icon: UserX, accent: 'from-amber-400 to-rose-400' },
    { label: 'สาขา', value: 'BKK-01', icon: Store, accent: 'from-slate-400 to-slate-200' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it, i) => (
        <motion.div
          key={it.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="glass p-3 flex items-center gap-3"
        >
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${it.accent} grid place-items-center text-ink-950`}>
            <it.icon className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-none text-slate-100">{it.value}</div>
            <div className="text-xs text-slate-400 mt-1">{it.label}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
