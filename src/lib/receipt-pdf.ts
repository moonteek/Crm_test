import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { receiptText, type ReceiptData, type ReceiptSettings } from "./receipt";

// The receipt as a one-page PDF on roll-paper width, drawn from the same lines as the print page.

const MM = 72 / 25.4;
const MARGIN = 3 * MM;

/** Courier (a PDF standard font) only has Latin-1 letters: swap the few others a receipt may hold. */
const pdfSafe = (s: string) =>
  s.replace(/№/g, "No").replace(/[ʻʼ‘’`]/g, "'").replace(/[«»“”]/g, '"').replace(/[  ]/g, " ").replace(/[^\x20-\x7e -ÿ—–]/g, "?");

/** `logo`: the image's bytes (PNG or JPG), or null for none. */
export async function receiptPdf(s: ReceiptSettings, d: ReceiptData, logo: Uint8Array | null): Promise<Uint8Array> {
  const r = receiptText(s, d);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Courier);
  const bold = await doc.embedFont(StandardFonts.CourierBold);
  const width = s.paper * MM;
  const inner = width - 2 * MARGIN;
  // Courier is 0.6 em wide: the size that fits a full line of characters
  const size = inner / (r.width * 0.6);
  const line = size * 1.45;

  let image = null;
  if (logo) {
    try {
      image = logo[0] === 0x89 ? await doc.embedPng(logo) : await doc.embedJpg(logo);
    } catch {
      image = null; // a damaged image never stops the receipt
    }
  }
  const scale = image ? Math.min((inner * 0.6) / image.width, (18 * MM) / image.height) : 0;
  const logoH = image ? image.height * scale + 2 * MM : 0;
  const rows = r.header.length + 1 + r.rows.length + 1 + 1 + 2;
  const height = MARGIN * 2 + logoH + rows * line + size * 0.8;

  const page = doc.addPage([width, height]);
  const ink = rgb(0, 0, 0);
  let y = height - MARGIN;
  if (image) {
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, { x: (width - w) / 2, y: y - h, width: w, height: h });
    y -= logoH;
  }
  const center = (text: string, f = font, sz = size) => {
    const t = pdfSafe(text);
    page.drawText(t, { x: (width - f.widthOfTextAtSize(t, sz)) / 2, y: y - sz, size: sz, font: f, color: ink });
    y -= sz * 1.45;
  };
  const row = (label: string, value: string, f = font) => {
    const v = pdfSafe(value);
    page.drawText(pdfSafe(label), { x: MARGIN, y: y - size, size, font: f, color: ink });
    page.drawText(v, { x: width - MARGIN - f.widthOfTextAtSize(v, size), y: y - size, size, font: f, color: ink });
    y -= line;
  };
  const rule = () => {
    page.drawLine({ start: { x: MARGIN, y: y - line / 2 }, end: { x: width - MARGIN, y: y - line / 2 }, thickness: 0.6, color: ink, dashArray: [2, 2] });
    y -= line;
  };

  r.header.forEach((h, i) => center(h, i === 0 ? bold : font, i === 0 ? size * 1.3 : size));
  rule();
  r.rows.forEach(([l, v]) => row(l, v));
  rule();
  row(r.total[0], r.total[1], bold);
  y -= line * 0.5;
  center(r.footer);
  return doc.save();
}
