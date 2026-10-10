"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  const [showPassword, setShowPassword] = useState(false);
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
            <input name="phone" type="tel" autoComplete="username" className="input" placeholder="90 123 45 67" required autoFocus defaultValue={state?.phone} key={state?.phone} />
          </label>
          <div>
            <label htmlFor="password" className="label">Parol</label>
            <div className="relative">
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="input pr-10" required />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                aria-pressed={showPassword}
                title={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-slate-400 hover:text-slate-700 focus-visible:text-slate-700 focus-visible:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input name="remember" type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-brand-600" defaultChecked={state?.remember} key={String(state?.remember)} />
            Meni eslab qolish (30 kun)
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
