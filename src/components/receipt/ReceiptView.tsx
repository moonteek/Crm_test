import { receiptText, type ReceiptData, type ReceiptSettings } from "@/lib/receipt";

/**
 * One receipt as it prints on the roll: black on white in every theme (it's paper), typewriter font, the paper's width.
 * `logoSrc` is the uploaded logo or the built-in one; null hides it.
 */
export function ReceiptView({ settings, data, logoSrc }: { settings: ReceiptSettings; data: ReceiptData; logoSrc: string | null }) {
  const r = receiptText(settings, data);
  const line = (l: string, v: string) => (
    <div className="flex justify-between gap-2 whitespace-pre">
      <span>{l}</span>
      <span className="text-right">{v}</span>
    </div>
  );
  return (
    <div
      className="receipt mx-auto bg-white px-[3mm] py-[4mm] font-mono text-black"
      style={{ width: `${settings.paper}mm`, fontSize: settings.paper === 58 ? "9px" : "11px", lineHeight: 1.45 }}
    >
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URLs and the tiny built-in PNG need no optimisation */}
        {logoSrc && <img src={logoSrc} alt="" className="mx-auto mb-[2mm] max-h-[18mm] max-w-[60%] object-contain" />}
        <p className="font-bold tracking-[.25em]" style={{ fontSize: "1.45em" }}>{r.header[0]}</p>
        {r.header.slice(1).map((h) => <p key={h}>{h}</p>)}
      </div>
      <hr className="my-[2mm] border-0 border-t border-dashed border-black" />
      {r.rows.map(([l, v], i) => <div key={i}>{line(l, v)}</div>)}
      <hr className="my-[2mm] border-0 border-t border-dashed border-black" />
      <div className="font-bold" style={{ fontSize: "1.2em" }}>{line(r.total[0], r.total[1])}</div>
      <p className="mt-[3mm] text-center">{r.footer}</p>
    </div>
  );
}
