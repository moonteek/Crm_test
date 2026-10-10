export const PERMISSION_GROUPS: { title: string; items: { key: string; label: string }[] }[] = [
  {
    title: "Umumiy",
    items: [
      { key: "dashboard.view", label: "Bosh sahifani ko'rish" },
      { key: "analytics.view", label: "Analitika va hisobotlarni ko'rish (butun markaz bo'yicha)" },
      { key: "audit.view", label: "Faoliyat jurnalini ko'rish (kim nima qildi)" },
    ],
  },
  {
    title: "Lidlar",
    items: [
      { key: "leads.view", label: "Lidlarni ko'rish" },
      { key: "leads.manage", label: "Lid qo'shish, holatini o'zgartirish, o'chirish, sotuvchiga biriktirish" },
      { key: "leads.own", label: "Faqat o'ziga biriktirilgan lidlarni ko'rish (sotuvchilar uchun cheklov)" },
    ],
  },
  {
    title: "Sotuv",
    items: [
      { key: "sales.view", label: "Sotuv natijalari va KPI ni ko'rish" },
      { key: "sales.manage", label: "Sotuvchilarga KPI va bonus belgilash" },
    ],
  },
  {
    title: "Do'kon",
    items: [
      { key: "shop.view", label: "Do'kon: mahsulotlar va savdolarni ko'rish" },
      { key: "shop.sell", label: "Do'kon: mahsulot sotish" },
      { key: "shop.manage", label: "Do'kon: mahsulot qo'shish, narx va ombor (kirim) boshqarish" },
    ],
  },
  {
    title: "O'quvchilar",
    items: [
      { key: "students.view", label: "O'quvchilarni ko'rish" },
      { key: "students.manage", label: "O'quvchi qo'shish, tahrirlash, guruhga qo'shish" },
      { key: "students.delete", label: "O'quvchini o'chirish" },
    ],
  },
  {
    title: "Guruhlar",
    items: [
      { key: "groups.view", label: "Guruhlarni ko'rish" },
      { key: "groups.all", label: "Barcha guruhlarni ko'rish (aks holda faqat o'zi dars beradigan guruhlar)" },
      { key: "groups.manage", label: "Guruh ochish va tahrirlash" },
      { key: "groups.delete", label: "Guruhni o'chirish" },
      { key: "attendance.mark", label: "Davomat qilish" },
      { key: "grades.manage", label: "Baho qo'yish va imtihon natijalarini kiritish" },
    ],
  },
  {
    title: "Moliya",
    items: [
      { key: "payments.view", label: "To'lovlarni ko'rish" },
      { key: "payments.create", label: "To'lov qabul qilish" },
      { key: "payments.delete", label: "To'lovni o'chirish" },
      { key: "debtors.view", label: "Qarzdorlarni ko'rish" },
      { key: "finance.view", label: "Moliya hisobotlarini ko'rish (tushum, xarajat, foyda)" },
      { key: "finance.manage", label: "Xarajat qo'shish va o'chirish" },
      { key: "salaries.view", label: "Ish haqlarini ko'rish" },
      { key: "salaries.manage", label: "Ish haqi qoidalarini belgilash va ish haqi to'lash" },
    ],
  },
  {
    title: "Ma'lumotnomalar",
    items: [
      { key: "teachers.view", label: "O'qituvchilarni ko'rish" },
      { key: "courses.view", label: "Kurslarni ko'rish" },
      { key: "courses.manage", label: "Kurs qo'shish va tahrirlash" },
      { key: "rooms.manage", label: "Xonalarni boshqarish" },
    ],
  },
  {
    title: "Tizim",
    items: [
      { key: "staff.manage", label: "Xodimlar va rollarni boshqarish" },
      { key: "mcp.use", label: "MCP orqali AI yordamchini ulash (shaxsiy token)" },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export type Permission = (typeof ALL_PERMISSIONS)[number];

/** Permissions that limit access rather than grant it; the administrator never has these. */
export const RESTRICTIONS = ["leads.own"];

export function parsePermissions(role: { permissions: string; isSystem: boolean }) {
  if (role.isSystem) return new Set(ALL_PERMISSIONS.filter((p) => !RESTRICTIONS.includes(p)));
  return new Set(role.permissions.split(",").filter((p) => ALL_PERMISSIONS.includes(p)));
}

/** Default roles. `npm run db:seed` adds any that are missing (matched by name) and never edits existing ones. */
export const DEFAULT_ROLES: { name: string; isSystem?: boolean; permissions: string[] }[] = [
  { name: "Administrator", isSystem: true, permissions: [] },
  {
    // sees everything, changes nothing — for an owner, investor or auditor
    name: "Nazoratchi",
    permissions: [
      "dashboard.view", "analytics.view", "audit.view", "leads.view", "students.view", "groups.view", "groups.all",
      "payments.view", "debtors.view", "finance.view", "salaries.view", "teachers.view", "courses.view",
      "sales.view", "shop.view",
    ],
  },
  {
    name: "Menejer",
    permissions: [
      "dashboard.view", "leads.view", "leads.manage", "students.view", "students.manage",
      "groups.view", "groups.all", "groups.manage", "attendance.mark", "grades.manage",
      "payments.view", "payments.create", "debtors.view", "sales.view", "shop.view", "shop.sell",
      "teachers.view", "courses.view", "rooms.manage", "mcp.use",
    ],
  },
  {
    // sells courses: works only with the leads assigned to them
    name: "Sotuv menejeri",
    permissions: [
      "dashboard.view", "leads.view", "leads.manage", "leads.own", "students.view", "students.manage",
      "groups.view", "groups.all", "courses.view", "sales.view", "mcp.use",
    ],
  },
  {
    // academic side only: no payments, finance or salaries
    name: "O'quv bo'limi boshlig'i",
    permissions: [
      "dashboard.view", "analytics.view", "leads.view", "students.view", "students.manage",
      "groups.view", "groups.all", "groups.manage", "attendance.mark", "grades.manage",
      "teachers.view", "courses.view", "courses.manage", "rooms.manage", "mcp.use",
    ],
  },
  {
    name: "Kassir",
    permissions: ["dashboard.view", "students.view", "groups.view", "groups.all", "payments.view", "payments.create", "debtors.view", "shop.view", "shop.sell"],
  },
  {
    // reception / call centre: leads and sign-ups, no money
    name: "Qabulxona operatori",
    permissions: ["dashboard.view", "leads.view", "leads.manage", "students.view", "students.manage", "groups.view", "groups.all", "courses.view", "shop.view", "shop.sell"],
  },
  {
    name: "O'qituvchi",
    permissions: ["groups.view", "students.view", "attendance.mark", "grades.manage"],
  },
  {
    // sees only the groups they are assigned to as assistant
    name: "Yordamchi o'qituvchi",
    permissions: ["groups.view", "students.view", "attendance.mark", "grades.manage"],
  },
];
