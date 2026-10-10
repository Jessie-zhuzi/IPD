import { prisma } from "../src/db/prisma";
import bcrypt from "bcrypt";

async function main() {
  const assets = [
    { type: "AVATAR", assetKey: "avatar_default", name: "default avatar", costPoints: 0 },
    { type: "AVATAR", assetKey: "avatar_bee", name: "Bee avatar", costPoints: 100 },
    { type: "AVATAR", assetKey: "avatar_rocket", name: "Rocket avatar", costPoints: 200 },
    { type: "BADGE", assetKey: "badge_bronze", name: "Bronze badge", costPoints: 50 },
    { type: "BADGE", assetKey: "badge_silver", name: "Silver Badge", costPoints: 150 },
    { type: "BADGE", assetKey: "badge_7day", name: "Consecutive Wins Badge", costPoints: 300 },
  ] as const;

  await prisma.$transaction(
    assets.map((asset) =>
      prisma.asset.upsert({
        where: { assetKey: asset.assetKey },
        update: { name: asset.name, costPoints: asset.costPoints, type: asset.type },
        create: asset,
      }),
    ),
  );

  console.log(`[seed] upserted ${assets.length} assets`);

  const demoUsers = [
    { email: "demo_a@habithive.local", displayName: "UserA", avatarKey: "avatar_default" },
    { email: "demo_b@habithive.local", displayName: "UserB", avatarKey: "avatar_default" },
  ] as const;

  let createdCount = 0;
  for (const u of demoUsers) {
    const exists = await prisma.user.findUnique({ where: { email: u.email }, select: { id: true } });
    if (exists) continue;
    const passwordHash = await bcrypt.hash("123456", 10);
    await prisma.user.create({ data: { ...u, passwordHash } });
    createdCount += 1;
  }
  console.log(`[seed] ensured ${demoUsers.length} demo users (created ${createdCount})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
