import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTheme } from "./theme";

test("keeps the three valid theme values", () => {
  assert.equal(parseTheme("light"), "light");
  assert.equal(parseTheme("dark"), "dark");
  assert.equal(parseTheme("auto"), "auto");
});

test("falls back to auto for a missing or empty cookie", () => {
  assert.equal(parseTheme(undefined), "auto");
  assert.equal(parseTheme(""), "auto");
});

test("falls back to auto for an unknown value", () => {
  assert.equal(parseTheme("purple"), "auto");
});
