import assert from 'node:assert/strict';
import test from 'node:test';
import { toCents, visualShare } from '../src/chart-money.js';
import { decimalFromCents, money } from '../src/money.js';

test('chart aggregation preserves large sums and their exact remainder', () => {
  const total = toCents('90071992547409.93');
  const category = toCents('90071992547409.92');
  assert.equal(decimalFromCents(total - category), '0.01');
  assert.match(money(decimalFromCents(total)), /,93$/);
  assert.equal(visualShare(total - category, total) > 0, true);
  assert.equal(visualShare(0n, 0n), 0);
});

test('chart proportions are calculated from cents of very different sizes', () => {
  const large = toCents('10000000000000.00');
  const small = toCents('0.01');
  const total = large + small;
  assert.ok(visualShare(small, total) > 0);
  assert.ok(visualShare(large, total) <= 1);
  assert.throws(() => toCents('not a decimal'));
});

test('currency formatting preserves ordinary and negative cent values', () => {
  const formatted = (value) => money(value).replace(/[\u00a0\u202f]/g, ' ');
  assert.equal(formatted('0.00'), 'R$ 0,00');
  assert.equal(formatted('0.01'), 'R$ 0,01');
  assert.equal(formatted('1.99'), 'R$ 1,99');
  assert.equal(formatted('1234.56'), 'R$ 1.234,56');
  assert.equal(formatted('-1234.56'), '-R$ 1.234,56');
  assert.equal(formatted('90071992547409.93'), 'R$ 90.071.992.547.409,93');
});
