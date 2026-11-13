export function clearTransactionDateFilters(searchParams) {
  const next = new globalThis.URLSearchParams(searchParams);
  next.delete("startDate");
  next.delete("endDate");
  next.delete("page");
  return next;
}
