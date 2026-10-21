import { unstable_rethrow } from "next/navigation";

// Server actions answer forms with `{ error }` instead of throwing: a thrown error replaces the whole page with the
// error screen (and in production hides the reason), while an answer shows in the form with what was typed kept.

export type ActionState = { error?: string; ok?: boolean; warning?: string } | null;

const PRISMA_CODES: Record<string, string> = {
  P2002: "Bunday yozuv allaqachon bor",
  P2003: "Unga bog'langan ma'lumotlar bor — avval ularni o'chiring yoki o'zgartiring",
  P2025: "Yozuv topilmadi — sahifani yangilang",
};
const FAILED = "Saqlab bo'lmadi — qayta urinib ko'ring";

/** The words a person sees for a failed action: our own refusals as written, database errors in plain words. */
export function errorText(e: unknown): string {
  if (!(e instanceof Error)) return FAILED;
  if (e.name.startsWith("PrismaClient")) return PRISMA_CODES[(e as Error & { code?: string }).code ?? ""] ?? FAILED;
  return e.message || FAILED;
}

/** Runs an action's work; a refusal comes back as `{ error }`, while redirects (login, the page after a delete) still go through. */
export async function tryAction(work: () => Promise<unknown>): Promise<ActionState> {
  try {
    await work();
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    if (errorText(e) === FAILED) console.error(e);
    return { error: errorText(e) };
  }
}
