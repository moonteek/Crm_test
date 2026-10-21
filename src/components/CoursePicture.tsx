"use client";

import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { imageProblem } from "@/lib/image";
import { Field } from "./ui";

/**
 * The course card picture on the course form. Posts `image`: "" keeps the stored picture, "remove" clears it, else a
 * new PNG/JPG data URL (checked again on the server).
 */
export function CoursePicture({ current }: { current?: string | null }) {
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState(current ?? null);
  const [error, setError] = useState<string | null>(null);
  const pick = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const problem = imageProblem(url, "Rasm");
      setError(problem);
      if (!problem) { setValue(url); setPreview(url); }
    };
    reader.readAsDataURL(file);
  };
  return (
    <Field label="Kurs rasmi">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-raised text-xs text-faint">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URL from the database */}
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : "Rasm yo'q"}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="btn-ghost cursor-pointer border border-line">
            <ImagePlus className="h-4 w-4" /> Rasm yuklash
            <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {preview && (
            <button type="button" className="btn-ghost text-danger" onClick={() => { setValue("remove"); setPreview(null); }}>
              <Trash2 className="h-4 w-4" /> Olib tashlash
            </button>
          )}
        </div>
      </div>
      <input type="hidden" name="image" value={value} />
      <p className={`mt-1 text-xs ${error ? "text-danger" : "text-muted"}`}>{error ?? "PNG yoki JPG, 300 KB gacha"}</p>
    </Field>
  );
}
