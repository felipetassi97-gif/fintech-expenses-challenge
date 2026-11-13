import assert from "node:assert/strict";
import test from "node:test";
import { decimalFromCents, money } from "../src/money.js";

const normalizeSpace = (value) => value.replace(/[\u00a0\u202f]/g, " ");

test("formats large decimal strings without losing cents", () => {
  assert.equal(
    normalizeSpace(money("90071992547409.93")),
    "R$ 90.071.992.547.409,93",
  );
});

test("preserves negative cent values and converts chart cents exactly", () => {
  assert.equal(normalizeSpace(money("-0.50")), "-R$ 0,50");
  assert.equal(decimalFromCents(9007199254740993n), "90071992547409.93");
});

test("rejects malformed or over-precise amounts rather than silently rounding", () => {
  assert.throws(() => money("1.999"), /Invalid monetary amount/);
  assert.throws(() => money("invalid"), /Invalid monetary amount/);
});
