import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { receiptLayout, receiptText, TITLE_SCALE, type ReceiptData, type ReceiptSettings } from "./receipt";

// The receipt as a one-page PDF on roll-paper width, drawn from the same lines and sizes as the print page.

const MM = 72 / 25.4;
// DejaVu Sans Mono: free to ship, monospace, and has Cyrillic and Uzbek letters (ʻ, №) — PDF's own Courier is Latin-1 only
const FONTS = join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf");
let fonts: Promise<[Uint8Array, Uint8Array]> | null = null;
const fontBytes = () => (fonts ??= Promise.all([readFile(join(FONTS, "DejaVuSansMono.ttf")), readFile(join(FONTS, "DejaVuSansMono-Bold.ttf"))]));

/** `logo`: the image's bytes (PNG or JPG), or null for none. */
export async function receiptPdf(s: ReceiptSettings, d: ReceiptData, logo: Uint8Array | null): Promise<Uint8Array> {
  const r = receiptText(s, d);
  const l = receiptLayout(s, r);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regular, boldBytes] = await fontBytes();
  const font = await doc.embedFont(regular, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });
  const width = s.paper * MM;
  const pad = l.padMm * MM;
  const size = l.fontMm * MM;
  const line = l.lineMm * MM;

  let image = null;
  if (logo && s.showLogo) {
    try {
      image = logo[0] === 0x89 ? await doc.embedPng(logo) : await doc.embedJpg(logo);
    } catch {
      image = null; // a damaged image never stops the receipt
    }
  }
  const page = doc.addPage([width, l.heightMm * MM]);
  const ink = rgb(0, 0, 0);
  let y = page.getHeight() - l.padY * MM;
  if (s.showLogo) {
    if (image) {
      const scale = Math.min((width - 2 * pad) * 0.6 / image.width, (18 * MM) / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, { x: (width - w) / 2, y: y - h, width: w, height: h });
    }
    y -= 20 * MM; // the same room the layout keeps for the logo
  }
  const center = (text: string, f: PDFFont, sz: number, height: number) => {
    page.drawText(text, { x: (width - f.widthOfTextAtSize(text, sz)) / 2, y: y - (height + sz * 0.7) / 2, size: sz, font: f, color: ink });
    y -= height;
  };
  const row = (label: string, value: string, f: PDFFont, sz = size, height = line) => {
    const base = y - (height + sz * 0.7) / 2;
    page.drawText(label, { x: pad, y: base, size: sz, font: f, color: ink });
    page.drawText(value, { x: width - pad - f.widthOfTextAtSize(value, sz), y: base, size: sz, font: f, color: ink });
    y -= height;
  };
  const rule = () => {
    page.drawLine({ start: { x: pad, y: y - line / 2 }, end: { x: width - pad, y: y - line / 2 }, thickness: 0.6, color: ink, dashArray: [2, 2] });
    y -= line;
  };

  r.title.forEach((t) => center(t, bold, size * TITLE_SCALE, line * TITLE_SCALE));
  r.header.forEach((h) => center(h, font, size, line));
  rule();
  r.rows.forEach(([lab, v]) => row(lab, v, font));
  rule();
  row(r.total[0], r.total[1], bold, size * 1.2, line * 1.2);
  y -= 3 * MM;
  center(r.footer, font, size, line);
  return doc.save({ useObjectStreams: false });
}
