require('reflect-metadata');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const request = require('supertest');
const { AppModule } = require('../dist/app.module');
const { configureApp } = require('../dist/app.config');
const { PrismaService } = require('../dist/prisma/prisma.module');

let app;
let prisma;
let users;
let tokens;
const ids = [randomUUID(), randomUUID()];

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a dedicated test database');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET = 'integration-test-secret';
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureApp(app);
  await app.init();
  prisma = app.get(PrismaService);
  users = await Promise.all(ids.map((id) => prisma.user.create({ data: {
    id, name: 'Test', email: `${id}@example.test`, passwordHash: 'unused',
  } })));
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  tokens = users.map((user) => `Bearer ${jwt.sign({ sub: user.id })}`);
});

afterAll(async () => {
  if (prisma) {
    await prisma.transaction.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  if (app) await app.close();
});

const api = () => request(app.getHttpServer());

test('requires a valid JWT', async () => {
  await api().get('/api/categories').expect(401);
  await api().post('/api/categories').set('Authorization', 'Bearer invalid').send({ name: 'A' }).expect(401);
});

test('creates, lists, reads, updates and deletes categories for the owner', async () => {
  const created = await api().post('/api/categories').set('Authorization', tokens[0])
    .send({ name: 'Food', description: 'Meals' }).expect(201);
  expect(created.body).toMatchObject({ id: expect.any(String), userId: ids[0], name: 'Food', description: 'Meals' });
  const id = created.body.id;
  const list = await api().get('/api/categories').set('Authorization', tokens[0]).expect(200);
  expect(list.body).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
  await api().get(`/api/categories/${id}`).set('Authorization', tokens[0]).expect(200);
  const updated = await api().patch(`/api/categories/${id}`).set('Authorization', tokens[0])
    .send({ name: 'Groceries', description: null }).expect(200);
  expect(updated.body).toMatchObject({ id, name: 'Groceries', description: null });
  await api().delete(`/api/categories/${id}`).set('Authorization', tokens[0]).expect(204);
  await api().get(`/api/categories/${id}`).set('Authorization', tokens[0]).expect(404);
});

test('hides other users categories for every operation', async () => {
  const category = await prisma.category.create({ data: { userId: ids[0], name: 'Private' } });
  const list = await api().get('/api/categories').set('Authorization', tokens[1]).expect(200);
  expect(list.body.some((item) => item.id === category.id)).toBe(false);
  await api().get(`/api/categories/${category.id}`).set('Authorization', tokens[1]).expect(404);
  await api().patch(`/api/categories/${category.id}`).set('Authorization', tokens[1]).send({ name: 'Changed' }).expect(404);
  await api().delete(`/api/categories/${category.id}`).set('Authorization', tokens[1]).expect(404);
  await api().get('/api/categories/not-a-uuid').set('Authorization', tokens[0]).expect(404);
});

test('validates DTOs and rejects userId injection', async () => {
  for (const body of [{}, { name: '' }, { name: ' \t ' }, { name: 'a'.repeat(121) }, { name: 'A', description: 'a'.repeat(501) }, { name: 'A', userId: ids[1] }]) {
    await api().post('/api/categories').set('Authorization', tokens[0]).send(body).expect(400);
  }
  const category = await prisma.category.create({ data: { userId: ids[0], name: 'Valid' } });
  await api().patch(`/api/categories/${category.id}`).set('Authorization', tokens[0]).send({ name: null }).expect(400);
  await api().patch(`/api/categories/${category.id}`).set('Authorization', tokens[0]).send({ name: ' \t ' }).expect(400);
  await api().patch(`/api/categories/${category.id}`).set('Authorization', tokens[0]).send({ userId: ids[1] }).expect(400);
});

test('deleting a category also deletes its transactions', async () => {
  const category = await prisma.category.create({ data: { userId: ids[0], name: 'Linked' } });
  const transaction = await prisma.transaction.create({ data: { userId: ids[0], categoryId: category.id, description: 'Test', amount: '1.00', type: 'EXPENSE', date: new Date('2026-01-01') } });
  await api().delete(`/api/categories/${category.id}`).set('Authorization', tokens[1]).expect(404);
  await api().delete(`/api/categories/${category.id}`).set('Authorization', tokens[0]).expect(204);
  expect(await prisma.category.findUnique({ where: { id: category.id } })).toBeNull();
  expect(await prisma.transaction.findUnique({ where: { id: transaction.id } })).toBeNull();
});

test('deleting a category cascades to a transaction that commits concurrently', async () => {
  const category = await prisma.category.create({ data: { userId: ids[0], name: 'Concurrent' } });
  let transactionId;
  let inserted;
  const ready = new Promise((resolve) => { inserted = resolve; });
  let release;
  const proceed = new Promise((resolve) => { release = resolve; });
  const transaction = prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({ data: { userId: ids[0], categoryId: category.id, description: 'Concurrent', amount: '1.00', type: 'EXPENSE', date: new Date('2026-01-01') } });
    transactionId = created.id;
    const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
    inserted(pid);
    await proceed;
  }, { timeout: 15000 });
  const blockerPid = await ready;
  const deletion = api().delete(`/api/categories/${category.id}`).set('Authorization', tokens[0]).then((response) => response);
  try {
    const deadline = Date.now() + 5000;
    let blocked = false;
    while (Date.now() < deadline && !blocked) {
      const rows = await prisma.$queryRaw`SELECT 1 FROM pg_stat_activity WHERE ${blockerPid} = ANY(pg_blocking_pids(pid))`;
      blocked = rows.length > 0;
      if (!blocked) await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(blocked).toBe(true);
  } finally {
    release();
  }
  await transaction;
  expect((await deletion).status).toBe(204);
  expect(await prisma.transaction.findUnique({ where: { id: transactionId } })).toBeNull();
});
