import assert from "node:assert/strict";
import test from "node:test";
import { clearTransactionDateFilters } from "../src/transactions-query.js";

test("clearing transaction dates removes both dates and resets pagination atomically", () => {
  const current = new URLSearchParams(
    "type=EXPENSE&categoryId=food&startDate=2026-01-01&endDate=2026-01-31&page=4",
  );

  const cleared = clearTransactionDateFilters(current);

  assert.equal(cleared.toString(), "type=EXPENSE&categoryId=food");
  assert.equal(
    current.toString(),
    "type=EXPENSE&categoryId=food&startDate=2026-01-01&endDate=2026-01-31&page=4",
  );
});
