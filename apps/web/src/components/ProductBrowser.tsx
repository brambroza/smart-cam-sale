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
          className="fixed inset-0 z-40 flex justify-end bg-ink-950/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="w-full max-w-md h-full bg-paper-100 border-l border-paper-400 shadow-raised overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-paper-400 sticky top-0 bg-paper-50 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PackageOpen className="w-5 h-5 text-terracotta" />
                  <h2 className="font-display font-bold text-lg text-ink-900">แค็ตตาล็อกสินค้า</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded hover:bg-paper-200 transition text-ink-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ค้นหาสินค้า..."
                  className="w-full bg-paper-50 border border-paper-400 rounded pl-9 pr-3 py-2 text-sm text-ink-900 focus:border-terracotta focus:outline-none"
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
              {loading && <div className="text-center text-ink-500 py-8">กำลังโหลด...</div>}
              {!loading && products.length === 0 && (
                <div className="text-center text-ink-500 py-12">ไม่พบสินค้า</div>
              )}
              {products.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.012, 0.25) }}
                  className="flex items-center gap-3 p-2.5 rounded bg-paper-50 border border-paper-400 hover:border-terracotta/50 transition"
                >
                  <div className="w-9 h-9 rounded bg-paper-300 grid place-items-center text-ink-700">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-ink-900 truncate">{p.name}</div>
                    <div className="text-[11px] text-ink-500">
                      {CATEGORY_LABELS[p.category] ?? p.category}
                    </div>
                  </div>
                  <div className="font-mono text-sm text-terracotta-deep">{formatThb(p.price)}</div>
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
          ? 'bg-terracotta text-paper-50 border-terracotta'
          : 'bg-paper-50 text-ink-700 border-paper-400 hover:border-ink-500')
      }
    >
      {children}
    </button>
  );
}
