import { test } from "node:test";
import assert from "node:assert/strict";
import { redirect } from "next/navigation";
import { errorText, tryAction } from "./action-result";

test("a refusal comes back as a message for the form", async () => {
  assert.deepEqual(await tryAction(async () => { throw new Error("Bunday teg bor"); }), { error: "Bunday teg bor" });
});

test("success answers ok", async () => {
  let ran = false;
  assert.deepEqual(await tryAction(async () => { ran = true; }), { ok: true });
  assert.ok(ran);
});

test("a redirect (login after an expired session, or the page after a delete) still reaches the browser", async () => {
  await assert.rejects(tryAction(async () => redirect("/login")), (e: Error & { digest?: string }) => String(e.digest).startsWith("NEXT_REDIRECT"));
});

test("database errors become plain words, never Prisma's internals", () => {
  const prisma = (code: string) => Object.assign(new Error("Invalid `prisma.room.delete()` invocation: Foreign key constraint violated"), { name: "PrismaClientKnownRequestError", code });
  assert.equal(errorText(prisma("P2002")), "Bunday yozuv allaqachon bor");
  assert.equal(errorText(prisma("P2003")), "Unga bog'langan ma'lumotlar bor — avval ularni o'chiring yoki o'zgartiring");
  assert.equal(errorText(prisma("P2025")), "Yozuv topilmadi — sahifani yangilang");
  assert.equal(errorText(prisma("P2034")), "Saqlab bo'lmadi — qayta urinib ko'ring");
  assert.equal(errorText(Object.assign(new Error("connection lost"), { name: "PrismaClientUnknownRequestError" })), "Saqlab bo'lmadi — qayta urinib ko'ring");
  assert.equal(errorText("boom"), "Saqlab bo'lmadi — qayta urinib ko'ring");
});
