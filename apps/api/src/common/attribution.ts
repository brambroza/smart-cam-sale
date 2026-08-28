import { PrismaService } from '../prisma.service';

/**
 * A sale counts as "assisted" when the member was recognized by a camera
 * within this window before the bill — i.e. staff had the recommendation
 * card and script in front of them while serving this customer.
 */
export const ATTRIBUTION_WINDOW_MS = 15 * 60 * 1000;

export async function wasAssisted(
  prisma: PrismaService,
  orgId: string,
  memberId: string,
): Promise<boolean> {
  const recent = await prisma.visitLog.findFirst({
    where: {
      orgId,
      memberId,
      matchedFace: true,
      visitedAt: { gte: new Date(Date.now() - ATTRIBUTION_WINDOW_MS) },
    },
    select: { id: true },
  });
  return recent !== null;
}
