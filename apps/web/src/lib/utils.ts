import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...c: ClassValue[]) {
  return twMerge(clsx(c));
}

export function formatThb(v: number) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(v);
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d} วันที่แล้ว`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h} ชั่วโมงที่แล้ว`;
  const m = Math.floor(diff / 60000);
  return m > 0 ? `${m} นาทีที่แล้ว` : 'เมื่อสักครู่';
}

export function ageBucketLabel(bucket: string) {
  return (
    {
      under_18: 'ต่ำกว่า 18',
      '18_25': '18-25',
      '26_35': '26-35',
      '36_50': '36-50',
      '50_plus': '50 ขึ้นไป',
    }[bucket] ?? bucket
  );
}
