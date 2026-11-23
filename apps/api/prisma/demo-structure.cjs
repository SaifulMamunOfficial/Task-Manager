// LOCAL TEST DATA for the chain-of-command rules. Run from apps/api:  node prisma/demo-structure.cjs
// Sets up: Director, two secretariat divisions with their own head, one member in two divisions, one department.
// It does not print any password; the test users get a random one (use the web admin to reset them if you need to sign in).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  const pos = async (title) => (await prisma.position.findUniqueOrThrow({ where: { title } })).id;
  const unit = await prisma.unit.findFirstOrThrow({ where: { name: 'Head Office' } });
  const dhaka = await prisma.unit.findFirstOrThrow({ where: { name: 'Dhaka Unit' } });
  const user = async (name) => prisma.user.findFirstOrThrow({ where: { name } });

  // positions: heads are limited to their own team; add the missing "Secretariat Member"
  await prisma.position.updateMany({ where: { title: { in: ['Secretariat', 'Department Director'] } }, data: { ownTeamOnly: true } });
  await prisma.position.upsert({ where: { title: 'Secretariat Member' }, update: {}, create: { title: 'Secretariat Member', titleBn: 'সেক্রেটারিয়েট সদস্য', level: 5 } });
  const [D, AD, SEC, SECM, DD, M] = await Promise.all(['Director', 'Assistant Director', 'Secretariat', 'Secretariat Member', 'Department Director', 'Member'].map(pos));

  // who may give to whom (by position)
  await prisma.delegationPermission.deleteMany({});
  const rules = [[D, AD], [D, SEC], [AD, SEC], [AD, DD], [SEC, SECM], [DD, M]];
  await prisma.delegationPermission.createMany({ data: rules.map(([f, t]) => ({ fromPositionId: f, toPositionId: t })) });

  // two secretariat divisions in the head office
  const accounts = await prisma.secretariat.upsert({ where: { id: 'demo-div-accounts' }, update: {}, create: { id: 'demo-div-accounts', name: 'Accounts', nameBn: 'হিসাব সেক্রেটারিয়েট', unitId: unit.id } });
  const admin = await prisma.secretariat.upsert({ where: { id: 'demo-div-admin' }, update: { name: 'Administration', nameBn: 'প্রশাসন সেক্রেটারিয়েট' }, create: { id: 'demo-div-admin', name: 'Administration', nameBn: 'প্রশাসন সেক্রেটারিয়েট', unitId: unit.id } });

  const rahim = await user('Rahim');
  const karim = await user('Karim');
  const mina = await user('Mina');
  const omar = await user('Omar');
  const zed = await user('Zed');
  let nila = await prisma.user.findFirst({ where: { email: 'nila@example.com' } });
  if (!nila) {
    nila = await prisma.user.create({
      data: { name: 'Nila', nameBn: 'নীলা', email: 'nila@example.com', language: 'bn', passwordHash: await bcrypt.hash(crypto.randomBytes(9).toString('base64url'), 10) },
    });
  }

  // clear and rebuild the position rows of these people
  await prisma.userPosition.deleteMany({ where: { userId: { in: [rahim.id, karim.id, mina.id, omar.id, zed.id, nila.id] } } });
  const row = (userId, positionId, unitId, extra = {}) => ({ userId, positionId, unitId, ...extra });
  await prisma.userPosition.createMany({
    data: [
      row(rahim.id, D, unit.id, { isPrimary: true }),
      // Accounts: head Karim, members Mina and Omar
      row(karim.id, SEC, unit.id, { secretariatId: accounts.id, reportsToUserId: rahim.id, isPrimary: true }),
      row(mina.id, SECM, unit.id, { secretariatId: accounts.id, reportsToUserId: karim.id, isPrimary: true }),
      row(omar.id, SECM, unit.id, { secretariatId: accounts.id, reportsToUserId: karim.id, isPrimary: true }),
      // Administration: head Nila; Mina is ALSO a member here (two divisions)
      row(nila.id, SEC, unit.id, { secretariatId: admin.id, reportsToUserId: rahim.id, isPrimary: true }),
      row(mina.id, SECM, unit.id, { secretariatId: admin.id, reportsToUserId: nila.id }),
      // a department (unit): Karim also heads Dhaka, Zed is its member
      row(karim.id, DD, dhaka.id, { reportsToUserId: rahim.id }),
      row(zed.id, M, dhaka.id, { reportsToUserId: karim.id, isPrimary: true }),
    ],
  });
  await prisma.secretariat.update({ where: { id: accounts.id }, data: { secretaryUserId: karim.id } });
  await prisma.secretariat.update({ where: { id: admin.id }, data: { secretaryUserId: nila.id } });
  console.log('structure ready');
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
