require('reflect-metadata');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const request = require('supertest');
const { Module } = require('@nestjs/common');
const { AuthModule } = require('../dist/auth/auth.module');
const { TransactionsModule } = require('../dist/transactions/transactions.module');
const { PrismaModule } = require('../dist/prisma/prisma.module');
class TestModule {}
Module({ imports: [PrismaModule, AuthModule, TransactionsModule] })(TestModule);
const { configureApp } = require('../dist/app.config');
const { PrismaService } = require('../dist/prisma/prisma.module');

const emails = [0, 1].map(() => `transactions-${randomUUID()}@example.test`);
let app, prisma, users, categories, tokens, transactionId;
const auth = index => ({ Authorization: `Bearer ${tokens[index]}` });
const payload = (categoryId, overrides = {}) => ({ description: 'Almoço', amount: '12.50', type: 'EXPENSE', categoryId, date: '2026-02-28', ...overrides });

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a dedicated test database');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET = 'integration-test-secret';
  app = await NestFactory.create(TestModule, { logger: false, abortOnError: false });
  configureApp(app);
  await app.init();
  prisma = app.get(PrismaService);
  users = await Promise.all(emails.map(email => prisma.user.create({ data: { email, name: 'Test', passwordHash: 'unused' } })));
  categories = await Promise.all(users.map(user => prisma.category.create({ data: { name: 'Test', userId: user.id } })));
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  tokens = users.map(user => jwt.sign({ sub: user.id }));
});
afterAll(async () => {
  if (prisma) await prisma.user.deleteMany({ where: { email: { in: emails } } });
  if (app) await app.close();
});

test('requires authentication and creates a transaction with decimal and date strings', async () => {
  await request(app.getHttpServer()).get('/api/transactions').expect(401);
  const res = await request(app.getHttpServer()).post('/api/transactions').set(auth(0)).send(payload(categories[0].id)).expect(201);
  expect(res.body).toMatchObject({ categoryId: categories[0].id, amount: '12.50', date: '2026-02-28' });
  expect(res.body).not.toHaveProperty('userId');
  transactionId = res.body.id;
  await request(app.getHttpServer()).get(`/api/transactions/${transactionId}`).set(auth(0)).expect(200);
});

test('rejects invalid input and categories belonging to other users', async () => {
  const server = app.getHttpServer();
  for (const changes of [{ description: ' \t ' }, { amount: 1 }, { amount: '0' }, { amount: '-1' }, { amount: '1.001' }, { date: '2026-02-30' }, { date: '2026-02-28T00:00:00Z' }, { userId: users[1].id }]) {
    await request(server).post('/api/transactions').set(auth(0)).send(payload(categories[0].id, changes)).expect(400);
  }
  await request(server).post('/api/transactions').set(auth(0)).send(payload(categories[1].id)).expect(404);
  await request(server).patch(`/api/transactions/${transactionId}`).set(auth(0)).send({ categoryId: categories[1].id }).expect(404);
  await request(server).patch(`/api/transactions/${transactionId}`).set(auth(0)).send({ amount: null }).expect(400);
  await request(server).patch(`/api/transactions/${transactionId}`).set(auth(0)).send({ description: ' \t ' }).expect(400);
});

test('isolates reads, updates and deletes', async () => {
  const server = app.getHttpServer();
  for (const method of ['get', 'patch', 'delete']) {
    const req = request(server)[method](`/api/transactions/${transactionId}`).set(auth(1));
    await (method === 'patch' ? req.send({ description: 'Other' }) : req).expect(404);
  }
  const list = await request(server).get('/api/transactions').set(auth(1)).expect(200);
  expect(list.body.pagination.total).toBe(0);
  await request(server).get('/api/transactions/not-a-uuid').set(auth(0)).expect(404);
});

test('filters inclusively and paginates without exposing other users data', async () => {
  const server = app.getHttpServer();
  for (const date of ['2026-03-01', '2026-03-02']) {
    await request(server).post('/api/transactions').set(auth(0)).send(payload(categories[0].id, { date })).expect(201);
  }
  await request(server).post('/api/transactions').set(auth(0)).send(payload(categories[0].id, { date: '2026-03-01', type: 'INCOME' })).expect(201);
  await request(server).post('/api/transactions').set(auth(1)).send(payload(categories[1].id, { date: '2026-03-01' })).expect(201);
  const query = { type: 'EXPENSE', categoryId: categories[0].id, startDate: '2026-02-28', endDate: '2026-03-01', limit: 1 };
  const first = await request(server).get('/api/transactions').set(auth(0)).query(query).expect(200);
  const second = await request(server).get('/api/transactions').set(auth(0)).query({ ...query, page: 2 }).expect(200);
  expect(first.body).toMatchObject({ pagination: { total: 2, page: 1, limit: 1, totalPages: 2 }, data: [{ date: '2026-03-01' }] });
  expect(second.body).toMatchObject({ pagination: { total: 2, page: 2 }, data: [{ date: '2026-02-28' }] });
  await request(server).get('/api/transactions').set(auth(0)).query({ startDate: '2026-03-02', endDate: '2026-03-01' }).expect(400);
  await request(server).get('/api/transactions').set(auth(0)).query({ page: 0 }).expect(400);
});

test('updates and deletes the owner transaction', async () => {
  const server = app.getHttpServer();
  const updated = await request(server).patch(`/api/transactions/${transactionId}`).set(auth(0)).send({ amount: '99.99', date: '2026-01-01', type: 'INCOME' }).expect(200);
  expect(updated.body).toMatchObject({ amount: '99.99', date: '2026-01-01', type: 'INCOME' });
  await request(server).delete(`/api/transactions/${transactionId}`).set(auth(0)).expect(204);
  await request(server).get(`/api/transactions/${transactionId}`).set(auth(0)).expect(404);
});
