import { RecognitionService } from './recognition.service';
import { PrismaService } from '../prisma.service';

/**
 * The single most dangerous cross-tenant leak: face vector search matching a
 * member of ANOTHER organization (a customer of store A being greeted by name
 * in store B). These tests pin the org filter into the pgvector query.
 */
describe('RecognitionService.findClosestMember — tenant isolation', () => {
  function build(rows: unknown[]) {
    const queryRaw = jest.fn().mockResolvedValue(rows);
    const prisma = { $queryRawUnsafe: queryRaw } as unknown as PrismaService;
    // findClosestMember touches only prisma — other collaborators can be stubs
    const svc = new RecognitionService(prisma, {} as never, {} as never, {} as never);
    return { svc, queryRaw };
  }

  const EMBEDDING = Array.from({ length: 512 }, () => 0.01);

  it('joins Member and filters by orgId inside the SQL itself', async () => {
    const { svc, queryRaw } = build([]);
    await svc.findClosestMember(EMBEDDING, 'org-A');
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const [sql, _vec, orgArg] = queryRaw.mock.calls[0] as [string, string, string];
    expect(sql).toMatch(/JOIN\s+"Member"/i);
    expect(sql).toMatch(/"orgId"\s*=\s*\$2/);
    expect(orgArg).toBe('org-A');
  });

  it('passes the caller org verbatim — no fallback to a global search', async () => {
    const { svc, queryRaw } = build([]);
    await svc.findClosestMember(EMBEDDING, 'org-B');
    expect((queryRaw.mock.calls[0] as unknown[])[2]).toBe('org-B');
  });

  it('returns the match row when the scoped query finds one', async () => {
    const { svc } = build([{ memberId: 'm1', distance: 0.2 }]);
    const match = await svc.findClosestMember(EMBEDDING, 'org-A');
    expect(match).toEqual({ memberId: 'm1', similarity: 0.8 });
  });

  it('returns null when the org has no embeddings at all', async () => {
    const { svc } = build([]);
    expect(await svc.findClosestMember(EMBEDDING, 'org-EMPTY')).toBeNull();
  });
});
