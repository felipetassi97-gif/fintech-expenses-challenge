require('reflect-metadata');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { NestFactory } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const request = require('supertest');
const bcrypt = require('bcrypt');
const { AppModule } = require('../dist/app.module');
const { configureApp } = require('../dist/app.config');
const { PrismaService } = require('../dist/prisma/prisma.module');

const email = `auth-${randomUUID()}@example.test`;
const password = 'senha-segura-123';
let app;
let prisma;
let token;
let userId;

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

test('register normalizes email and never returns the password hash', async () => {
  const res = await request(app.getHttpServer()).post('/api/auth/register')
    .send({ name: '  Ana  ', email: ` ${email.toUpperCase()} `, password }).expect(201);
  expect(res.body).toEqual({ id: expect.any(String), name: 'Ana', email, createdAt: expect.any(String) });
  userId = res.body.id;
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(user.passwordHash).not.toBe(password);
  expect(await bcrypt.compare(password, user.passwordHash)).toBe(true);
});

test('duplicate email is rejected after normalization', async () => {
  const res = await request(app.getHttpServer()).post('/api/auth/register')
    .send({ name: 'Ana', email: email.toUpperCase(), password }).expect(409);
  expect(res.body).toEqual({ statusCode: 409, message: 'Email already registered' });
});

test('registration rejects invalid input and passwords exceeding 72 UTF-8 bytes', async () => {
  await request(app.getHttpServer()).post('/api/auth/register')
    .send({ name: ' ', email: 'invalid', password: 'short', userId: '123' }).expect(400);
  await request(app.getHttpServer()).post('/api/auth/register')
    .send({ name: 'Ana', email, password: 'é'.repeat(37) }).expect(400);
});

test('login returns a token; invalid credentials receive the same response', async () => {
  const res = await request(app.getHttpServer()).post('/api/auth/login')
    .send({ email: ` ${email.toUpperCase()} `, password }).expect(200);
  expect(res.body).toEqual({ accessToken: expect.any(String) });
  token = res.body.accessToken;
  const wrongPassword = await request(app.getHttpServer()).post('/api/auth/login')
    .send({ email, password: 'wrong-password' }).expect(401);
  const unknownEmail = await request(app.getHttpServer()).post('/api/auth/login')
    .send({ email: 'unknown@example.test', password: 'wrong-password' }).expect(401);
  expect(wrongPassword.body).toEqual(unknownEmail.body);
});

test('me returns public data for the authenticated user', async () => {
  const res = await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  expect(res.body).toEqual({ id: userId, name: 'Ana', email, createdAt: expect.any(String) });
});

test('me rejects missing, invalid and expired tokens', async () => {
  await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', 'Bearer invalid').expect(401);
  const expired = new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: userId }, { expiresIn: -1 });
  await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${expired}`).expect(401);
});

test('me rejects a valid token whose user no longer exists', async () => {
  const missing = new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: randomUUID() });
  await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${missing}`).expect(401);
});

test('all protected resources reject a signed token after its user is deleted', async () => {
  const removedEmail = `removed-${randomUUID()}@example.test`;
  const user = await prisma.user.create({ data: { name: 'Removed', email: removedEmail, passwordHash: 'unused' } });
  const removedToken = new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: user.id });
  await prisma.user.delete({ where: { id: user.id } });
  const authorization = `Bearer ${removedToken}`;
  const responses = await Promise.all([
    request(app.getHttpServer()).get('/api/categories').set('Authorization', authorization),
    request(app.getHttpServer()).post('/api/categories').set('Authorization', authorization).send({ name: 'Test' }),
    request(app.getHttpServer()).get('/api/transactions').set('Authorization', authorization),
    request(app.getHttpServer()).get('/api/dashboard').set('Authorization', authorization),
    request(app.getHttpServer()).get('/api/auth/me').set('Authorization', authorization),
  ]);
  for (const response of responses) {
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ statusCode: 401, message: 'Invalid token' });
  }
});

test('protected resources reject a signed token with an invalid subject', async () => {
  const invalidSubject = new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: 'not-a-uuid' });
  const response = await request(app.getHttpServer()).get('/api/categories')
    .set('Authorization', `Bearer ${invalidSubject}`).expect(401);
  expect(response.body).toEqual({ statusCode: 401, message: 'Invalid token' });
});

test('application fails to start without a JWT secret', () => {
  const result = spawnSync(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(), env: { ...process.env, JWT_SECRET: ' ' }, encoding: 'utf8', timeout: 10000,
  });
  expect(result.status).not.toBe(0);
  expect(result.stdout + result.stderr).toContain('JWT_SECRET must be configured');
});
