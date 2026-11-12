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
let token;
let otherToken;
const ids = [randomUUID(), randomUUID()];
const categoryIds = Array.from({ length: 5 }, () => randomUUID());

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a dedicated test database');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET = 'integration-test-secret';
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureApp(app);
  await app.init();
  prisma = app.get(PrismaService);
  await prisma.user.createMany({ data: ids.map((id) => ({ id, name: 'Dashboard test', email: `${id}@example.test`, passwordHash: 'unused' })) });
  await prisma.category.createMany({ data: categoryIds.map((id, index) => ({ id, userId: ids[index === 4 ? 1 : 0], name: `Category ${index}` })) });
  const transaction = (userId, categoryId, type, amount, date) => ({ userId, categoryId, type, amount, date: new Date(`${date}T00:00:00.000Z`), description: 'Test' });
  await prisma.transaction.createMany({ data: [
    transaction(ids[0], categoryIds[0], 'INCOME', '100.10', '2025-01-01'),
    transaction(ids[0], categoryIds[0], 'EXPENSE', '0.10', '2025-02-01'),
    transaction(ids[0], categoryIds[0], 'EXPENSE', '0.20', '2025-02-28'),
    transaction(ids[0], categoryIds[1], 'EXPENSE', '5.15', '2025-02-15'),
    transaction(ids[0], categoryIds[2], 'EXPENSE', '3.00', '2025-02-15'),
    transaction(ids[0], categoryIds[3], 'EXPENSE', '2.00', '2025-02-15'),
    transaction(ids[0], categoryIds[0], 'INCOME', '20.00', '2025-02-28'),
    transaction(ids[0], categoryIds[0], 'EXPENSE', '1.00', '2025-03-01'),
    transaction(ids[1], categoryIds[4], 'INCOME', '999999999999.99', '2025-02-01'),
  ] });
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  token = jwt.sign({ sub: ids[0] });
  otherToken = jwt.sign({ sub: ids[1] });
});

afterAll(async () => {
  if (prisma) await prisma.user.deleteMany({ where: { id: { in: ids } } });
  if (app) await app.close();
});

const dashboard = (credential = token) => request(app.getHttpServer()).get('/api/dashboard').set('Authorization', `Bearer ${credential}`);

test('historical balance and inclusive period totals use exact decimal strings and top three expenses', async () => {
  const res = await dashboard().query({ startDate: '2025-02-01', endDate: '2025-02-28' }).expect(200);
  expect(res.body).toMatchObject({ balance: '108.65', income: '20.00', expense: '10.45', topCategories: [
    { categoryId: categoryIds[1], name: 'Category 1', amount: '5.15' },
    { categoryId: categoryIds[2], name: 'Category 2', amount: '3.00' },
    { categoryId: categoryIds[3], name: 'Category 3', amount: '2.00' },
  ] });
});

test('optional bounds, empty periods and separate users', async () => {
  const all = await dashboard().expect(200);
  expect(all.body).toMatchObject({ balance: '108.65', income: '120.10', expense: '11.45' });
  const from = await dashboard().query({ startDate: '2025-03-01' }).expect(200);
  expect(from.body).toMatchObject({ balance: '108.65', income: '0.00', expense: '1.00' });
  const until = await dashboard().query({ endDate: '2025-01-01' }).expect(200);
  expect(until.body).toMatchObject({ income: '100.10', expense: '0.00', topCategories: [] });
  const empty = await dashboard().query({ startDate: '2026-01-01' }).expect(200);
  expect(empty.body).toMatchObject({ balance: '108.65', income: '0.00', expense: '0.00', topCategories: [] });
  const other = await dashboard(otherToken).expect(200);
  expect(other.body).toMatchObject({ balance: '999999999999.99', income: '999999999999.99', expense: '0.00', topCategories: [] });
});

test('calculates comparison totals, balance through the selected end date and period indicators', async () => {
  const res = await dashboard().query({
    startDate: '2025-02-01',
    endDate: '2025-02-28',
    comparisonStartDate: '2025-01-01',
    comparisonEndDate: '2025-01-31',
  }).expect(200);

  expect(res.body).toMatchObject({
    balance: '108.65',
    balanceAtEnd: '109.65',
    income: '20.00',
    expense: '10.45',
    comparison: {
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      balance: '100.10',
      income: '100.10',
      expense: '0.00',
    },
    changes: {
      balance: { value: '9.5', amountDifference: '9.55', status: 'available', direction: 'up' },
      income: { value: '-80.0', amountDifference: '-80.10', status: 'available', direction: 'down' },
      expense: { value: null, amountDifference: '10.45', status: 'new', direction: 'up' },
    },
    periodIndicators: {
      incomeGrowth: { value: '-80.0', amountDifference: '-80.10', status: 'available', direction: 'down' },
      expenseVariation: { value: null, amountDifference: '10.45', status: 'new', direction: 'up' },
      operationalParticipation: '52.3',
      periodResult: '9.55',
    },
  });
});

test('marks zero-baseline comparisons and rejects invalid comparison ranges', async () => {
  const res = await dashboard().query({
    startDate: '2025-01-01',
    endDate: '2025-01-31',
    comparisonStartDate: '2024-12-01',
    comparisonEndDate: '2024-12-31',
  }).expect(200);
  expect(res.body.changes).toMatchObject({
    balance: { value: null, amountDifference: '100.10', status: 'new', direction: 'up' },
    income: { value: null, amountDifference: '100.10', status: 'new', direction: 'up' },
    expense: { value: null, amountDifference: '0.00', status: 'no_baseline', direction: 'flat' },
  });

  for (const query of [
    { startDate: '2025-02-01', endDate: '2025-02-28', comparisonStartDate: '2025-01-01' },
    { comparisonStartDate: '2025-01-01', comparisonEndDate: '2025-01-31' },
    { startDate: '2025-02-01', endDate: '2025-02-28', comparisonStartDate: '2025-01-31', comparisonEndDate: '2025-01-01' },
    { startDate: '2025-02-01', endDate: '2025-02-28', comparisonStartDate: '2025-02-01', comparisonEndDate: '2025-02-15' },
  ]) {
    await dashboard().query(query).expect(400);
  }
});

test('rejects malformed dates, reversed bounds, unknown parameters and invalid credentials', async () => {
  for (const query of [{ startDate: '2025-02-30' }, { endDate: '2025-2-01' }, { startDate: '2025-03-01', endDate: '2025-02-01' }, { userId: ids[1] }]) {
    await dashboard().query(query).expect(400);
  }
  await request(app.getHttpServer()).get('/api/dashboard').expect(401);
  await dashboard('invalid').expect(401);
  await dashboard(new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: randomUUID() })).expect(401);
});
