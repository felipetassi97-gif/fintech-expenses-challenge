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

test('transaction filters, history and pagination remain consistent', { skip: !browserPath && 'Chrome/Chromium is not installed; set CHROME_PATH', timeout: 60000 }, async t => {
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
  const page = await browser.newPage();
  await page.addInitScript(() => sessionStorage.setItem('finance_session', 'test-token'));
  let total = 11;
  await page.route('**/api/**', async route => {
    const req = route.request();
    const parsed = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,DELETE', 'Access-Control-Allow-Headers': '*' } });
    if (parsed.pathname === '/api/auth/me') return json(200, { id: 'u', name: 'Teste', email: 'test@example.test' });
    if (parsed.pathname === '/api/categories') return json(200, [{ id: 'a', name: 'Operações', description: null }]);
    if (parsed.pathname.startsWith('/api/transactions/') && req.method() === 'DELETE') { total = 10; return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } }); }
    if (parsed.pathname === '/api/transactions') {
      const number = Number(parsed.searchParams.get('page') || 1);
      const item = { id: 't', categoryId: 'a', description: 'Item de teste', type: 'EXPENSE', amount: '1.00', date: '2026-11-01' };
      return json(200, { data: total && number <= Math.ceil(total / 10) ? [item] : [], pagination: { page: number, limit: 10, total, totalPages: Math.ceil(total / 10) } });
    }
    return json(404, { message: 'Unexpected test request' });
  });
  const initial = '/#/transactions?type=EXPENSE&categoryId=a&startDate=2026-11-01&endDate=2026-11-12&page=2';
  await page.goto(url + initial);
  await page.getByRole('button', { name: 'Limpar' }).click();
  await page.waitForURL(/#\/transactions\?type=EXPENSE&categoryId=a$/);
  assert.equal(await page.locator('.filters select').nth(0).inputValue(), 'EXPENSE');
  assert.equal(await page.locator('.filters select').nth(1).inputValue(), 'a');
  await page.goBack();
  await page.waitForURL(/startDate=2026-11-01/);
  assert.equal(await page.getByLabel('De', { exact: true }).inputValue(), '2026-11-01');
  assert.equal(await page.getByLabel('Até', { exact: true }).inputValue(), '2026-11-12');
  await page.reload();
  assert.equal(await page.getByLabel('De', { exact: true }).inputValue(), '2026-11-01');
  await page.locator('.filters select').first().waitFor();
  await page.evaluate(() => {
    const [type, category] = document.querySelectorAll('.filters select');
    type.value = 'INCOME';
    type.dispatchEvent(new Event('change', { bubbles: true }));
    category.value = '';
    category.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForURL(url => url.hash.includes('type=INCOME') && !url.hash.includes('categoryId=') && !url.hash.includes('page='));
  await page.goto(`${url}/#/transactions?page=999`);
  await page.waitForURL(/page=2$/);
  await page.getByText('Item de teste').waitFor();
  await page.getByRole('button', { name: 'Excluir' }).click();
  const deletionDialog = page.getByRole('dialog');
  await deletionDialog.getByText('Esta ação não pode ser desfeita.', { exact: true }).waitFor();
  await deletionDialog.getByRole('button', { name: 'Excluir transação' }).click();
  await page.waitForURL(/#\/transactions$/);
  await page.getByText('Transação excluída.').waitFor();
  total = 0;
  await page.goto(`${url}/#/transactions?page=999`);
  await page.waitForURL(/#\/transactions$/);
  await page.getByText('Nenhuma transação encontrada para os filtros selecionados.').waitFor();
  await page.goto(`${url}/#/transactions?page=invalid`);
  await page.waitForURL(/#\/transactions$/);
});
