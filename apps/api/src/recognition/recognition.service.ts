import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AiClient, AiFace } from './ai.client';
import { RecommendationService } from './recommendation.service';
import { ClaudeScriptService } from '../ai/claude-script.service';
import type {
  RecognitionMessage,
  RecognitionResult,
  MemberProfile,
} from '@smart-cam/shared-types';

const MATCH_THRESHOLD = 0.55; // cosine similarity threshold

function ageBucket(age: number): string {
  if (age < 18) return 'under_18';
  if (age < 26) return '18_25';
  if (age < 36) return '26_35';
  if (age < 51) return '36_50';
  return '50_plus';
}

function timeOfDay(d: Date): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = d.getHours();
  if (h < 11) return 'morning';
  if (h < 16) return 'afternoon';
  if (h < 20) return 'evening';
  return 'night';
}

@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiClient,
    private readonly recos: RecommendationService,
    private readonly claude: ClaudeScriptService,
  ) {}

  private readonly lastEmbeddingByClient = new Map<string, number[]>();
  private readonly lastEmbeddingByChannel = new Map<string, number[]>();
  /** Cache latest embedding per client socket so enrollment can save it later. */
  public rememberEmbedding(clientId: string, embedding: number[]) {
    this.lastEmbeddingByClient.set(clientId, embedding);
  }
  public getLastEmbedding(clientId: string): number[] | undefined {
    return this.lastEmbeddingByClient.get(clientId);
  }
  /** Bridge mode: embeddings keyed by camera channel so any viewer console can enroll. */
  public rememberChannelEmbedding(channel: string, embedding: number[]) {
    this.lastEmbeddingByChannel.set(channel, embedding);
  }
  public getLastChannelEmbedding(channel: string): number[] | undefined {
    return this.lastEmbeddingByChannel.get(channel);
  }

  async recognizeFrame(imageBase64: string, frameId: string): Promise<RecognitionMessage> {
    const { message } = await this.recognizeFrameWithEmbedding(imageBase64, frameId);
    return message;
  }

  async recognizeFrameWithEmbedding(
    imageBase64: string,
    frameId: string,
  ): Promise<{ message: RecognitionMessage; primaryEmbedding?: number[] }> {
    const started = Date.now();
    const faces = await this.ai.analyze(imageBase64);
    const results: RecognitionResult[] = [];
    let primaryEmbedding: number[] | undefined;
    let bestScore = 0;

    for (const face of faces) {
      if (face.det_score < 0.55) continue;
      if (face.det_score > bestScore) {
        bestScore = face.det_score;
        primaryEmbedding = face.embedding;
      }
      results.push(await this.processFace(face));
    }

    return {
      message: {
        frameId,
        results,
        processedAt: new Date().toISOString(),
        processingMs: Date.now() - started,
      },
      primaryEmbedding,
    };
  }

  private async processFace(face: AiFace): Promise<RecognitionResult> {
    const age = Math.round(face.age);
    const bucket = ageBucket(age);
    const gender = face.gender;
    const tod = timeOfDay(new Date());

    const match = await this.findClosestMember(face.embedding);
    const faceId = `face_${Math.random().toString(36).slice(2, 10)}`;
    const capturedAt = new Date().toISOString();

    if (match && match.similarity >= MATCH_THRESHOLD) {
      const memberProfile = await this.buildMemberProfile(match.memberId);
      const purchases = await this.recentPurchases(match.memberId);
      const recommendations = await this.recos.forMember(match.memberId, tod);

      await this.prisma.visitLog.create({
        data: {
          memberId: match.memberId,
          matchedFace: true,
          estimatedAge: age,
          gender: gender as any,
          ageBucket: bucket,
        },
      });

      const templateScript = this.craftScript(
        memberProfile,
        purchases[0]?.productName,
        recommendations[0]?.name,
      );
      const claudeScript = await this.claude.generate({
        isMember: true,
        member: memberProfile,
        age,
        gender,
        timeOfDay: tod,
        recentPurchases: purchases,
        recommendations,
      });

      return {
        faceId,
        bbox: face.bbox,
        estimatedAge: age,
        ageBucket: bucket,
        gender,
        isMember: true,
        matchConfidence: match.similarity,
        member: memberProfile,
        recentPurchases: purchases,
        recommendations,
        suggestedScript: claudeScript ?? templateScript,
        capturedAt,
      };
    }

    const recommendations = await this.recos.forGuest(age, gender, tod);
    await this.prisma.visitLog.create({
      data: { matchedFace: false, estimatedAge: age, gender: gender as any, ageBucket: bucket },
    });

    const guestTemplate = this.guestScript(age, gender, recommendations[0]?.name);
    const claudeScript = await this.claude.generate({
      isMember: false,
      age,
      gender,
      timeOfDay: tod,
      recentPurchases: [],
      recommendations,
    });

    return {
      faceId,
      bbox: face.bbox,
      estimatedAge: age,
      ageBucket: bucket,
      gender,
      isMember: false,
      recentPurchases: [],
      recommendations,
      suggestedScript: claudeScript ?? guestTemplate,
      capturedAt,
    };
  }

  private async findClosestMember(embedding: number[]) {
    const vecLiteral = `[${embedding.join(',')}]`;
    const rows = await this.prisma.$queryRawUnsafe<{ memberId: string; distance: number }[]>(
      `SELECT "memberId", 1 - ("embedding" <=> $1::vector) AS similarity,
              ("embedding" <=> $1::vector) AS distance
         FROM "FaceEmbedding"
       ORDER BY "embedding" <=> $1::vector
       LIMIT 1`,
      vecLiteral,
    );
    const row = rows[0] as any;
    if (!row) return null;
    return { memberId: row.memberId as string, similarity: 1 - Number(row.distance) };
  }

  private async buildMemberProfile(memberId: string): Promise<MemberProfile> {
    const m = await this.prisma.member.findUniqueOrThrow({
      where: { id: memberId },
      include: { purchases: { select: { total: true } } },
    });
    const totalSpend = m.purchases.reduce((s, p) => s + p.total, 0);
    return {
      memberId: m.id,
      fullName: m.fullName,
      displayName: m.displayName,
      tier: m.tier as any,
      points: m.points,
      memberSince: m.memberSince.toISOString(),
      avatarUrl: m.avatarUrl ?? undefined,
      totalSpend,
      visitCount: m.purchases.length,
    };
  }

  private async recentPurchases(memberId: string) {
    const rows = await this.prisma.purchase.findMany({
      where: { memberId },
      orderBy: { boughtAt: 'desc' },
      take: 5,
      include: { items: { include: { product: true } } },
    });
    const map = new Map<string, { productName: string; category: string; count: number; lastBoughtAt: Date }>();
    for (const p of rows) {
      for (const item of p.items) {
        const cur = map.get(item.productId);
        if (cur) {
          cur.count += item.qty;
          if (p.boughtAt > cur.lastBoughtAt) cur.lastBoughtAt = p.boughtAt;
        } else {
          map.set(item.productId, {
            productName: item.product.name,
            category: item.product.category,
            count: item.qty,
            lastBoughtAt: p.boughtAt,
          });
        }
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([productId, v]) => ({
        productId,
        productName: v.productName,
        category: v.category,
        totalTimes: v.count,
        lastBoughtAt: v.lastBoughtAt.toISOString(),
      }));
  }

  private craftScript(member: MemberProfile, favorite?: string, rec?: string) {
    const parts = [`สวัสดี ${member.displayName} (${member.tier.toUpperCase()})`];
    if (favorite) parts.push(`วันนี้รับ${favorite}เหมือนเดิมมั้ยครับ?`);
    if (rec) parts.push(`วันนี้มี${rec} มาแนะนำครับ`);
    parts.push(`แต้มสะสม ${member.points.toLocaleString()} แต้ม`);
    return parts.join(' ');
  }

  private guestScript(age: number, gender: string, rec?: string) {
    const bucket = age < 26 ? 'น้อง' : age < 45 ? 'พี่' : 'คุณ';
    const g = gender === 'female' ? bucket + 'สาว' : gender === 'male' ? bucket + 'ชาย' : bucket;
    const base = `สวัสดีครับ${g === 'พี่' ? '' : ' ' + g}`;
    return `${base}, ${rec ? 'วันนี้ ' + rec + ' ลดพิเศษครับ ' : ''}สมัครสมาชิกวันนี้รับส่วนลด 10% ทันทีนะครับ`;
  }
}
