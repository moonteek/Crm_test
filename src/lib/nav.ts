import {
  AlertCircle, Banknote, Clock, BarChart3, BookOpen, CalendarDays, DoorOpen, GraduationCap, History, LayoutDashboard,
  Receipt, Settings, ShieldAlert, ShoppingBag, Target, UserPlus, Users, UsersRound, Wallet, type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; perm: string | string[] };

export const NAV: NavItem[] = [
  { href: "/", label: "Bosh sahifa", icon: LayoutDashboard, perm: "dashboard.view" },
  { href: "/analytics", label: "Analitika", icon: BarChart3, perm: "analytics.view" },
  { href: "/leads", label: "Lidlar", icon: UserPlus, perm: "leads.view" },
  { href: "/sales", label: "Sotuv va KPI", icon: Target, perm: "sales.view" },
  { href: "/students", label: "O'quvchilar", icon: Users, perm: "students.view" },
  { href: "/risk", label: "Xavfli o'quvchilar", icon: ShieldAlert, perm: "risk.view" },
  { href: "/groups", label: "Guruhlar", icon: UsersRound, perm: "groups.view" },
  { href: "/schedule", label: "Dars jadvali", icon: CalendarDays, perm: "groups.view" },
  { href: "/teachers", label: "O'qituvchilar", icon: GraduationCap, perm: "teachers.view" },
  // not a role permission: the layout adds "self.teacher" for users marked as teachers
  { href: "/availability", label: "Mening vaqtim", icon: Clock, perm: "self.teacher" },
  { href: "/courses", label: "Kurslar", icon: BookOpen, perm: "courses.view" },
  { href: "/payments", label: "To'lovlar", icon: Wallet, perm: "payments.view" },
  { href: "/debtors", label: "Qarzdorlar", icon: AlertCircle, perm: "debtors.view" },
  { href: "/shop", label: "Do'kon", icon: ShoppingBag, perm: "shop.view" },
  { href: "/finance", label: "Moliya", icon: Receipt, perm: "finance.view" },
  { href: "/salaries", label: "Ish haqi", icon: Banknote, perm: "salaries.view" },
  { href: "/rooms", label: "Xonalar", icon: DoorOpen, perm: "rooms.manage" },
  { href: "/activity", label: "Faoliyat jurnali", icon: History, perm: "audit.view" },
  { href: "/settings", label: "Sozlamalar", icon: Settings, perm: ["staff.manage", "students.tags", "holidays.manage", "mcp.use"] },
];

/** Pages the user may open, in sidebar order. */
export function allowedNav(permissions: string[]) {
  return NAV.filter((n) => [n.perm].flat().some((p) => permissions.includes(p)));
}

/** Most-used pages first; the phone tab bar shows the first three the user may open. */
export const PHONE_TAB_PRIORITY = ["/", "/schedule", "/groups", "/students", "/leads", "/payments"];

export function phoneTabs(permissions: string[]) {
  const allowed = allowedNav(permissions);
  return PHONE_TAB_PRIORITY.flatMap((href) => allowed.filter((n) => n.href === href)).slice(0, 3);
}

/** Whether `href` is the page being shown (home only matches exactly). */
export const isActive = (href: string, pathname: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

/** The sidebar's groups, in order; the first has no title (Bosh sahifa, Analitika). */
export const NAV_SECTIONS: { title: string | null; hrefs: string[] }[] = [
  { title: null, hrefs: ["/", "/analytics"] },
  { title: "O'quv", hrefs: ["/students", "/risk", "/groups", "/schedule", "/teachers", "/availability", "/courses", "/rooms"] },
  { title: "Sotuv", hrefs: ["/leads", "/sales"] },
  { title: "Moliya", hrefs: ["/payments", "/debtors", "/finance", "/salaries", "/shop"] },
  { title: "Tizim", hrefs: ["/activity", "/settings"] },
];

/** The allowed pages grouped into sections; a section with nothing allowed is left out. */
export function navSections(permissions: string[]) {
  const allowed = allowedNav(permissions);
  return NAV_SECTIONS.map((s) => ({ title: s.title, items: s.hrefs.flatMap((h) => allowed.filter((n) => n.href === h)) })).filter((s) => s.items.length);
}
