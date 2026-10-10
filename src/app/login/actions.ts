"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL, signSession } from "@/lib/session";
import { logAction } from "@/lib/audit";
import { phoneKey } from "@/lib/phone";

export type LoginState = { error: string; phone: string; remember: boolean } | null;

// Compared against when the phone is unknown, so a wrong phone takes as long as a wrong password
// and response times don't reveal which numbers have accounts.
let dummyHash: string | undefined;

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const phone = String(form.get("phone") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const remember = form.get("remember") === "on";
  // match on the digits, so "+998 90 123 45 67" finds the account saved as "901234567"
  const key = phoneKey(phone);
  const matches = key.length < 7 ? [] : (await db.user.findMany()).filter((u) => phoneKey(u.phone) === key);
  const user = matches.length === 1 ? matches[0] : null;
  dummyHash ??= await bcrypt.hash("dummy-password", 10);
  const ok = await bcrypt.compare(password, user?.password ?? dummyHash);
  if (!user || !ok) {
    return { error: "Telefon raqam yoki parol noto'g'ri", phone, remember };
  }
  if (!user.active) {
    return { error: "Hisobingiz bloklangan. Administratorga murojaat qiling", phone, remember };
  }
  await logAction(user, "auth.login", `${user.name} tizimga kirdi`);
  const ttl = remember ? SESSION_TTL.remember : SESSION_TTL.session;
  const token = await signSession({ userId: user.id }, ttl);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // without maxAge the cookie is deleted when the browser closes
    ...(remember ? { maxAge: ttl } : {}),
    path: "/",
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
