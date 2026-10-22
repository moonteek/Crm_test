"use client";

import { useState } from "react";
import { Download, ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { deleteDocument, uploadDocument } from "@/app/(app)/actions";
import { documentProblem } from "@/lib/documents";
import { ActionButton, ActionForm } from "@/components/ActionForm";
import { Empty, Field } from "@/components/ui";

type Doc = { id: number; name: string; mime: string; size: number; createdAt: Date; user: { name: string } | null };

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const TYPE: Record<string, string> = { "application/pdf": "PDF", "image/png": "PNG", "image/jpeg": "JPG" };

/** "Hujjatlar": the student's scanned files (contract, ID copy) — add with a name, open, download, delete. */
export function DocumentsPanel({ studentId, docs }: { studentId: number; docs: Doc[] }) {
  const [file, setFile] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const pick = (f: File | undefined) => {
    setFile("");
    if (!f) return setProblem(null);
    if (f.size > 2 * 1024 * 1024) return setProblem("Faqat PDF, JPG yoki PNG, 2 MB gacha");
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const p = documentProblem(url, docs.length);
      setProblem(p);
      if (!p) setFile(url);
    };
    reader.readAsDataURL(f);
  };
  const href = (d: Doc, download = false) => `/students/${studentId}/documents/${d.id}${download ? "?download=1" : ""}`;

  return (
    <div className="space-y-4 p-4 md:p-5">
      <ActionForm action={uploadDocument.bind(null, studentId)} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" submit={null}>
        <Field label="Hujjat nomi"><input name="name" className="input" required maxLength={80} placeholder="Masalan: Shartnoma" /></Field>
        <Field label="Fayl (PDF, JPG, PNG — 2 MB gacha)">
          <input type="file" accept="application/pdf,image/png,image/jpeg" className="input py-2" required onChange={(e) => pick(e.target.files?.[0])} />
        </Field>
        <input type="hidden" name="file" value={file} />
        <button className="btn-primary" disabled={!file}><Upload className="h-4 w-4" /> Yuklash</button>
        {problem && <p role="alert" className="rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger sm:col-span-3">{problem}</p>}
      </ActionForm>
      {docs.length === 0 ? (
        <Empty text="Hujjatlar yo'q" />
      ) : (
        <ul className="divide-y divide-line">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
              <FileText className="h-5 w-5 shrink-0 text-faint" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.name}</p>
                <p className="label-mono">{TYPE[d.mime] ?? d.mime} · {kb(d.size)} · {new Date(d.createdAt).toLocaleDateString("ru-RU")}{d.user ? ` · ${d.user.name}` : ""}</p>
              </div>
              <a href={href(d)} target="_blank" rel="noopener noreferrer" className="btn-ghost px-2" title="Ochish" aria-label={`${d.name} — ochish`}><ExternalLink className="h-4 w-4" /></a>
              <a href={href(d, true)} className="btn-ghost px-2" title="Yuklab olish" aria-label={`${d.name} — yuklab olish`}><Download className="h-4 w-4" /></a>
              <ActionButton action={deleteDocument.bind(null, d.id)} className="btn-ghost px-2 hover:text-danger" label={`${d.name} — o'chirish`} title="O'chirish"><Trash2 className="h-4 w-4" /></ActionButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
