export function toCents(value) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error('Invalid expense amount');
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

// Approximate proportions are used only for drawing, never for monetary values.
export function visualShare(amount, total) {
  if (total === 0n) return 0;
  return Number(amount) / Number(total);
}
