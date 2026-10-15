// Pages meant for printing (receipts): no app shell around them.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-page py-6 print:bg-white print:py-0">{children}</main>;
}
