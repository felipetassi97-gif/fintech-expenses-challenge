import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparisonRange, dateValue, localToday } from '../src/dashboard-period.ts';

test('today follows the São Paulo civil date across midnight UTC', () => {
  assert.equal(dateValue(localToday(new Date('2026-01-01T02:59:59Z'))), '2025-12-31');
  assert.equal(dateValue(localToday(new Date('2026-01-01T03:00:00Z'))), '2026-01-01');
});

test('month and year comparisons clamp dates across leap years and year boundaries', () => {
  assert.deepEqual(comparisonRange('this-month', '2024-03-01', '2024-03-31'), { startDate: '2024-02-01', endDate: '2024-02-29' });
  assert.deepEqual(comparisonRange('last-month', '2025-01-01', '2025-01-31'), { startDate: '2024-12-01', endDate: '2024-12-31' });
  assert.deepEqual(comparisonRange('this-year', '2024-01-01', '2024-02-29'), { startDate: '2023-01-01', endDate: '2023-02-28' });
});

test('custom periods compare the same inclusive number of days and all-time has no comparison', () => {
  assert.deepEqual(comparisonRange('custom', '2024-03-01', '2024-03-03'), { startDate: '2024-02-27', endDate: '2024-02-29' });
  assert.deepEqual(comparisonRange('last-30-days', '2025-01-01', '2025-01-30'), { startDate: '2024-12-02', endDate: '2024-12-31' });
  assert.equal(comparisonRange('all-time', '', ''), null);
  assert.equal(comparisonRange('custom', '2025-01-01', ''), null);
});
