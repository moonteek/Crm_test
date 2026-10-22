// Student documents (contract, ID copy): PDF, PNG or JPG data URLs up to 2 MB, kept in the database. The type is
// read from the file's first bytes, never trusted from its name; used in the browser (before upload) and on the server.

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PER_STUDENT = 30;
const BAD = "Faqat PDF, JPG yoki PNG, 2 MB gacha";

const KINDS = [
  { ext: "pdf", mime: "application/pdf", head: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { ext: "png", mime: "image/png", head: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: "jpg", mime: "image/jpeg", head: [0xff, 0xd8, 0xff] },
] as const;
const DECLARED = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];

function split(dataUrl: string) {
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  return m ? { declared: m[1], b64: m[2] } : null;
}

function kindOf(b64: string) {
  let head: number[];
  try {
    head = [...atob(b64.slice(0, 16))].map((c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  return KINDS.find((k) => k.head.every((b, i) => head[i] === b)) ?? null;
}

const sizeOf = (b64: string) => Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);

/** Why a document can't be added (null when fine): `count` = how many the student already has. */
export function documentProblem(dataUrl: string, count: number): string | null {
  if (count >= MAX_PER_STUDENT) return "Ko'pi bilan 30 ta hujjat";
  const parts = split(dataUrl);
  if (!parts || !DECLARED.includes(parts.declared)) return BAD;
  if (sizeOf(parts.b64) > MAX_BYTES) return BAD;
  return kindOf(parts.b64) ? null : BAD;
}

/** The checked file's bytes and its real type (call `documentProblem` first). */
export function decodeDocument(dataUrl: string) {
  const parts = split(dataUrl);
  const kind = parts && kindOf(parts.b64);
  if (!parts || !kind) throw new Error(BAD);
  return { mime: kind.mime, ext: kind.ext, bytes: Buffer.from(parts.b64, "base64") };
}
