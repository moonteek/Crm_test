// Salary rules (User.salaryType); kept apart from salary.ts so forms in the browser can use them.
export const SALARY_TYPES: Record<string, { label: string; unit: string }> = {
  NONE: { label: "Belgilanmagan", unit: "" },
  FIXED: { label: "Oylik (qat'iy)", unit: "so'm / oy" },
  PERCENT: { label: "Tushumdan foiz", unit: "% o'zi dars beradigan yoki yordamchi bo'lgan guruhlar to'lovlaridan" },
  PER_STUDENT: { label: "Har bir o'quvchi uchun", unit: "so'm / o'quvchi" },
};
