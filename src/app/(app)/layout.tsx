import { Sidebar } from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <Sidebar name={user.name} roleName={user.roleName} permissions={[...user.permissions]} />
      <main className="px-4 py-6 lg:ml-64 lg:px-8">{children}</main>
    </div>
  );
}
