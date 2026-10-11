import { test } from "node:test";
import assert from "node:assert/strict";
import { canDelete, canEnd, discountProblem, discountsAfterLeave, discountState } from "./discounts";

const m = (y: number, mo: number) => new Date(Date.UTC(y, mo - 1, 1));
const today = new Date(Date.UTC(2026, 10, 15)); // 15 Nov 2026
const ok = { from: m(2026, 12), to: m(2027, 1), amount: 100_000, current: true };

test("discount save rules", () => {
  assert.equal(discountProblem(ok, [], today), null);
  assert.equal(discountProblem({ ...ok, amount: 0 }, [], today), "Chegirma summasi musbat bo'lishi kerak");
  assert.equal(discountProblem({ ...ok, from: m(2027, 2) }, [], today), "Boshlanish oyi tugash oyidan keyin bo'lmasin");
  assert.equal(discountProblem({ ...ok, from: m(2026, 10), to: m(2026, 12) }, [], today), "Chegirma faqat shu oydan boshlab beriladi");
  assert.equal(discountProblem({ ...ok, from: m(2026, 10), to: m(2026, 11) }, [], new Date(Date.UTC(2026, 9, 11))), "Chegirma 2026-yil noyabrdan boshlab beriladi");
  assert.equal(discountProblem({ ...ok, current: false }, [], today), "O'quvchi bu guruhda emas");
  assert.equal(discountProblem(ok, [{ from: m(2027, 1), to: m(2027, 3) }], today), "Bu oylarda boshqa chegirma bor");
});

test("single month and adjacent ranges are fine", () => {
  assert.equal(discountProblem({ ...ok, from: m(2026, 11), to: m(2026, 11) }, [], today), null);
  assert.equal(discountProblem({ ...ok, from: m(2027, 1), to: m(2027, 2) }, [{ from: m(2026, 11), to: m(2026, 12) }], today), null);
});

test("state, delete and end", () => {
  const past = { from: m(2026, 11), to: m(2026, 11) };
  const running = { from: m(2026, 10), to: m(2027, 1) };
  const thisMonth = { from: m(2026, 11), to: m(2027, 1) };
  const future = { from: m(2027, 1), to: m(2027, 2) };
  const dec = new Date(Date.UTC(2026, 11, 5));
  assert.deepEqual([discountState(past, dec), discountState(running, dec), discountState(future, dec)], ["tugagan", "amalda", "kutilmoqda"]);
  assert.deepEqual([canDelete(future, today), canDelete(thisMonth, today), canDelete(running, today)], [true, true, false]);
  assert.deepEqual([canEnd(running, today), canEnd(thisMonth, today), canEnd(past, dec)], [true, false, false]);
});

test("leaving ends the membership's discounts with the leave month; later ones are removed", () => {
  const ds = [
    { id: 1, from: m(2026, 11), to: m(2027, 6) }, // running past the leave → ends in December
    { id: 2, from: m(2027, 2), to: m(2027, 3) }, // starts after the leave → removed
    { id: 3, from: m(2026, 11), to: m(2026, 11) }, // already over → untouched
  ];
  assert.deepEqual(discountsAfterLeave(ds, new Date(Date.UTC(2026, 11, 15))), { remove: [2], trim: [{ id: 1, to: m(2026, 12) }] });
});
