import { Injectable, Logger } from '@nestjs/common';

export interface LeadAlert {
  name: string;
  storeName: string;
  phone: string;
  email?: string | null;
  message?: string | null;
}

/**
 * Lead notification mail via the Resend HTTP API. Entirely optional: without
 * RESEND_API_KEY nothing is sent and nothing breaks — the lead is already
 * safe in the database before this is ever called.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey = process.env.RESEND_API_KEY;
  private readonly to = process.env.LEAD_NOTIFY_EMAIL ?? 'amnart.gl@gmail.com';
  private readonly from = process.env.LEAD_NOTIFY_FROM ?? 'Smart Cam Sale <onboarding@resend.dev>';

  get enabled(): boolean {
    return !!this.apiKey;
  }

  /** Fire-and-forget: callers must never await-and-throw on this. */
  async sendLeadAlert(lead: LeadAlert): Promise<void> {
    const esc = escapeHtml;
    const html =
      `<h2>🔔 ผู้สนใจใหม่จากหน้าเว็บ</h2>` +
      `<p><b>ชื่อ:</b> ${esc(lead.name)}<br/>` +
      `<b>ร้าน:</b> ${esc(lead.storeName)}<br/>` +
      `<b>โทร:</b> <a href="tel:${esc(lead.phone)}">${esc(lead.phone)}</a>` +
      (lead.email ? `<br/><b>อีเมล:</b> ${esc(lead.email)}` : '') +
      (lead.message ? `</p><p><b>ข้อความ:</b><br/>${esc(lead.message)}` : '') +
      `</p><p style="color:#888">เปิดดู/อัปเดตสถานะได้ในหลังบ้าน → แท็บ การเงิน → คิวผู้สนใจ</p>`;
    await this.send(`🔔 Lead ใหม่: ${lead.storeName} (${lead.name})`, html);
  }

  /** New self-serve shop registered — the owner should know within seconds. */
  async sendSignupAlert(info: { shopName: string; email: string }): Promise<void> {
    const esc = escapeHtml;
    const html =
      `<h2>🎉 ร้านใหม่สมัครใช้งานเอง (Lite)</h2>` +
      `<p><b>ร้าน:</b> ${esc(info.shopName)}<br/>` +
      `<b>อีเมล:</b> ${esc(info.email)}</p>` +
      `<p style="color:#888">ทักไปต้อนรับ/ช่วย onboarding ได้เลย — ดูรายชื่อองค์กรในหลังบ้าน → แท็บ องค์กร</p>`;
    await this.send(`🎉 ร้านใหม่สมัครเอง: ${info.shopName}`, html);
  }

  private async send(subject: string, html: string): Promise<void> {
    if (!this.apiKey) return;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: this.from, to: [this.to], subject, html }),
      });
      if (!res.ok) {
        this.logger.warn(`email failed: HTTP ${res.status} ${await res.text().catch(() => '')}`);
      }
    } catch (e) {
      this.logger.warn(`email failed: ${(e as Error).message}`);
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
