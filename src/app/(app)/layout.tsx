import { Sidebar } from "@/components/Sidebar";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/format";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="min-h-screen">
      <Sidebar name={session.name} role={session.role} roleLabel={ROLES[session.role] ?? session.role} />
      <main className="px-4 py-6 lg:ml-64 lg:px-8">{children}</main>
    </div>
  );
}
