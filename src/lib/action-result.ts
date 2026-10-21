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

/** Our own refusals are plain `Error`s (ForbiddenError too); anything else — a TypeError, a crash — is a bug. */
const isRefusal = (e: unknown): e is Error => e instanceof Error && (e.name === "Error" || e.name === "ForbiddenError");

/** The words a person sees for a failed action: our own refusals as written, database errors in plain words, bugs as a plain failure. */
export function errorText(e: unknown): string {
  if (isRefusal(e)) return e.message || FAILED;
  if (e instanceof Error && e.name.startsWith("PrismaClient")) return PRISMA_CODES[(e as Error & { code?: string }).code ?? ""] ?? FAILED;
  return FAILED;
}

/** Runs an action's work; a refusal comes back as `{ error }`, while redirects (login, the page after a delete) still go through. */
export async function tryAction(work: () => Promise<unknown>): Promise<ActionState> {
  try {
    await work();
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    if (!isRefusal(e)) console.error(e); // a bug or a database error: keep it in the server log
    return { error: errorText(e) };
  }
}

/**
 * For client code that calls an action itself: the refusal to show, or null. A lost connection counts as one too, but
 * a redirect (the page after a delete, the login after an expired session) is passed on for the router to follow.
 */
export async function answer(res: Promise<ActionState>): Promise<string | null> {
  try {
    return (await res)?.error ?? null;
  } catch (e) {
    unstable_rethrow(e);
    return "Aloqa uzildi — qayta urinib ko'ring";
  }
}
