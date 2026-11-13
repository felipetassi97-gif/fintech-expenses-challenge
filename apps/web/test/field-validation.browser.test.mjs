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
const rangeError = 'A data inicial deve ser igual ou anterior à data final.';

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite exited with code ${child.exitCode}`);
    try { if ((await fetch(url)).ok) return; } catch { /* Server is starting. */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Vite did not start');
}

const change = { value: null, amountDifference: null, status: 'no_baseline', direction: 'flat' };
const dashboard = {
  balance: '13612.85',
  historicalBalance: '13612.85',
  balanceAtEnd: '13612.85',
  income: '25300.00',
  expense: '11687.15',
  comparison: null,
  changes: { balance: change, income: change, expense: change },
  periodIndicators: {
    incomeGrowth: change,
    expenseVariation: change,
    operationalParticipation: '46.2',
    periodResult: '13612.85',
  },
  topCategories: [{ categoryId: 'c1', name: 'Fornecedores', amount: '6350.75' }],
};

test('zero amount and inverted date ranges show field errors and skip invalid requests', { skip: !browserPath && 'Chrome/Chromium is not installed; set CHROME_PATH', timeout: 60000 }, async t => {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(vite, ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: webRoot,
    env: { ...process.env, VITE_API_URL: `${url}/api` },
    stdio: 'ignore',
  });
  t.after(() => server.kill());
  await waitForServer(url, server);

  const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox'] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.addInitScript(() => sessionStorage.setItem('finance_session', 'field-validation-token'));

  const calls = { dashboards: [], transactions: [], transactionPosts: 0 };
  await page.route('**/api/**', async route => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const path = requestUrl.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
    if (path === '/api/auth/me') return json({ id: 'u1', name: 'Usuário de Teste', email: 'teste@example.test' });
    if (path === '/api/categories') return json([{ id: 'c1', name: 'Fornecedores', description: null }]);
    if (path === '/api/dashboard') {
      calls.dashboards.push(Object.fromEntries(requestUrl.searchParams));
      return json(dashboard);
    }
    if (path === '/api/transactions' && request.method() === 'POST') {
      calls.transactionPosts++;
      return json({ id: 'new-transaction' }, 201);
    }
    if (path === '/api/transactions') {
      calls.transactions.push(Object.fromEntries(requestUrl.searchParams));
      const limit = Number(requestUrl.searchParams.get('limit') || 10);
      return json({ data: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Unexpected test request' }) });
  });

  await page.goto(`${url}/#/dashboard`);
  await page.getByRole('button', { name: 'Adicionar transação' }).waitFor();
  await page.getByRole('button', { name: 'Adicionar transação' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Descrição', { exact: true }).fill('QA-02 valor zero');
  const category = dialog.locator('select').nth(1);
  await category.locator('option[value="c1"]').waitFor({ state: 'attached' });
  await category.selectOption('c1');
  const amount = dialog.getByLabel('Valor (R$)');
  await amount.fill('0');
  await dialog.getByRole('button', { name: 'Salvar transação' }).click();
  await page.getByText('O valor deve ser maior que zero.', { exact: true }).waitFor();
  assert.equal(await amount.getAttribute('aria-invalid'), 'true');
  assert.equal(await amount.getAttribute('aria-describedby'), 'transaction-amount-error');
  assert.equal(await amount.evaluate(element => element === document.activeElement), true);
  assert.equal(calls.transactionPosts, 0, 'zero amount must be rejected before sending a request');
  await amount.fill('0,01');
  assert.equal(await amount.getAttribute('aria-invalid'), null, 'editing the value should clear the field error');
  assert.equal(await page.getByText('O valor deve ser maior que zero.', { exact: true }).count(), 0);
  assert.equal(calls.transactionPosts, 0);
  await dialog.getByRole('button', { name: 'Cancelar' }).click();

  await page.goto(`${url}/#/transactions?startDate=2026-11-12&endDate=2026-11-01`);
  await page.getByText(rangeError, { exact: true }).waitFor();
  const listStart = page.getByLabel('De', { exact: true });
  const listEnd = page.getByLabel('Até', { exact: true });
  assert.equal(await listStart.getAttribute('aria-invalid'), 'true');
  assert.equal(await listEnd.getAttribute('aria-invalid'), 'true');
  assert.equal(await listStart.getAttribute('aria-describedby'), 'transaction-date-range-error');
  assert.equal(calls.transactions.filter(query => query.limit === '10').length, 0, 'invalid transaction dates must not be sent to the API');

  const validListResponse = page.waitForResponse(response => {
    const responseUrl = new URL(response.url());
    return responseUrl.pathname === '/api/transactions'
      && responseUrl.searchParams.get('limit') === '10'
      && responseUrl.searchParams.get('startDate') === '2026-11-01'
      && responseUrl.searchParams.get('endDate') === '2026-11-01';
  });
  await listStart.fill('2026-11-01');
  await validListResponse;
  await page.getByText(rangeError, { exact: true }).waitFor({ state: 'detached' });
  assert.equal(await listStart.getAttribute('aria-invalid'), null);
  assert.equal(await listEnd.getAttribute('aria-invalid'), null);

  await page.goto(`${url}/#/dashboard`);
  await page.getByRole('button', { name: 'Personalizado', exact: true }).click();
  const dashboardStart = page.getByLabel('De', { exact: true });
  const dashboardEnd = page.getByLabel('Até', { exact: true });
  await dashboardEnd.waitFor();
  const baselineDashboardResponse = page.waitForResponse(response => {
    const responseUrl = new URL(response.url());
    return responseUrl.pathname === '/api/dashboard' && responseUrl.searchParams.get('endDate') === '2026-11-10';
  });
  const baselineRecentResponse = page.waitForResponse(response => {
    const responseUrl = new URL(response.url());
    return responseUrl.pathname === '/api/transactions'
      && responseUrl.searchParams.get('limit') === '5'
      && responseUrl.searchParams.get('endDate') === '2026-11-10';
  });
  await dashboardEnd.fill('2026-11-10');
  await Promise.all([baselineDashboardResponse, baselineRecentResponse]);
  const dashboardCount = calls.dashboards.length;
  const recentCount = calls.transactions.filter(query => query.limit === '5').length;

  await dashboardStart.fill('2026-11-20');
  await page.getByText(rangeError, { exact: true }).waitFor();
  assert.equal(await dashboardStart.getAttribute('aria-invalid'), 'true');
  assert.equal(await dashboardEnd.getAttribute('aria-invalid'), 'true');
  assert.equal(await dashboardStart.getAttribute('aria-describedby'), 'dashboard-date-range-error');
  assert.equal(calls.dashboards.length, dashboardCount, 'invalid dashboard dates must not be sent to the API');
  assert.equal(calls.transactions.filter(query => query.limit === '5').length, recentCount, 'invalid dashboard dates must not be sent for recent transactions');

  const validDashboardResponse = page.waitForResponse(response => {
    const responseUrl = new URL(response.url());
    return responseUrl.pathname === '/api/dashboard'
      && responseUrl.searchParams.get('startDate') === '2026-11-09'
      && responseUrl.searchParams.get('endDate') === '2026-11-10';
  });
  const validRecentResponse = page.waitForResponse(response => {
    const responseUrl = new URL(response.url());
    return responseUrl.pathname === '/api/transactions'
      && responseUrl.searchParams.get('limit') === '5'
      && responseUrl.searchParams.get('startDate') === '2026-11-09'
      && responseUrl.searchParams.get('endDate') === '2026-11-10';
  });
  await dashboardStart.fill('2026-11-09');
  await Promise.all([validDashboardResponse, validRecentResponse]);
  await page.getByText(rangeError, { exact: true }).waitFor({ state: 'detached' });
  assert.equal(await dashboardStart.getAttribute('aria-invalid'), null);
  assert.equal(await dashboardEnd.getAttribute('aria-invalid'), null);
  assert.equal(calls.dashboards.some(query => query.startDate > query.endDate), false);
  assert.equal(calls.transactions.some(query => query.startDate && query.endDate && query.startDate > query.endDate), false);
});
