"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, signSession } from "@/lib/session";

export type LoginState = { error: string; phone: string } | null;

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const phone = String(form.get("phone") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { phone } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return { error: "Telefon raqam yoki parol noto'g'ri", phone };
  }
  if (!user.active) {
    return { error: "Hisobingiz bloklangan. Administratorga murojaat qiling", phone };
  }
  const token = await signSession({ userId: user.id });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
