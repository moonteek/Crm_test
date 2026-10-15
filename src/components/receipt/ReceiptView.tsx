import { receiptLayout, receiptText, TITLE_SCALE, type ReceiptData, type ReceiptSettings } from "@/lib/receipt";

/**
 * One receipt as it prints on the roll: black on white in every theme (it's paper), monospace, the paper's width.
 * Sizes come from receiptLayout(), so a full line of characters fits and the print page's height matches the content.
 * `logoSrc` is the uploaded logo or the built-in one; null hides it.
 */
export function ReceiptView({ settings, data, logoSrc }: { settings: ReceiptSettings; data: ReceiptData; logoSrc: string | null }) {
  const r = receiptText(settings, data);
  const l = receiptLayout(settings, r);
  const row = (label: string, value: string) => (
    <div className="flex justify-between whitespace-pre">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
  const rule = <div className="flex items-center" style={{ height: `${l.lineMm}mm` }}><hr className="w-full border-0 border-t border-dashed border-black" /></div>;
  return (
    <div
      className="receipt mx-auto bg-white font-mono text-black"
      style={{ width: `${settings.paper}mm`, padding: `${l.padY}mm ${l.padMm}mm`, fontSize: `${l.fontMm}mm`, lineHeight: 1.45 }}
    >
      {settings.showLogo && (
        <div className="flex h-[18mm] items-center justify-center" style={{ marginBottom: "2mm" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URLs and the tiny built-in PNG need no optimisation */}
          {logoSrc && <img src={logoSrc} alt="" className="max-h-full max-w-[60%] object-contain" />}
        </div>
      )}
      <div className="text-center whitespace-pre">
        {r.title.map((t, i) => <p key={`t${i}`} className="font-bold" style={{ fontSize: `${TITLE_SCALE}em` }}>{t}</p>)}
        {r.header.map((h, i) => <p key={`h${i}`}>{h}</p>)}
      </div>
      {rule}
      {r.rows.map(([lab, v], i) => <div key={i}>{row(lab, v)}</div>)}
      {rule}
      <div className="font-bold" style={{ fontSize: "1.2em" }}>{row(r.total[0], r.total[1])}</div>
      <p className="text-center" style={{ marginTop: "3mm" }}>{r.footer}</p>
    </div>
  );
}
