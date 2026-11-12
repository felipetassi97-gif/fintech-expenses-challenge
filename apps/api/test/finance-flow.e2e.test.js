require('reflect-metadata');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const request = require('supertest');
const { AppModule } = require('../dist/app.module');
const { configureApp } = require('../dist/app.config');
const { PrismaService } = require('../dist/prisma/prisma.module');

const email = `flow-${randomUUID()}@example.test`;
let app;
let prisma;

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a dedicated test database');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET = 'integration-test-secret';
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureApp(app);
  await app.init();
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  if (prisma) await prisma.user.deleteMany({ where: { email } });
  if (app) await app.close();
});

test('registration through financial operations and dashboard', async () => {
  const server = app.getHttpServer();
  const password = 'secure-pass-123';
  await request(server).post('/api/auth/register').send({ name: 'Finance user', email, password }).expect(201);
  const login = await request(server).post('/api/auth/login').send({ email, password }).expect(200);
  const authorization = `Bearer ${login.body.accessToken}`;
  const category = await request(server).post('/api/categories').set('Authorization', authorization).send({ name: 'Expenses' }).expect(201);
  const transaction = await request(server).post('/api/transactions').set('Authorization', authorization)
    .send({ categoryId: category.body.id, description: 'Lunch', amount: '10.25', type: 'EXPENSE', date: '2026-01-15' }).expect(201);
  const dashboard = await request(server).get('/api/dashboard').set('Authorization', authorization)
    .query({ startDate: '2026-01-01', endDate: '2026-01-31' }).expect(200);
  expect(dashboard.body).toMatchObject({ balance: '-10.25', income: '0.00', expense: '10.25', topCategories: [
    { categoryId: category.body.id, name: 'Expenses', amount: '10.25' },
  ] });
  await request(server).delete(`/api/categories/${category.body.id}`).set('Authorization', authorization).expect(409);
  await request(server).delete(`/api/transactions/${transaction.body.id}`).set('Authorization', authorization).expect(200);
  await request(server).delete(`/api/categories/${category.body.id}`).set('Authorization', authorization).expect(204);
});
