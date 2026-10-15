// Uploaded pictures (receipt logo, teacher photo) are kept in the database as data URLs.

const IMAGE_MAX = 300 * 1024;

/** Why an uploaded picture can't be used (null when it's fine): a PNG or JPG data URL up to 300 KB. `what` names it in the message. */
export function imageProblem(dataUrl: string, what: string): string | null {
  const m = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return "Faqat PNG yoki JPG";
  const b64 = m[2];
  const bytes = Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  return bytes > IMAGE_MAX ? `${what} 300 KB dan katta` : null;
}
