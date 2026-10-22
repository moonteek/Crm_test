import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { emailField, parentPhones, planParents, telegramField } from "./student-contacts";

const parse = (field: z.ZodType, x: unknown) => {
  const r = z.object({ f: field }).safeParse({ f: x });
  return r.success ? r.data.f : r.error.issues[0].message;
};

test("telegram: @ removed, bad usernames refused, blank is empty", () => {
  assert.equal(parse(telegramField, "@aziz_k"), "aziz_k");
  assert.equal(parse(telegramField, "aziz_k"), "aziz_k");
  assert.equal(parse(telegramField, "ab"), "Telegram username noto'g'ri");
  assert.equal(parse(telegramField, "has space"), "Telegram username noto'g'ri");
  assert.equal(parse(telegramField, ""), null);
  assert.equal(parse(telegramField, undefined), null);
});

test("email: a simple name@site shape, blank is empty", () => {
  assert.equal(parse(emailField, "ota@mail.uz"), "ota@mail.uz");
  assert.equal(parse(emailField, "a@b"), "Email noto'g'ri");
  assert.equal(parse(emailField, ""), null);
});

test("parents: the old single parent moves into Otasi only when Otasi is empty", () => {
  const row = (id: number, o: Partial<{ parentName: string | null; parentPhone: string | null; fatherName: string | null; fatherPhone: string | null }>) =>
    ({ id, parentName: null, parentPhone: null, fatherName: null, fatherPhone: null, ...o });
  assert.deepEqual(
    planParents([
      row(1, { parentName: "Karim", parentPhone: "+998901112233" }),
      row(2, { parentName: "Old", fatherName: "Already" }),
      row(3, {}),
      row(4, { parentPhone: "+998907776655" }),
    ]),
    [{ id: 1, fatherName: "Karim", fatherPhone: "+998901112233" }, { id: 4, fatherName: null, fatherPhone: "+998907776655" }],
  );
});

test("parent phones for lists and exports", () => {
  assert.equal(parentPhones({ fatherPhone: "+998901112233", motherPhone: "+998934445566" }), "Otasi: +998901112233, Onasi: +998934445566");
  assert.equal(parentPhones({ fatherPhone: null, motherPhone: "+998934445566" }), "Onasi: +998934445566");
  assert.equal(parentPhones({ fatherPhone: null, motherPhone: null }), "");
});
