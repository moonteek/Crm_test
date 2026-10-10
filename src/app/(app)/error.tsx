"use client";

import { AlertTriangle } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto mt-16 max-w-md p-8 text-center">
      <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
      <h1 className="mt-4 text-lg font-semibold">Amalni bajarib bo&apos;lmadi</h1>
      <p className="mt-2 text-sm text-muted">
        Bu amal uchun ruxsatingiz yo&apos;q yoki ma&apos;lumotlarda xatolik bor (masalan, telefon raqam allaqachon band).
      </p>
      <button onClick={reset} className="btn-primary mt-5">Qaytish</button>
    </div>
  );
}
