// Uploaded pictures (receipt logo, teacher photo) are kept in the database as data URLs.

const IMAGE_MAX = 300 * 1024;

/** The file's first bytes: PNG (89 50 4E 47) or JPG (FF D8 FF) — not just its name or declared type. */
function looksLikeImage(b64: string) {
  let head: string;
  try {
    head = atob(b64.slice(0, 12));
  } catch {
    return false;
  }
  const bytes = [...head].map((c) => c.charCodeAt(0));
  const png = [0x89, 0x50, 0x4e, 0x47].every((b, i) => bytes[i] === b);
  const jpg = [0xff, 0xd8, 0xff].every((b, i) => bytes[i] === b);
  return png || jpg;
}

/** Why an uploaded picture can't be used (null when it's fine): a PNG or JPG data URL up to 300 KB. `what` names it in the message. */
export function imageProblem(dataUrl: string, what: string): string | null {
  const m = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return "Faqat PNG yoki JPG";
  const b64 = m[2];
  const bytes = Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  if (bytes > IMAGE_MAX) return `${what} 300 KB dan katta`;
  return looksLikeImage(b64) ? null : "Faqat PNG yoki JPG";
}
