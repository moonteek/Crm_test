import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { SettingsTabs } from "./SettingsTabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const tabs = [
    ...(can(user, "staff.manage")
      ? [{ href: "/settings", label: "Xodimlar" }, { href: "/settings/roles", label: "Rollar va ruxsatlar" }, { href: "/settings/reasons", label: "Sabablar" }]
      : []),
    ...(can(user, "mcp.use") ? [{ href: "/settings/mcp", label: "Integratsiyalar (AI, Instagram, Telegram)" }] : []),
  ];
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight text-ink">Sozlamalar</h1>
      <SettingsTabs tabs={tabs} />
      {children}
    </>
  );
}
