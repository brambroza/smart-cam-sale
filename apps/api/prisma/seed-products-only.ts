import { PrismaClient } from '@prisma/client';
import { PRODUCTS } from './products-seed';

// Adds/refreshes the product catalog WITHOUT touching members, purchases,
// or face embeddings. Safe to run on a live database.
const prisma = new PrismaClient();

const ORG_ID = process.env.SEED_ORG_ID ?? 'org_default';

async function main() {
  console.log(`🛒 Refreshing product catalog… (org: ${ORG_ID})`);
  const existing = await prisma.product.findMany({
    where: { orgId: ORG_ID },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((p) => p.name));

  const fresh = PRODUCTS.filter((p) => !existingNames.has(p.name));
  if (fresh.length === 0) {
    console.log('✔ ไม่มีสินค้าใหม่ให้เพิ่ม');
    return;
  }
  await prisma.product.createMany({ data: fresh.map((p) => ({ ...p, orgId: ORG_ID })) });
  console.log(`✔ เพิ่มสินค้าใหม่ ${fresh.length} รายการ (รวมทั้งหมด ${existing.length + fresh.length})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
