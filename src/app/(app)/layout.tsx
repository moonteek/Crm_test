import { cookies } from "next/headers";
import { Sidebar } from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { alertsFor } from "@/lib/alerts-db";
import { serialiseAlerts } from "@/lib/alerts";
import { ReceiptOffer } from "@/components/receipt/ReceiptOffer";
import { countOpenRisk } from "@/lib/lists/risk";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const alerts = serialiseAlerts(await alertsFor(user));
  // sidebar counts: risky students nobody has called yet
  const badges: Record<string, number> = user.permissions.has("risk.view") ? { "/risk": await countOpenRisk() } : {};
  return (
    <div className="dot-grid min-h-screen">
      <Sidebar name={user.name} roleName={user.roleName} permissions={[...user.permissions, ...(user.isTeacher ? ["self.teacher"] : [])]} theme={theme} alerts={alerts} canSeeAlerts={user.permissions.has("groups.view")} badges={badges} />
      <main className="px-4 pt-5 pb-28 md:ml-16 md:px-6 md:pb-8 lg:ml-64 lg:px-8 lg:pt-7">{children}</main>
      <ReceiptOffer />
    </div>
  );
}
