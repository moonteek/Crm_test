"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { createApiToken } from "../../actions";

export function NewTokenForm({ endpoint }: { endpoint: string }) {
  const [state, action, pending] = useActionState(createApiToken, null);

  if (state?.token) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-warning/40 bg-warning-tint p-3 text-sm text-warning">
          Tokenni hozir nusxalab oling — u boshqa ko&apos;rsatilmaydi. Uni parol kabi saqlang.
        </div>
        <CopyBox label="Token" value={state.token} />
        <CopyBox
          label="Claude Code uchun buyruq"
          value={`claude mcp add --transport http algoritm-crm ${endpoint} --header "Authorization: Bearer ${state.token}"`}
        />
        <CopyBox label="Claude.ai / Claude Desktop → Connectors → Custom connector URL" value={`${endpoint}/${state.token}`} />
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="block min-w-56 flex-1">
        <span className="label">Token nomi</span>
        <input name="name" className="input" placeholder="Masalan: Claude — noutbuk" />
      </label>
      <button className="btn-primary" disabled={pending}>
        <KeyRound className="h-4 w-4" /> {pending ? "Yaratilmoqda..." : "Token yaratish"}
      </button>
    </form>
  );
}

export function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-stretch gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-line bg-ink/[.03] px-3 py-2 text-xs">{value}</code>
        <button
          type="button"
          className="btn-secondary px-3"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          aria-label="Nusxalash"
        >
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
