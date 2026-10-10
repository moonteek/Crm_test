"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="flex min-h-screen">
      <div className="dot-grid relative hidden flex-1 flex-col justify-between overflow-hidden bg-panel p-12 text-panel-ink [--dot:rgb(255_255_255/0.08)] lg:flex">
        <span className="label-mono text-panel-muted">Algoritm · CRM</span>
        <div>
          <LogoMark className="mb-10 h-28 w-auto text-panel-ink" />
          <h2 className="text-5xl leading-[1.05] font-semibold tracking-tight">
            O&apos;quv markazingizni
            <br />
            bir joydan boshqaring
          </h2>
          <p className="mt-5 max-w-md text-panel-muted">
            Lidlar, o&apos;quvchilar, guruhlar, davomat, to&apos;lovlar va moliya — barchasi bitta tizimda.
          </p>
        </div>
        <p className="label-mono text-panel-muted">© Algoritm IT o&apos;quv markazi, Namangan</p>
      </div>

      <div className="dot-grid flex flex-1 items-center justify-center p-6">
        <form action={action} className="card w-full max-w-sm animate-enter space-y-5 p-7">
          <Logo className="lg:hidden" />
          <div>
            <p className="label-mono">Xush kelibsiz</p>
            <h1 className="mt-1 text-2xl font-semibold">Tizimga kirish</h1>
            <p className="mt-1 text-sm text-muted">Telefon raqam va parolingizni kiriting</p>
          </div>
          <label className="block">
            <span className="label">Telefon raqam</span>
            <input name="phone" type="tel" autoComplete="username" className="input" placeholder="90 123 45 67" required autoFocus defaultValue={state?.phone} key={state?.phone} />
          </label>
          <div>
            <label htmlFor="password" className="label">Parol</label>
            <div className="relative">
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="input pr-11" required />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                aria-pressed={showPassword}
                title={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-faint hover:text-ink focus-visible:text-ink focus-visible:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input name="remember" type="checkbox" className="h-4 w-4 rounded border-line-strong accent-ink" defaultChecked={state?.remember} key={String(state?.remember)} />
            Meni eslab qolish (30 kun)
          </label>
          {state?.error && <p className="rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{state.error}</p>}
          <button className="btn-primary w-full py-2.5" disabled={pending}>
            {pending ? "Kirilmoqda..." : "Kirish"}
          </button>
        </form>
      </div>
    </div>
  );
}
