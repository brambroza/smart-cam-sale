import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { Printer, ImageDown, QrCode } from 'lucide-react';
import { formatThb } from '../lib/utils';

export interface ReceiptData {
  shopName: string;
  receiptNo: string;
  boughtAt: string;
  storeCode: string;
  memberName: string | null;
  items: { name: string; qty: number; price: number; lineTotal: number }[];
  total: number;
  pointsEarned: number;
  promptpayPayload: string | null;
}

const NOT_TAX_INVOICE = 'ใบเสร็จรับเงินอย่างย่อ — มิใช่ใบกำกับภาษี';

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
}

/** Portal that only becomes visible inside window.print() (see styles.css). */
export function PrintPortal({ children }: { children: React.ReactNode }) {
  return createPortal(<div className="print-only">{children}</div>, document.body);
}

/**
 * Sale-close panel: PromptPay QR for the customer to scan + abbreviated
 * receipt actions (print, save as image to send via chat).
 */
export function ReceiptPanel({ data, newPointsBalance }: { data: ReceiptData; newPointsBalance?: number }) {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data.promptpayPayload && qrRef.current) {
      QRCode.toCanvas(qrRef.current, data.promptpayPayload, { width: 168, margin: 1 }).catch(() => {});
    }
  }, [data.promptpayPayload]);

  const savePng = async () => {
    setSaving(true);
    try {
      const url = await drawReceiptPng(data, newPointsBalance);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${data.receiptNo}.png`;
      a.click();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4">
      {data.promptpayPayload && (
        <div className="rounded-xl border border-cyan-400/30 bg-white p-3 inline-flex flex-col items-center">
          <div className="text-[11px] font-semibold text-ink-950 flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5" /> สแกนจ่าย PromptPay · {formatThb(data.total)}
          </div>
          <canvas ref={qrRef} className="mt-1" />
        </div>
      )}
      <div className="mt-3 flex items-center justify-center gap-2">
        <button onClick={() => window.print()} className="btn-ghost text-xs py-1.5 px-3">
          <Printer className="w-3.5 h-3.5" /> พิมพ์ใบเสร็จ
        </button>
        <button onClick={savePng} disabled={saving} className="btn-ghost text-xs py-1.5 px-3">
          <ImageDown className="w-3.5 h-3.5" /> บันทึกรูป (ส่งให้ลูกค้า)
        </button>
      </div>

      {/* what the printer actually prints */}
      <PrintPortal>
        <div style={{ fontFamily: 'monospace, sans-serif', width: '260px', color: '#000' }}>
          <div style={{ textAlign: 'center', fontWeight: 700 }}>{data.shopName}</div>
          <div style={{ textAlign: 'center', fontSize: 11 }}>
            เลขที่ {data.receiptNo} · {fmtDateTime(data.boughtAt)}
          </div>
          {data.memberName && (
            <div style={{ textAlign: 'center', fontSize: 11 }}>สมาชิก: {data.memberName}</div>
          )}
          <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />
          {data.items.map((i, n) => (
            <div key={n} style={{ display: 'flex', fontSize: 12, gap: 6 }}>
              <span style={{ flex: 1 }}>{i.name} ×{i.qty}</span>
              <span>{i.lineTotal.toFixed(2)}</span>
            </div>
          ))}
          <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />
          <div style={{ display: 'flex', fontWeight: 700, fontSize: 14 }}>
            <span style={{ flex: 1 }}>รวม</span>
            <span>{data.total.toFixed(2)} บาท</span>
          </div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            แต้มที่ได้รับ +{data.pointsEarned}
            {newPointsBalance !== undefined ? ` · คงเหลือ ${newPointsBalance.toLocaleString()}` : ''}
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, marginTop: 8 }}>{NOT_TAX_INVOICE}</div>
          <div style={{ textAlign: 'center', fontSize: 10 }}>ขอบคุณที่อุดหนุนครับ/ค่ะ</div>
        </div>
      </PrintPortal>
    </div>
  );
}

/** Compose a thermal-style receipt PNG (incl. the PromptPay QR) for sharing via chat. */
async function drawReceiptPng(data: ReceiptData, newPointsBalance?: number): Promise<string> {
  const W = 420;
  const line = 30;
  const qrSize = data.promptpayPayload ? 220 : 0;
  const H = 210 + data.items.length * line + (qrSize ? qrSize + 70 : 0) + 90;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000000';

  let y = 44;
  const center = (text: string, font: string) => {
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, y);
  };
  const row = (left: string, right: string, font: string) => {
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.fillText(left, 24, y, W - 140);
    ctx.textAlign = 'right';
    ctx.fillText(right, W - 24, y);
  };
  const dashed = () => {
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(W - 20, y);
    ctx.stroke();
    ctx.restore();
    y += 26;
  };

  center(data.shopName || 'ใบเสร็จ', 'bold 22px sans-serif');
  y += 26;
  center(`เลขที่ ${data.receiptNo} · ${fmtDateTime(data.boughtAt)}`, '14px sans-serif');
  y += 22;
  if (data.memberName) {
    center(`สมาชิก: ${data.memberName}`, '14px sans-serif');
    y += 22;
  }
  y += 4;
  dashed();
  for (const i of data.items) {
    row(`${i.name} ×${i.qty}`, i.lineTotal.toFixed(2), '16px sans-serif');
    y += line;
  }
  dashed();
  row('รวมทั้งสิ้น', `${data.total.toFixed(2)} บาท`, 'bold 20px sans-serif');
  y += 30;
  row(
    `แต้มที่ได้รับ +${data.pointsEarned}`,
    newPointsBalance !== undefined ? `คงเหลือ ${newPointsBalance.toLocaleString()}` : '',
    '14px sans-serif',
  );
  y += 16;

  if (data.promptpayPayload) {
    y += 14;
    center('สแกนจ่ายด้วย PromptPay', 'bold 15px sans-serif');
    y += 10;
    const qrUrl = await QRCode.toDataURL(data.promptpayPayload, { width: qrSize, margin: 1 });
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, (W - qrSize) / 2, y, qrSize, qrSize);
        resolve();
      };
      img.src = qrUrl;
    });
    y += qrSize + 26;
  } else {
    y += 10;
  }

  center(NOT_TAX_INVOICE, '12px sans-serif');
  y += 18;
  center('ขอบคุณที่อุดหนุนครับ/ค่ะ', '12px sans-serif');
  return c.toDataURL('image/png');
}
