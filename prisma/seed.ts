import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLES } from "../src/lib/permissions";

const db = new PrismaClient();

async function main() {
  if (await db.user.count()) {
    console.log("Database already has data, skipping seed.");
    return;
  }
  const roles: Record<string, number> = {};
  for (const r of DEFAULT_ROLES) {
    const role = await db.role.create({ data: { name: r.name, isSystem: r.isSystem ?? false, permissions: r.permissions.join(",") } });
    roles[r.name] = role.id;
  }
  const pw = await bcrypt.hash("admin123", 10);
  await db.user.create({ data: { name: "Direktor", phone: "901234567", password: pw, roleId: roles["Administrator"] } });
  await db.user.create({ data: { name: "Menejer", phone: "901112233", password: pw, roleId: roles["Menejer"] } });
  await db.user.create({ data: { name: "Kassir", phone: "901114455", password: pw, roleId: roles["Kassir"] } });
  const teachers = await Promise.all(
    ["Aziz Karimov", "Dilnoza Rahimova", "Jasur Toshmatov"].map((name, i) =>
      db.user.create({ data: { name, phone: `93000000${i}`, password: pw, roleId: roles["O'qituvchi"], isTeacher: true } }),
    ),
  );

  const courses = await Promise.all([
    db.course.create({ data: { name: "Frontend dasturlash", price: 600000, durationMon: 8, description: "HTML, CSS, JavaScript, React" } }),
    db.course.create({ data: { name: "Backend (Python)", price: 650000, durationMon: 8, description: "Python, Django, PostgreSQL" } }),
    db.course.create({ data: { name: "Kompyuter savodxonligi", price: 350000, durationMon: 3, description: "Windows, Word, Excel, Internet" } }),
    db.course.create({ data: { name: "Robototexnika (bolalar)", price: 450000, durationMon: 6, description: "Arduino va Scratch" } }),
  ]);
  const rooms = await Promise.all(["1-xona", "2-xona", "Kompyuter xonasi"].map((name) => db.room.create({ data: { name } })));

  const now = new Date();
  const monthsAgo = (n: number) => new Date(now.getFullYear(), now.getMonth() - n, 5);
  const groups = await Promise.all([
    db.group.create({ data: { name: "FE-14", courseId: courses[0].id, teacherId: teachers[0].id, roomId: rooms[2].id, days: "ODD", time: "14:00", startDate: monthsAgo(2) } }),
    db.group.create({ data: { name: "PY-07", courseId: courses[1].id, teacherId: teachers[1].id, roomId: rooms[2].id, days: "EVEN", time: "16:00", startDate: monthsAgo(1) } }),
    db.group.create({ data: { name: "KS-21", courseId: courses[2].id, teacherId: teachers[2].id, roomId: rooms[0].id, days: "ODD", time: "10:00", startDate: monthsAgo(1) } }),
    db.group.create({ data: { name: "ROBO-3", courseId: courses[3].id, teacherId: teachers[2].id, roomId: rooms[1].id, days: "EVEN", time: "09:00", startDate: monthsAgo(0) } }),
  ]);

  const names = [
    "Abdulloh Yusupov", "Madina Ergasheva", "Sardor Aliyev", "Nilufar Qodirova", "Bekzod Ismoilov",
    "Shahzoda Nazarova", "Otabek Mirzayev", "Zarina Xolmatova", "Javohir Sobirov", "Malika Usmonova",
    "Diyorbek Hasanov", "Sevara Jo'rayeva", "Islom Ortiqov", "Gulnoza Saidova", "Ulug'bek Tursunov",
    "Kamola Abdurahmonova",
  ];
  for (const [i, name] of names.entries()) {
    const group = groups[i % groups.length];
    const joined = new Date(Math.max(group.startDate.getTime(), monthsAgo(2).getTime()));
    const student = await db.student.create({
      data: {
        name,
        phone: `+99890${String(1000000 + i * 7919).slice(0, 7)}`,
        parentPhone: `+99891${String(2000000 + i * 3571).slice(0, 7)}`,
        groups: { create: { groupId: group.id, joinedAt: joined } },
      },
    });
    const course = courses.find((c) => c.id === group.courseId)!;
    const months = (now.getFullYear() - joined.getFullYear()) * 12 + now.getMonth() - joined.getMonth() + 1;
    // Every fourth student is one month behind on payments.
    const paidMonths = i % 4 === 0 ? months - 1 : months;
    for (let m = 0; m < paidMonths; m++) {
      await db.payment.create({
        data: {
          studentId: student.id,
          groupId: group.id,
          amount: course.price,
          method: ["CASH", "CARD", "TRANSFER"][i % 3],
          date: new Date(joined.getFullYear(), joined.getMonth() + m, 7),
        },
      });
    }
  }

  const leads = [
    ["Akmal Rustamov", "Instagram", 0, "NEW"], ["Feruza Komilova", "Telegram", 1, "NEW"],
    ["Sanjar Bakirov", "Tanish orqali", 0, "CONTACTED"], ["Lola Yo'ldosheva", "Instagram", 2, "CONTACTED"],
    ["Asadbek Normatov", "Banner", 3, "TRIAL"], ["Mohira Valiyeva", "Telegram", 0, "LOST"],
  ] as const;
  for (const [i, [name, source, c, status]] of leads.entries()) {
    await db.lead.create({ data: { name, source, status, courseId: courses[c].id, phone: `+99899${String(3000000 + i * 4111).slice(0, 7)}` } });
  }

  for (let m = 2; m >= 0; m--) {
    await db.expense.create({ data: { title: "Bino ijarasi", category: "RENT", amount: 5000000, date: monthsAgo(m) } });
    await db.expense.create({ data: { title: "O'qituvchilar oyligi", category: "SALARY", amount: 9000000, date: monthsAgo(m) } });
    await db.expense.create({ data: { title: "Instagram reklama", category: "MARKETING", amount: 1200000, date: monthsAgo(m) } });
  }
  console.log("Seed done. Admin login: 901234567 / admin123 (menejer 901112233, kassir 901114455, o'qituvchi 930000000 — parol bir xil)");
}

main().finally(() => db.$disconnect());
