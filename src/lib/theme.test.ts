import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTheme, themeFromCookie } from "./theme";

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

test("reads the theme back out of a document.cookie string", () => {
  assert.equal(themeFromCookie("a=1; theme=dark; b=2"), "dark");
  assert.equal(themeFromCookie("theme=light"), "light");
  assert.equal(themeFromCookie("a=1"), "auto");
  assert.equal(themeFromCookie("mytheme=dark"), "auto");
  assert.equal(themeFromCookie(""), "auto");
});
