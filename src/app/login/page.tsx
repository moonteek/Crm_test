"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-xl font-bold">A</div>
          <span className="text-2xl font-bold">Algoritm</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold leading-tight">O&apos;quv markazingizni<br />bir joydan boshqaring</h2>
          <p className="mt-4 max-w-md text-slate-300">
            Lidlar, o&apos;quvchilar, guruhlar, davomat, to&apos;lovlar va moliya — barchasi bitta tizimda.
          </p>
        </div>
        <p className="text-sm text-slate-400">© Algoritm IT o&apos;quv markazi, Namangan</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <form action={action} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tizimga kirish</h1>
            <p className="mt-1 text-sm text-slate-500">Telefon raqam va parolingizni kiriting</p>
          </div>
          <label className="block">
            <span className="label">Telefon raqam</span>
            <input name="phone" className="input" placeholder="901234567" required autoFocus defaultValue={state?.phone} key={state?.phone} />
          </label>
          <label className="block">
            <span className="label">Parol</span>
            <input name="password" type="password" className="input" required />
          </label>
          {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
          <button className="btn-primary w-full" disabled={pending}>
            {pending ? "Kirilmoqda..." : "Kirish"}
          </button>
        </form>
      </div>
    </div>
  );
}
