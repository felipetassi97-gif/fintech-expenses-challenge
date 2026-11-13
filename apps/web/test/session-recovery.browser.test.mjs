import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const browserPath = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(path => path && existsSync(path));
const webRoot = fileURLToPath(new URL('..', import.meta.url));
const vite = fileURLToPath(new URL('../../../node_modules/.bin/vite', import.meta.url));
const user = { id: 'u1', name: 'Usuário Teste', email: 'teste@example.test' };

test('session recovery preserves the route and token after temporary failures', { skip: !browserPath && 'Chrome/Chromium is not installed; set CHROME_PATH', timeout: 60000 }, async t => {
  const listener = createServer();
  await new Promise((resolve, reject) => listener.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port } = listener.address();
  await new Promise(resolve => listener.close(resolve));
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(vite, ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: webRoot, env: { ...process.env, VITE_API_URL: 'http://127.0.0.1:9999/api' }, stdio: 'ignore' });
  t.after(() => server.kill());
  const deadline = Date.now() + 15000;
  while (true) {
    if (server.exitCode !== null) throw new Error(`Vite exited: ${server.exitCode}`);
    try { if ((await fetch(url)).ok) break; } catch { /* Starting. */ }
    if (Date.now() > deadline) throw new Error('Vite did not start');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox'] });
  t.after(() => browser.close());

  async function openApp(t, handleRequest) {
    const context = await browser.newContext();
    t.after(() => context.close());
    const page = await context.newPage();
    await page.addInitScript(() => sessionStorage.setItem('finance_session', 'saved-token'));
    await page.route('**/api/**', async route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': '*',
      };
      const json = (status, body) => route.fulfill({ status, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (pathname === '/api/auth/me') return handleRequest({ route, json, request });
      if (pathname === '/api/auth/login') return json(200, { accessToken: 'new-token' });
      if (pathname === '/api/categories') return json(200, []);
      if (pathname === '/api/transactions') return json(200, { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
      return json(404, { message: `Unexpected request: ${pathname}` });
    });
    await page.goto(`${url}/#/transactions?type=EXPENSE`);
    return page;
  }

  await t.test('401 removes the rejected token and sends the user to login', async t => {
    const page = await openApp(t, ({ json }) => json(401, { message: 'Unauthorized' }));
    await page.getByRole('heading', { name: 'Acesse sua conta' }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('finance_session')), null);
    assert.equal(await page.getByRole('button', { name: 'Tentar novamente' }).count(), 0);
  });

  await t.test('503 keeps the token, blocks private content, and retry restores the original route', async t => {
    let authChecks = 0;
    let canRecover = false;
    const page = await openApp(t, async ({ json }) => {
      authChecks += 1;
      if (!canRecover) return json(503, { message: 'Unavailable' });
      await new Promise(resolve => setTimeout(resolve, 250));
      return json(200, user);
    });
    await page.getByRole('heading', { name: 'Não foi possível confirmar sua sessão' }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('finance_session')), 'saved-token');
    assert.equal(await page.getByRole('heading', { name: 'Transações' }).count(), 0);
    const initialCheckCount = authChecks;
    canRecover = true;
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await page.getByRole('status').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Tentar novamente' }).count(), 0);
    await page.getByRole('heading', { name: 'Transações', exact: true }).waitFor();
    assert.equal(new URL(page.url()).hash, '#/transactions?type=EXPENSE');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('finance_session')), 'saved-token');
    assert.equal(authChecks, initialCheckCount + 1);
  });

  await t.test('network failure keeps the token and allows manual login', async t => {
    let networkAvailable = false;
    const page = await openApp(t, ({ json, route }) => networkAvailable
      ? json(200, user)
      : route.abort('failed'));
    await page.getByRole('heading', { name: 'Não foi possível confirmar sua sessão' }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('finance_session')), 'saved-token');
    networkAvailable = true;
    await page.getByRole('button', { name: 'Ir para login' }).click();
    await page.getByRole('heading', { name: 'Acesse sua conta' }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('finance_session')), null);

    await page.getByLabel('E-mail').fill('teste@example.test');
    await page.getByLabel('Senha').fill('senha-segura');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.getByRole('heading', { name: 'Olá, Usuário!' }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('finance_session')), 'new-token');
  });
});
