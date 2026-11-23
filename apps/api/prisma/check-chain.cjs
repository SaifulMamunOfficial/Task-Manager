// Checks the chain-of-command rules through the real API.  node prisma/check-chain.cjs
// Local test only: gives Karim and Nila a random password just for this run (never printed).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();
const prisma = new PrismaClient();
const B = process.env.API_URL || 'http://localhost:4000/api';

async function login(name, password) {
  const u = await prisma.user.findFirstOrThrow({ where: { name } });
  if (!password) {
    password = crypto.randomBytes(9).toString('base64url');
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: false } });
  }
  const r = await fetch(B + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password }) });
  const j = await r.json();
  if (!j.accessToken) throw new Error('login failed for ' + name);
  return { id: u.id, h: { Authorization: 'Bearer ' + j.accessToken, 'Content-Type': 'application/json' } };
}

async function give(from, toName, title) {
  const to = await prisma.user.findFirstOrThrow({ where: { name: toName } });
  const r = await fetch(B + '/tasks', { method: 'POST', headers: from.h, body: JSON.stringify({ title: '[Chain test] ' + title, assigneeIds: [to.id] }) });
  const j = await r.json();
  return r.status < 300 ? 'ALLOWED' : `BLOCKED (${j.message})`;
}

(async () => {
  const rahim = await login('Rahim', 'Tm-6c36870ea6');
  const karim = await login('Karim');
  const nila = await login('Nila');
  const cases = [
    ['Rahim (Director)', rahim, 'Karim', 'a head of a secretariat', true],
    ['Rahim (Director)', rahim, 'Nila', 'a head of another secretariat', true],
    ['Rahim (Director)', rahim, 'Mina', 'a member directly', false],
    ['Rahim (Director)', rahim, 'Zed', 'a divisional member directly', false],
    ['Karim (head of Accounts)', karim, 'Mina', 'own member', true],
    ['Karim (head of Accounts)', karim, 'Omar', 'own member', true],
    ['Karim (head of Accounts)', karim, 'Zed', 'member of Dhaka Unit, which Karim also heads', true],
    ['Karim (head of Accounts)', karim, 'Nila', 'head of another secretariat', false],
    ['Nila (head of Administration)', nila, 'Mina', 'Mina is in BOTH divisions', true],
    ['Nila (head of Administration)', nila, 'Omar', 'Omar is only in Accounts', false],
    ['Nila (head of Administration)', nila, 'Zed', 'member of a department', false],
  ];
  let bad = 0;
  for (const [who, from, to, what, expect] of cases) {
    const res = await give(from, to, `${who} -> ${to}`);
    const good = (res === 'ALLOWED') === expect;
    if (!good) bad++;
    console.log(`${good ? 'OK ' : 'BAD'}  ${who.padEnd(30)} -> ${to.padEnd(6)} (${what}): ${res}`);
  }
  // clean up the test tasks
  const t = await prisma.task.findMany({ where: { title: { startsWith: '[Chain test]' } }, select: { id: true } });
  const ids = t.map((x) => x.id);
  const a = await prisma.taskAssignment.findMany({ where: { taskId: { in: ids } }, select: { id: true } });
  await prisma.taskUpdate.deleteMany({ where: { assignmentId: { in: a.map((x) => x.id) } } });
  await prisma.notification.deleteMany({ where: { OR: a.map((x) => ({ payload: { path: ['assignmentId'], equals: x.id } })) } }).catch(() => {});
  await prisma.taskAssignment.deleteMany({ where: { taskId: { in: ids } } });
  await prisma.task.deleteMany({ where: { id: { in: ids } } });
  console.log(bad ? `\n${bad} unexpected result(s)` : '\nAll rules behave as expected.');
})()
  .catch((e) => console.error(e.message))
  .finally(() => prisma.$disconnect());
