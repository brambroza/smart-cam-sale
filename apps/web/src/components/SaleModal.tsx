import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, ShoppingCart, Minus, Plus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatThb } from '../lib/utils';
import type { MemberProfile } from '@smart-cam/shared-types';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  member: MemberProfile | null;
}

export function SaleModal({ open, onClose, member }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [step, setStep] = useState<'cart' | 'saving' | 'done' | 'error'>('cart');
  const [result, setResult] = useState<{ total: number; pointsEarned: number; newPointsBalance: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCart(new Map());
      setQ('');
      setStep('cart');
      setResult(null);
      setError(null);
      return;
    }
    apiFetch(`/products${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [open, q]);

  const cartItems = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return Array.from(cart.entries())
      .map(([id, qty]) => ({ product: byId.get(id), qty, id }))
      .filter((x): x is { product: Product; qty: number; id: string } => !!x.product);
  }, [cart, products]);

  const total = cartItems.reduce((s, x) => s + x.product.price * x.qty, 0);

  const adjust = (id: string, delta: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const qty = (next.get(id) ?? 0) + delta;
      if (qty <= 0) next.delete(id);
      else next.set(id, Math.min(qty, 99));
      return next;
    });
  };

  const submit = async () => {
    if (!member) return;
    setStep('saving');
    try {
      const res = await apiFetch('/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.memberId,
          items: Array.from(cart.entries()).map(([productId, qty]) => ({ productId, qty })),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      setResult(await res.json());
      setStep('done');
    } catch (e) {
      setError((e as Error).message);
      setStep('error');
    }
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
            className="glass-strong w-full max-w-lg max-h-[85vh] flex flex-col shadow-glow border-white/20 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-neon-lime" />
                <h2 className="font-display font-bold text-lg text-slate-100">บันทึกการขาย</h2>
                {member && (
                  <span className="text-xs text-slate-400">— {member.displayName}</span>
                )}
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            {step === 'cart' && (
              <>
                <div className="p-4 border-b border-white/10">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="ค้นหาสินค้า..."
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 focus:border-neon-cyan/50 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1.5 min-h-[200px]">
                  {products.map((p) => {
                    const qty = cart.get(p.id) ?? 0;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/10"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-slate-100 truncate">{p.name}</div>
                          <div className="text-[11px] font-mono text-neon-cyan">{formatThb(p.price)}</div>
                        </div>
                        {qty === 0 ? (
                          <button
                            onClick={() => adjust(p.id, 1)}
                            className="btn-ghost text-xs py-1 px-3"
                          >
                            <Plus className="w-3.5 h-3.5" /> เพิ่ม
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button onClick={() => adjust(p.id, -1)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-mono font-bold w-6 text-center">{qty}</span>
                            <button onClick={() => adjust(p.id, 1)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-white/10 bg-ink-900/60">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-400">
                      {cartItems.reduce((s, x) => s + x.qty, 0)} ชิ้น
                    </span>
                    <span className="font-mono font-bold text-xl text-neon-lime">{formatThb(total)}</span>
                  </div>
                  <button
                    onClick={submit}
                    disabled={cart.size === 0 || !member}
                    className="btn-primary w-full justify-center py-2.5 disabled:opacity-40"
                  >
                    ยืนยันการขาย
                  </button>
                  {!member && (
                    <p className="mt-2 text-[11px] text-amber-300 text-center">
                      บันทึกได้เฉพาะสมาชิก — ให้ลูกค้าสมัครสมาชิกก่อน
                    </p>
                  )}
                </div>
              </>
            )}

            {step === 'saving' && (
              <div className="py-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-neon-cyan" />
                <p className="mt-3 text-sm text-slate-300">กำลังบันทึก...</p>
              </div>
            )}

            {step === 'done' && result && (
              <div className="py-12 text-center px-6">
                <CheckCircle2 className="w-14 h-14 mx-auto text-neon-lime" />
                <p className="mt-3 font-semibold text-lg text-slate-100">
                  บันทึกแล้ว {formatThb(result.total)}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  +{result.pointsEarned} แต้ม → รวม {result.newPointsBalance.toLocaleString()} แต้ม
                </p>
                <button onClick={onClose} className="btn-primary mt-5 py-2 px-6">ปิด</button>
              </div>
            )}

            {step === 'error' && (
              <div className="py-10 text-center px-6">
                <AlertCircle className="w-10 h-10 mx-auto text-rose-400" />
                <p className="mt-2 text-sm text-rose-300 break-words">{error}</p>
                <button onClick={() => setStep('cart')} className="btn-ghost mt-4">
                  กลับไปแก้ไข
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
