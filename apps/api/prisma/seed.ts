import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_POSITIONS } from '@tm/shared';
import * as dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  // 1) Dedicated admin account (not part of the org hierarchy)
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: 'System Admin', email, isAdmin: true, passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true },
  });

  // 2) Head office
  const head = await prisma.unit.findFirst({ where: { type: 'HEAD_OFFICE' } });
  if (!head) await prisma.unit.create({ data: { name: 'Head Office', type: 'HEAD_OFFICE' } });

  // 3) Default positions
  for (const p of DEFAULT_POSITIONS) {
    // Secretaries and unit heads may give tasks only inside their own division.
    const head = ['Secretary', 'Unit Head'].includes(p.title);
    await prisma.position.upsert({ where: { title: p.title }, update: { titleBn: p.titleBn }, create: { ...p, ownTeamOnly: head } });
  }

  // 4) Default delegation matrix (admin can change it later)
  const pos = Object.fromEntries((await prisma.position.findMany()).map((p) => [p.title, p.id]));
  const matrix: Record<string, string[]> = {
    // Chain of command: nobody skips the head of a division.
    Director: ['Assistant Director', 'Secretary'],
    'Assistant Director': ['Secretary', 'Unit Head'],
    Secretary: ['Member'],
    'Unit Head': ['Member'],
    Member: [],
  };
  for (const [from, tos] of Object.entries(matrix)) {
    for (const to of tos) {
      await prisma.delegationPermission.upsert({
        where: { fromPositionId_toPositionId: { fromPositionId: pos[from], toPositionId: pos[to] } },
        update: {},
        create: { fromPositionId: pos[from], toPositionId: pos[to] },
      });
    }
  }

  // 5) Global visibility default = DIRECT
  await prisma.visibilitySetting.upsert({
    where: { scope_scopeRefId: { scope: 'GLOBAL', scopeRefId: '' } },
    update: {},
    create: { scope: 'GLOBAL', scopeRefId: '', mode: 'DIRECT' },
  });

  console.log(`Seed complete. Admin login: ${email} (change the password on first login)`);
}

main().finally(() => prisma.$disconnect());
