import { useEffect, useState } from 'react';
import { Users, UserCheck, UserX, Store } from 'lucide-react';

interface Stats {
  totalMembers: number;
  memberVisits24h: number;
  guestVisits24h: number;
}

export function StatsStrip() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchStats = () =>
      fetch('/api/members/stats')
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {});
    fetchStats();
    const id = setInterval(fetchStats, 15000);
    return () => clearInterval(id);
  }, []);

  const items = [
    { label: 'สมาชิกทั้งหมด', value: stats?.totalMembers ?? '—', icon: Users },
    { label: 'สมาชิกวันนี้', value: stats?.memberVisits24h ?? '—', icon: UserCheck },
    { label: 'ลูกค้าใหม่วันนี้', value: stats?.guestVisits24h ?? '—', icon: UserX },
    { label: 'สาขา', value: 'BKK-01', icon: Store },
  ];

  return (
    <div className="surface-raised grid grid-cols-2 md:grid-cols-4 divide-x divide-paper-400">
      {items.map((it) => (
        <div key={it.label} className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-paper-200 grid place-items-center text-ink-700">
            <it.icon className="w-4 h-4" />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-none text-ink-900 tabular-nums">
              {it.value}
            </div>
            <div className="label-eyebrow mt-1">{it.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
