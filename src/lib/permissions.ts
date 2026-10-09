export const PERMISSION_GROUPS: { title: string; items: { key: string; label: string }[] }[] = [
  {
    title: "Umumiy",
    items: [{ key: "dashboard.view", label: "Bosh sahifani ko'rish" }],
  },
  {
    title: "Lidlar",
    items: [
      { key: "leads.view", label: "Lidlarni ko'rish" },
      { key: "leads.manage", label: "Lid qo'shish, holatini o'zgartirish, o'chirish" },
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

export function parsePermissions(role: { permissions: string; isSystem: boolean }) {
  if (role.isSystem) return new Set(ALL_PERMISSIONS);
  return new Set(role.permissions.split(",").filter((p) => ALL_PERMISSIONS.includes(p)));
}

/** Default roles created for a fresh database. */
export const DEFAULT_ROLES: { name: string; isSystem?: boolean; permissions: string[] }[] = [
  { name: "Administrator", isSystem: true, permissions: [] },
  {
    name: "Menejer",
    permissions: [
      "dashboard.view", "leads.view", "leads.manage", "students.view", "students.manage",
      "groups.view", "groups.all", "groups.manage", "attendance.mark",
      "payments.view", "payments.create", "debtors.view",
      "teachers.view", "courses.view", "rooms.manage", "mcp.use",
    ],
  },
  {
    name: "Kassir",
    permissions: ["dashboard.view", "students.view", "groups.view", "groups.all", "payments.view", "payments.create", "debtors.view"],
  },
  {
    name: "O'qituvchi",
    permissions: ["groups.view", "students.view", "attendance.mark"],
  },
];
