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

const change = { value: '10.0', amountDifference: '13612.85', status: 'available', direction: 'up' };
const dashboard = {
  balance: '13612.85',
  historicalBalance: '13612.85',
  balanceAtEnd: '13612.85',
  income: '25300.00',
  expense: '11687.15',
  comparison: { startDate: '2026-10-01', endDate: '2026-10-12', balance: '10000.00', income: '20000.00', expense: '9000.00' },
  changes: { balance: change, income: change, expense: { ...change, direction: 'down' } },
  periodIndicators: {
    incomeGrowth: change,
    expenseVariation: { ...change, direction: 'down' },
    operationalParticipation: '46.2',
    periodResult: '13612.85',
  },
  topCategories: [
    { categoryId: 'suppliers', name: 'Fornecedores e materiais do projeto', amount: '6350.75' },
    { categoryId: 'team', name: 'Equipe e benefícios corporativos', amount: '3510.50' },
    { categoryId: 'infrastructure', name: 'Infraestrutura e serviços', amount: '1145.90' },
  ],
};

const transactions = [
  { id: 't1', categoryId: 'suppliers', description: 'Pagamento de fornecedores internacionais e materiais do Projeto Horizonte', type: 'EXPENSE', amount: '4250.75', date: '2026-11-03' },
  { id: 't2', categoryId: 'team', description: 'Despesas mensais da equipe de produto e benefícios corporativos', type: 'EXPENSE', amount: '3200.00', date: '2026-11-05' },
  { id: 't3', categoryId: 'suppliers', description: 'Pagamento de serviços especializados e consultoria financeira', type: 'EXPENSE', amount: '2100.00', date: '2026-11-11' },
  { id: 't4', categoryId: 'infrastructure', description: 'Licenças anuais de infraestrutura e ferramentas de segurança', type: 'EXPENSE', amount: '1145.90', date: '2026-11-12' },
  { id: 't5', categoryId: 'team', description: 'Reembolso de despesas operacionais da equipe administrativa', type: 'EXPENSE', amount: '440.00', date: '2026-11-12' },
];

test('dashboard remains readable without horizontal overflow at tablet and nearby breakpoints', { skip: !browserPath && 'Chrome/Chromium is not installed; set CHROME_PATH', timeout: 60000 }, async t => {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(vite, ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: webRoot,
    env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${port}/api` },
    stdio: 'ignore',
  });
  t.after(() => server.kill());
  await waitForServer(url, server);

  const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox'] });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => sessionStorage.setItem('finance_session', 'responsive-test-token'));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
    if (path === '/api/auth/me') return json({ id: 'u1', name: 'Usuário de Teste', email: 'teste@example.test' });
    if (path === '/api/categories') return json([
      { id: 'suppliers', name: 'Fornecedores e materiais do projeto', description: null },
      { id: 'team', name: 'Equipe e benefícios corporativos', description: null },
      { id: 'infrastructure', name: 'Infraestrutura e serviços', description: null },
    ]);
    if (path === '/api/dashboard') return json(dashboard);
    if (path === '/api/transactions') return json({ data: transactions, pagination: { page: 1, limit: 5, total: transactions.length, totalPages: 1 } });
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Unexpected test request' }) });
  });

  await page.goto(`${url}/#/dashboard`);
  await page.getByRole('heading', { name: 'Movimentações recentes', exact: true }).waitFor();
  await page.getByText(transactions[0].description, { exact: true }).waitFor();

  for (const width of [1440, 900, 768, 761, 760, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const layout = await page.evaluate(() => {
      const rect = element => {
        const bounds = element.getBoundingClientRect();
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom };
      };
      const metrics = document.querySelector('.metrics');
      const cards = [...document.querySelectorAll('.metrics .metric')];
      const panels = [...document.querySelectorAll('.dashboard-grid > .dashboard-panel')];
      const amounts = [...document.querySelectorAll('.metrics .metric > strong')];
      const splitWords = [...document.querySelectorAll('.recent > div > strong')].flatMap(element => {
        const node = element.firstChild;
        if (!node) return [];
        const text = node.textContent ?? '';
        const matches = [...text.matchAll(/\S+/g)];
        return matches.flatMap(match => {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          return range.getClientRects().length > 1 ? [match[0]] : [];
        });
      });
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        sidebarPosition: getComputedStyle(document.querySelector('.sidebar')).position,
        metrics: rect(metrics),
        cards: cards.map(rect),
        panels: panels.map(rect),
        amountLines: amounts.map(element => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getClientRects().length;
        }),
        splitWords,
      };
    });
    if (width === 768 && process.env.DASHBOARD_SCREENSHOT_PATH) {
      await page.screenshot({ path: process.env.DASHBOARD_SCREENSHOT_PATH, fullPage: true });
    }

    assert.ok(layout.documentWidth <= width, `horizontal page overflow at ${width}px: ${layout.documentWidth}px`);
    assert.equal(layout.cards.length, 3);
    if (width >= 761 && width <= 900) {
      assert.equal(layout.sidebarPosition, 'fixed', `tablet navigation should remain in the sidebar at ${width}px`);
      assert.ok(Math.abs(layout.cards[0].x - layout.metrics.x) <= 1, `balance card should align with the metric grid at ${width}px`);
      assert.ok(Math.abs(layout.cards[0].width - layout.metrics.width) <= 1, `balance card should span the metric grid at ${width}px`);
      assert.ok(Math.abs(layout.cards[1].y - layout.cards[2].y) <= 1, `income and expense cards should share a row at ${width}px`);
      assert.ok(layout.cards[1].y >= layout.cards[0].bottom, `balance should appear above the other metrics at ${width}px`);
      assert.ok(layout.panels[1].y >= layout.panels[0].bottom, `dashboard panels should stack at ${width}px`);
      assert.ok(layout.amountLines.every(lines => lines === 1), `metric amounts should stay on one line at ${width}px`);
      assert.deepEqual(layout.splitWords, [], `recent transaction words should not break mid-word at ${width}px`);
    } else if (width > 900) {
      assert.ok(layout.cards[0].y === layout.cards[1].y && layout.cards[1].y === layout.cards[2].y, 'desktop metrics should stay on one row');
      assert.ok(layout.panels[0].x < layout.panels[1].x, 'desktop dashboard panels should remain side by side');
    } else {
      assert.equal(layout.sidebarPosition, 'static', `compact navigation should remain active at ${width}px`);
      assert.ok(layout.cards[0].y < layout.cards[1].y && layout.cards[1].y < layout.cards[2].y, `mobile metrics should remain stacked at ${width}px`);
      assert.ok(layout.panels[1].y >= layout.panels[0].bottom, `mobile dashboard panels should remain stacked at ${width}px`);
    }
  }
});
