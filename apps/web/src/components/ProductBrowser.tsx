import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, ShoppingBag, PackageOpen } from 'lucide-react';
import { formatThb } from '../lib/utils';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  targetGender: string;
  timeOfDay: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

const CATEGORY_LABELS: Record<string, string> = {
  coffee: 'กาแฟ',
  bakery: 'เบเกอรี่',
  meal: 'อาหาร',
  drink: 'เครื่องดื่ม',
  snack: 'ขนม',
  alcohol: 'เครื่องดื่มแอลกอฮอล์',
  health: 'สุขภาพ',
  beauty: 'ความงาม',
};

export function ProductBrowser({ open, onClose }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    fetch(`${API_BASE}/products?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setProducts(data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [open, q, category]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return Array.from(set).sort();
  }, [products]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="w-full max-w-md h-full glass-strong border-l border-white/10 shadow-card overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/10 sticky top-0 bg-ink-900/80 backdrop-blur-xl z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PackageOpen className="w-5 h-5 text-neon-cyan" />
                  <h2 className="font-display font-bold text-lg">แค็ตตาล็อกสินค้า</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ค้นหาสินค้า..."
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
                />
              </div>

              {categories.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <CatChip active={category === null} onClick={() => setCategory(null)}>
                    ทั้งหมด
                  </CatChip>
                  {categories.map((c) => (
                    <CatChip key={c} active={category === c} onClick={() => setCategory(c)}>
                      {CATEGORY_LABELS[c] ?? c}
                    </CatChip>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 space-y-2">
              {loading && <div className="text-center text-slate-500 py-8">กำลังโหลด...</div>}
              {!loading && products.length === 0 && (
                <div className="text-center text-slate-500 py-12">ไม่พบสินค้า</div>
              )}
              {products.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.015, 0.3) }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-neon-cyan/30 transition"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 grid place-items-center">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{p.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {CATEGORY_LABELS[p.category] ?? p.category}
                    </div>
                  </div>
                  <div className="font-mono text-sm text-neon-cyan">{formatThb(p.price)}</div>
                </motion.div>
              ))}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CatChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'text-[11px] px-2.5 py-1 rounded-full border transition ' +
        (active
          ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50'
          : 'bg-white/[0.03] text-slate-400 border-white/10 hover:border-white/20')
      }
    >
      {children}
    </button>
  );
}
