import { PrismaClient, MembershipTier, Gender } from '@prisma/client';

const prisma = new PrismaClient();

function randVector(seed: number): number[] {
  const v = new Array(512).fill(0).map((_, i) => Math.sin(seed * (i + 1)) * 0.5);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

async function main() {
  console.log('🌱 Seeding database…');

  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.faceEmbedding.deleteMany();
  await prisma.member.deleteMany();
  await prisma.product.deleteMany();

  const products = await prisma.product.createManyAndReturn({
    data: [
      { name: 'อเมริกาโน่เย็น', category: 'coffee', price: 55, timeOfDay: 'morning', imageUrl: '/products/americano.png' },
      { name: 'ลาเต้ร้อน', category: 'coffee', price: 65, timeOfDay: 'morning' },
      { name: 'แซนวิชแฮมชีส', category: 'bakery', price: 45, timeOfDay: 'morning' },
      { name: 'ครัวซองต์ช็อกโกแลต', category: 'bakery', price: 39, timeOfDay: 'morning' },
      { name: 'ข้าวกล่องกะเพราไก่', category: 'meal', price: 65, timeOfDay: 'afternoon' },
      { name: 'สลัดอกไก่', category: 'meal', price: 89, timeOfDay: 'afternoon', targetGender: Gender.female },
      { name: 'น้ำเปล่า', category: 'drink', price: 12, timeOfDay: 'any' },
      { name: 'เบียร์กระป๋อง', category: 'alcohol', price: 45, timeOfDay: 'evening', minAge: 20, targetGender: Gender.male },
      { name: 'ไอศกรีมแท่ง', category: 'snack', price: 25, timeOfDay: 'afternoon' },
      { name: 'มันฝรั่งทอด', category: 'snack', price: 30, timeOfDay: 'evening' },
      { name: 'ชาเขียวมัทฉะ', category: 'drink', price: 55, timeOfDay: 'afternoon', targetGender: Gender.female },
      { name: 'ซุปมิโสะร้อน', category: 'meal', price: 45, timeOfDay: 'night', minAge: 25 },
      { name: 'ข้าวไข่ข้น', category: 'meal', price: 55, timeOfDay: 'morning' },
      { name: 'ผ้าอนามัย', category: 'health', price: 65, targetGender: Gender.female },
      { name: 'มาส์กหน้า', category: 'beauty', price: 39, targetGender: Gender.female, minAge: 18 },
      { name: 'เจลใส่ผม', category: 'beauty', price: 89, targetGender: Gender.male },
    ],
  });

  const members = [
    { fullName: 'สมชาย ใจดี', displayName: 'พี่ชาย', gender: Gender.male, birthYear: 1988, tier: MembershipTier.gold, points: 4820, faceOptIn: true },
    { fullName: 'สุนีย์ พงษ์สวัสดิ์', displayName: 'คุณสุนีย์', gender: Gender.female, birthYear: 1995, tier: MembershipTier.silver, points: 2100, faceOptIn: true },
    { fullName: 'ธนากร วัฒนกุล', displayName: 'เอก', gender: Gender.male, birthYear: 2001, tier: MembershipTier.bronze, points: 350, faceOptIn: true },
    { fullName: 'มินตรา ศรีทอง', displayName: 'มิน', gender: Gender.female, birthYear: 1998, tier: MembershipTier.platinum, points: 12800, faceOptIn: true },
  ];

  const memberIds: string[] = [];
  for (let i = 0; i < members.length; i++) {
    const m = await prisma.member.create({ data: members[i]! });
    memberIds.push(m.id);
    const vec = randVector(i + 1);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "FaceEmbedding" ("id", "memberId", "embedding") VALUES ($1, $2, $3::vector)`,
      `face_${m.id}`,
      m.id,
      JSON.stringify(vec),
    );
  }

  const now = new Date();
  for (let i = 0; i < memberIds.length; i++) {
    const memberId = memberIds[i]!;
    for (let p = 0; p < 8; p++) {
      const boughtAt = new Date(now.getTime() - (p * 3 + i) * 86400000 - Math.random() * 3600000);
      const picks = products
        .slice()
        .sort(() => Math.random() - 0.5)
        .slice(0, 2 + Math.floor(Math.random() * 3));
      const total = picks.reduce((s, x) => s + x.price, 0);
      await prisma.purchase.create({
        data: {
          memberId,
          total,
          boughtAt,
          items: {
            create: picks.map((pr) => ({ productId: pr.id, price: pr.price, qty: 1 })),
          },
        },
      });
    }
  }

  console.log(`✔ ${products.length} products, ${memberIds.length} members seeded`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
