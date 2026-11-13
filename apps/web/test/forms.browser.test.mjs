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
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};
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

test('pending forms block duplicate submissions and retain input after failure', { skip: !browserPath && 'Chrome/Chromium is not installed; set CHROME_PATH', timeout: 60000 }, async t => {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(vite, ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: webRoot, env: { ...process.env, VITE_API_URL: 'http://127.0.0.1:9999/api' }, stdio: 'ignore',
  });
  t.after(() => server.kill());
  await waitForServer(url, server);
  const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox'] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.addInitScript(() => sessionStorage.setItem('finance_session', 'test-token'));
  const categoryWait = deferred(), categoryStarted = deferred(), transactionWait = deferred(), transactionStarted = deferred();
  const navigationWait = deferred(), navigationStarted = deferred();
  const navigationTxWait = deferred(), navigationTxStarted = deferred();
  let categoryPosts = 0, transactionPosts = 0;
  const category = { id: 'a', name: 'Operações', description: null };
  const categoryList = [category];
  const transactionRows = [{ id: 't1', categoryId: 'a', description: 'Antes da alteração', type: 'EXPENSE', amount: '10.00', date: '2026-11-01' }];
  await page.route('**/api/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE', 'Access-Control-Allow-Headers': '*' } });
    if (path === '/api/auth/me') return json(200, { id: 'u', name: 'Usuário Teste', email: 'teste@example.test' });
    if (path === '/api/categories' && req.method() === 'GET') return json(200, categoryList);
    if (path === '/api/categories' && req.method() === 'POST') {
      categoryPosts++;
      if (categoryPosts === 1) { categoryStarted.resolve(); await categoryWait.promise; return json(500, { message: 'Erro de teste' }); }
      if (categoryPosts === 3) {
        navigationStarted.resolve();
        await navigationWait.promise;
        const created = { id: 'b', name: 'Categoria após navegação', description: null };
        categoryList.push(created);
        return json(201, created);
      }
      return json(201, category);
    }
    if (path === '/api/transactions' && req.method() === 'GET') return json(200, { data: transactionRows, pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } });
    if (path === '/api/transactions/t1' && req.method() === 'PATCH') {
      navigationTxStarted.resolve();
      await navigationTxWait.promise;
      transactionRows[0].description = 'Alteração confirmada';
      return json(200, transactionRows[0]);
    }
    if (path === '/api/transactions' && req.method() === 'POST') {
      transactionPosts++;
      if (transactionPosts === 1) { transactionStarted.resolve(); await transactionWait.promise; return json(500, { message: 'Erro de teste' }); }
      return json(201, { id: 't' });
    }
    return json(404, { message: 'Unexpected test request' });
  });
  await page.goto(`${url}/#/categories`);
  await page.getByRole('button', { name: '+ Nova categoria' }).click();
  const categoryDialog = page.getByRole('dialog');
  await categoryDialog.getByLabel('Nome', { exact: true }).fill('Categoria pendente');
  await categoryDialog.getByRole('button', { name: 'Salvar categoria' }).click();
  await categoryStarted.promise;
  assert.equal(await categoryDialog.getByRole('button', { name: 'Cancelar' }).isDisabled(), true);
  await page.keyboard.press('Escape');
  assert.equal(await categoryDialog.isVisible(), true);
  await categoryDialog.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(categoryPosts, 1);
  categoryWait.resolve();
  await categoryDialog.getByRole('alert').waitFor();
  assert.equal(await categoryDialog.getByLabel('Nome', { exact: true }).inputValue(), 'Categoria pendente');
  await categoryDialog.getByRole('button', { name: 'Salvar categoria' }).click();
  await categoryDialog.waitFor({ state: 'hidden' });
  assert.equal(categoryPosts, 2);

  await page.getByRole('button', { name: 'Adicionar transação' }).click();
  const transactionDialog = page.getByRole('dialog');
  await transactionDialog.getByLabel('Descrição', { exact: true }).fill('Movimentação pendente');
  await transactionDialog.getByLabel('Valor (R$)').fill('12,34');
  await transactionDialog.getByRole('button', { name: 'Salvar transação' }).click();
  await transactionStarted.promise;
  assert.equal(await transactionDialog.getByRole('button', { name: 'Cancelar' }).isDisabled(), true);
  await page.keyboard.press('Escape');
  assert.equal(await transactionDialog.isVisible(), true);
  await transactionDialog.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(transactionPosts, 1);
  transactionWait.resolve();
  await transactionDialog.getByRole('alert').waitFor();
  assert.equal(await transactionDialog.getByLabel('Descrição', { exact: true }).inputValue(), 'Movimentação pendente');
  assert.equal(await transactionDialog.getByLabel('Valor (R$)').inputValue(), '12,34');
  await transactionDialog.getByRole('button', { name: 'Salvar transação' }).click();
  await transactionDialog.waitFor({ state: 'hidden' });
  assert.equal(transactionPosts, 2);
  await page.getByText('Transação salva com sucesso.').waitFor();

  await page.getByRole('button', { name: '+ Nova categoria' }).click();
  await page.getByRole('dialog').getByLabel('Nome', { exact: true }).fill('Categoria após navegação');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar categoria' }).click();
  await navigationStarted.promise;
  await page.evaluate(() => { location.hash = '#/transactions'; });
  await page.getByRole('heading', { name: 'Transações', exact: true }).waitFor();
  await page.evaluate(() => { location.hash = '#/categories'; });
  const newCategory = page.getByRole('button', { name: '+ Nova categoria' });
  await newCategory.waitFor();
  assert.equal(await newCategory.isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Adicionar transação' }).isDisabled(), true);
  navigationWait.resolve();
  await page.getByText('Categoria após navegação').waitFor();
  assert.equal(await newCategory.isEnabled(), true);
  assert.equal(categoryPosts, 3);

  await page.evaluate(() => { location.hash = '#/transactions'; });
  await page.getByText('Antes da alteração').waitFor();
  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByRole('dialog').getByLabel('Descrição', { exact: true }).fill('Alteração confirmada');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar transação' }).click();
  await navigationTxStarted.promise;
  await page.evaluate(() => { location.hash = '#/categories'; });
  await page.getByRole('button', { name: '+ Nova categoria' }).waitFor();
  await page.evaluate(() => { location.hash = '#/transactions'; });
  const editTransaction = page.getByRole('region', { name: 'Tabela de transações' }).getByRole('button', { name: 'Editar' });
  await editTransaction.waitFor();
  assert.equal(await editTransaction.isDisabled(), true);
  navigationTxWait.resolve();
  await page.getByText('Alteração confirmada').waitFor();
  assert.equal(await editTransaction.isEnabled(), true);
});
