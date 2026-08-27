import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { MemberProfile, PurchaseSummary, RecommendedProduct } from '@smart-cam/shared-types';

interface ScriptContext {
  isMember: boolean;
  member?: MemberProfile;
  age: number;
  gender: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  recentPurchases: PurchaseSummary[];
  recommendations: RecommendedProduct[];
}

@Injectable()
export class ClaudeScriptService {
  private readonly logger = new Logger(ClaudeScriptService.name);
  private readonly client: Anthropic | null;

  constructor() {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      this.logger.log('ANTHROPIC_API_KEY not set — Claude script generation disabled');
      this.client = null;
    } else {
      this.client = new Anthropic({ apiKey: key });
      this.logger.log('Claude Haiku 4.5 script generation enabled');
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async generate(ctx: ScriptContext): Promise<string | null> {
    if (!this.client) return null;

    const prompt = this.buildPrompt(ctx);
    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 250,
        system:
          'คุณคือผู้ช่วยพนักงานหน้าร้านสะดวกซื้อ/คาเฟ่ในไทย ' +
          'สร้างประโยคทักทายลูกค้า + แนะนำสินค้า สั้น ๆ 1-2 ประโยค เป็นกันเอง สุภาพ ' +
          'ห้ามใช้ emoji ห้ามใส่ quote/หัวข้อ ให้เป็นข้อความล้วน ๆ สำหรับพนักงานพูดกับลูกค้าได้เลย',
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content.find((b) => b.type === 'text');
      if (text?.type === 'text') return text.text.trim();
      return null;
    } catch (e) {
      this.logger.warn(`Claude generation failed: ${(e as Error).message}`);
      return null;
    }
  }

  private buildPrompt(ctx: ScriptContext): string {
    const tod = { morning: 'เช้า', afternoon: 'บ่าย', evening: 'เย็น', night: 'ค่ำ' }[ctx.timeOfDay];
    const parts: string[] = [];

    if (ctx.isMember && ctx.member) {
      parts.push(`สมาชิก: ${ctx.member.displayName} (tier: ${ctx.member.tier}, แต้ม: ${ctx.member.points})`);
      parts.push(`เข้าร้าน ${ctx.member.visitCount} ครั้ง ยอดซื้อรวม ${ctx.member.totalSpend} บาท`);
    } else {
      parts.push(`ลูกค้าใหม่ (ยังไม่ใช่สมาชิก) อายุประมาณ ${ctx.age} ปี เพศ${ctx.gender === 'male' ? 'ชาย' : 'หญิง'}`);
    }

    parts.push(`ช่วงเวลาปัจจุบัน: ${tod}`);

    if (ctx.recentPurchases.length) {
      const top = ctx.recentPurchases
        .slice(0, 3)
        .map((p) => `${p.productName} (${p.totalTimes} ครั้ง)`)
        .join(', ');
      parts.push(`ประวัติซื้อบ่อย: ${top}`);
    }

    if (ctx.recommendations.length) {
      const rec = ctx.recommendations
        .slice(0, 2)
        .map((r) => `${r.name} ${r.price}฿ (${r.reason})`)
        .join(', ');
      parts.push(`สินค้าที่ระบบแนะ: ${rec}`);
    }

    parts.push(
      ctx.isMember
        ? 'ทักทายด้วยชื่อสมาชิก + แนะนำสินค้าที่เหมาะสม + จบด้วยคำเชิญเบา ๆ'
        : 'ทักทายอบอุ่น + แนะนำสินค้า + แนะนำสมัครสมาชิกรับส่วนลด 10%',
    );

    return parts.join('\n');
  }
}
