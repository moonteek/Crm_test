import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLES } from "../src/lib/permissions";
import { lessonDates } from "../src/lib/format";
import { salariesForMonth } from "../src/lib/salary";

const db = new PrismaClient();

// Deterministic pseudo-random numbers so every seed produces the same demo data.
let state = 42;
const rand = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

const FIRST = ["Abdulloh", "Madina", "Sardor", "Nilufar", "Bekzod", "Shahzoda", "Otabek", "Zarina", "Javohir", "Malika", "Diyorbek", "Sevara", "Islom", "Gulnoza", "Ulug'bek", "Kamola", "Jasurbek", "Dilshoda", "Sherzod", "Mohinur", "Azizbek", "Nodira", "Bobur", "Feruza", "Timur", "Laylo", "Akbar", "Munisa", "Doniyor", "Iroda"];
const LAST = ["Yusupov", "Ergasheva", "Aliyev", "Qodirova", "Ismoilov", "Nazarova", "Mirzayev", "Xolmatova", "Sobirov", "Usmonova", "Hasanov", "Jo'rayeva", "Ortiqov", "Saidova", "Tursunov", "Rahimova", "Karimov", "Abdullayeva"];

async function main() {
  // Add any missing default roles (also safe on a database that is already in use).
  const roles: Record<string, number> = {};
  for (const r of DEFAULT_ROLES) {
    const role =
      (await db.role.findUnique({ where: { name: r.name } })) ??
      (await db.role.create({ data: { name: r.name, isSystem: r.isSystem ?? false, permissions: r.permissions.join(",") } }));
    roles[r.name] = role.id;
  }
  if (await db.user.count()) {
    console.log("Default roles checked. Database already has data, skipping demo data.");
    return;
  }
  const now = new Date();
  const monthStart = (back: number) => new Date(now.getFullYear(), now.getMonth() - back, 1);

  const pw = await bcrypt.hash("admin123", 10);
  const admin = await db.user.create({ data: { name: "Direktor", phone: "901234567", password: pw, roleId: roles["Administrator"] } });
  await db.user.create({ data: { name: "Menejer", phone: "901112233", password: pw, roleId: roles["Menejer"], salaryType: "FIXED", salaryAmount: 3_500_000 } });
  await db.user.create({ data: { name: "Kassir", phone: "901114455", password: pw, roleId: roles["Kassir"], salaryType: "FIXED", salaryAmount: 2_500_000 } });
  await db.user.create({ data: { name: "Nazoratchi", phone: "901117788", password: pw, roleId: roles["Nazoratchi"] } });
  await db.user.create({ data: { name: "O'quv bo'limi boshlig'i", phone: "901119900", password: pw, roleId: roles["O'quv bo'limi boshlig'i"], salaryType: "FIXED", salaryAmount: 4_000_000 } });
  await db.user.create({ data: { name: "Qabulxona operatori", phone: "901116677", password: pw, roleId: roles["Qabulxona operatori"], salaryType: "FIXED", salaryAmount: 2_000_000 } });
  const assistant = await db.user.create({
    data: { name: "Shoxrux Aliyev", phone: "930000009", password: pw, roleId: roles["Yordamchi o'qituvchi"], isTeacher: true, salaryType: "PER_STUDENT", salaryAmount: 50_000 },
  });
  const teacherSpecs = [
    { name: "Aziz Karimov", salaryType: "PERCENT", salaryAmount: 40 },
    { name: "Dilnoza Rahimova", salaryType: "PER_STUDENT", salaryAmount: 180_000 },
    { name: "Jasur Toshmatov", salaryType: "FIXED", salaryAmount: 3_500_000 },
  ];
  const teachers = [];
  for (const [i, t] of teacherSpecs.entries()) {
    teachers.push(await db.user.create({ data: { ...t, phone: `93000000${i}`, password: pw, roleId: roles["O'qituvchi"], isTeacher: true } }));
  }

  const courses = await Promise.all([
    db.course.create({ data: { name: "Frontend dasturlash", price: 600_000, durationMon: 8, description: "HTML, CSS, JavaScript, React" } }),
    db.course.create({ data: { name: "Backend (Python)", price: 650_000, durationMon: 8, description: "Python, Django, PostgreSQL" } }),
    db.course.create({ data: { name: "Kompyuter savodxonligi", price: 350_000, durationMon: 3, description: "Windows, Word, Excel, Internet" } }),
    db.course.create({ data: { name: "Robototexnika (bolalar)", price: 450_000, durationMon: 6, description: "Arduino va Scratch" } }),
  ]);
  const rooms = await Promise.all(["1-xona", "2-xona", "Kompyuter xonasi"].map((name) => db.room.create({ data: { name } })));

  // [name, course, teacher, room, days, time, months ago started, finished?]
  const groupSpecs = [
    ["FE-12", 0, 0, 2, "ODD", "10:00", 11, true],
    ["FE-14", 0, 0, 2, "ODD", "14:00", 7, false],
    ["PY-07", 1, 1, 2, "EVEN", "16:00", 9, false],
    ["KS-20", 2, 2, 0, "EVEN", "10:00", 6, true],
    ["KS-21", 2, 2, 0, "ODD", "10:00", 3, false],
    ["ROBO-3", 3, 2, 1, "EVEN", "09:00", 5, false],
  ] as const;
  const groups = [];
  for (const [name, c, t, r, days, time, ago, finished] of groupSpecs) {
    groups.push({
      group: await db.group.create({
        data: { name, courseId: courses[c].id, teacherId: teachers[t].id, assistantId: name === "FE-14" || name === "PY-07" ? assistant.id : null, roomId: rooms[r].id, days, time, startDate: new Date(now.getFullYear(), now.getMonth() - ago, 3), status: finished ? "FINISHED" : "ACTIVE" },
      }),
      course: courses[c],
      ago,
      // finished groups ran for their course length
      endsAgo: finished ? Math.max(0, ago - courses[c].durationMon) : null,
    });
  }

  let phoneSeq = 1000;
  const attendance: { groupId: number; studentId: number; date: Date; present: boolean }[] = [];
  const grades: { groupId: number; studentId: number; date: Date; score: number }[] = [];
  const skills = new Map<number, number>();

  for (const g of groups) {
    const size = 10 + Math.floor(rand() * 6);
    for (let i = 0; i < size; i++) {
      // most students join at the start, some join later
      const lateBy = rand() < 0.7 ? 0 : 1 + Math.floor(rand() * Math.min(3, g.ago));
      const joinedAt = new Date(now.getFullYear(), now.getMonth() - g.ago + lateBy, 3 + Math.floor(rand() * 10));
      if (joinedAt > now) continue;
      let leftAt: Date | null = null;
      if (g.endsAgo !== null) leftAt = new Date(now.getFullYear(), now.getMonth() - g.endsAgo, 25);
      else if (rand() < 0.15) {
        const span = Math.max(1, g.ago - lateBy);
        const leftMonth = Math.floor(rand() * span);
        leftAt = new Date(now.getFullYear(), now.getMonth() - g.ago + lateBy + leftMonth, 20);
        if (leftAt > now) leftAt = null;
      }
      const student = await db.student.create({
        data: {
          name: `${pick(FIRST)} ${pick(LAST)}`,
          phone: `+99890${String(phoneSeq++ * 7919).padStart(7, "0").slice(-7)}`,
          parentPhone: `+99891${String(phoneSeq * 3571).padStart(7, "0").slice(-7)}`,
          createdAt: joinedAt,
          groups: { create: { groupId: g.group.id, joinedAt, leftAt } },
        },
      });
      const skill = 0.35 + rand() * 0.65; // drives attendance, grades and payment discipline
      skills.set(student.id, skill);

      // payments: one per enrolled month; weaker payers skip some recent months
      const end = leftAt ?? now;
      const months = (end.getFullYear() - joinedAt.getFullYear()) * 12 + end.getMonth() - joinedAt.getMonth() + 1;
      const payRecords = [];
      for (let m = 0; m < months; m++) {
        const isRecent = months - m <= 2;
        if (isRecent && rand() > 0.55 + skill * 0.45) continue;
        payRecords.push({
          studentId: student.id, groupId: g.group.id, amount: g.course.price,
          method: pick(["CASH", "CASH", "CARD", "TRANSFER"]),
          date: new Date(joinedAt.getFullYear(), joinedAt.getMonth() + m, Math.min(28, 4 + Math.floor(rand() * 12))),
        });
      }
      await db.payment.createMany({ data: payRecords.filter((p) => p.date <= now) });

      // attendance & grades on every lesson day while enrolled
      for (let m = 0; m < months; m++) {
        const d = new Date(joinedAt.getFullYear(), joinedAt.getMonth() + m, 1);
        for (const day of lessonDates(g.group.days, d.getFullYear(), d.getMonth())) {
          if (day < joinedAt || day > end || day > now) continue;
          const present = rand() < 0.55 + skill * 0.43;
          attendance.push({ groupId: g.group.id, studentId: student.id, date: day, present });
          if (present && rand() < 0.4) {
            const score = Math.max(2, Math.min(5, Math.round(1.8 + skill * 3.4 + (rand() - 0.5) * 1.2)));
            grades.push({ groupId: g.group.id, studentId: student.id, date: day, score });
          }
        }
      }
    }
  }
  for (let i = 0; i < attendance.length; i += 500) await db.attendance.createMany({ data: attendance.slice(i, i + 500) });
  for (let i = 0; i < grades.length; i += 500) await db.grade.createMany({ data: grades.slice(i, i + 500) });

  // exams every two months for each group
  for (const g of groups) {
    const last = g.endsAgo ?? 0;
    for (let ago = g.ago - 1; ago >= last; ago -= 2) {
      const date = new Date(now.getFullYear(), now.getMonth() - ago, 26);
      if (date > now) continue;
      const members = await db.groupStudent.findMany({ where: { groupId: g.group.id, joinedAt: { lt: date }, OR: [{ leftAt: null }, { leftAt: { gte: date } }] } });
      await db.exam.create({
        data: {
          groupId: g.group.id, title: `${Math.floor((g.ago - ago) / 2) + 1}-modul imtihoni`, date, maxScore: 100,
          results: { create: members.map((m) => ({ studentId: m.studentId, score: Math.max(20, Math.min(100, Math.round(35 + (skills.get(m.studentId) ?? 0.6) * 62 + (rand() - 0.5) * 18))) })) },
        },
      });
    }
  }

  // salespeople, leads with contact history, KPI targets
  const sellers = [
    await db.user.create({ data: { name: "Nodira Karimova", phone: "901113301", password: pw, roleId: roles["Sotuv menejeri"], isSales: true, salaryType: "FIXED", salaryAmount: 3_000_000 } }),
    await db.user.create({ data: { name: "Sardor Yo'ldoshev", phone: "901113302", password: pw, roleId: roles["Sotuv menejeri"], isSales: true, salaryType: "FIXED", salaryAmount: 3_000_000 } }),
  ];
  const sources = ["Instagram", "Instagram", "Instagram", "Telegram", "Telegram", "Tanish orqali", "Banner", "Facebook"];
  const conv: Record<string, number> = { Instagram: 0.3, Telegram: 0.35, "Tanish orqali": 0.6, Banner: 0.15, Facebook: 0.2 };
  const lostReasons = ["Narx qimmat", "Narx qimmat", "Vaqt to'g'ri kelmadi", "Vaqt to'g'ri kelmadi", "Manzil uzoq", "Boshqa markazni tanladi", "Javob bermayapti", "Shunchaki qiziqdi"];
  const linkedStudents = new Set<number>();
  const addDays = (d: Date, n: number, h = 11) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, h, Math.floor(rand() * 60));
  for (let ago = 11; ago >= 0; ago--) {
    const count = 8 + Math.floor(rand() * 8);
    for (let i = 0; i < count; i++) {
      const createdAt = new Date(now.getFullYear(), now.getMonth() - ago, 1 + Math.floor(rand() * 27), 9 + Math.floor(rand() * 9));
      if (createdAt > now) continue;
      const source = pick(sources);
      // the second seller converts a bit better
      const seller = sellers[i % 2];
      const skill = i % 2 === 0 ? 0 : 0.08;
      const r = rand();
      const fresh = (now.getTime() - createdAt.getTime()) / 86400_000 < 10;
      const status = fresh && r < 0.6 ? pick(["NEW", "CONTACTED", "TRIAL"]) : r < conv[source] + skill ? "WON" : r < conv[source] + skill + 0.45 ? "LOST" : pick(["CONTACTED", "TRIAL"]);
      const lead = await db.lead.create({
        data: {
          name: `${pick(FIRST)} ${pick(LAST)}`, phone: `+99899${String(phoneSeq++ * 4111).padStart(7, "0").slice(-7)}`,
          source, status, courseId: pick(courses).id, createdAt, assignedToId: seller.id,
          lostReason: status === "LOST" ? pick(lostReasons) : null,
        },
      });
      // history: a few calls/messages, then status changes
      const acts: { type: string; result?: string | null; text?: string | null; createdAt: Date }[] = [];
      let day = 0;
      if (status !== "NEW") {
        const tries = 1 + Math.floor(rand() * 3);
        for (let t = 0; t < tries; t++) {
          day += Math.floor(rand() * 2);
          const answered = t === tries - 1 || rand() < 0.5;
          acts.push({ type: rand() < 0.75 ? "CALL" : "MESSAGE", result: answered ? "ANSWERED" : pick(["NO_ANSWER", "BUSY"]), text: answered ? pick(["Narxni so'radi", "Jadvalni so'radi", "Ota-onasi bilan maslahatlashadi", "Sinov darsiga qiziqdi"]) : null, createdAt: addDays(createdAt, day) });
        }
        acts.push({ type: "STATUS", result: "CONTACTED", createdAt: addDays(createdAt, day, 12) });
      }
      if (status === "TRIAL" || status === "WON" || (status === "LOST" && rand() < 0.4)) {
        day += 1 + Math.floor(rand() * 3);
        acts.push({ type: "STATUS", result: "TRIAL", createdAt: addDays(createdAt, day) });
      }
      let wonAt: Date | null = null;
      if (status === "WON" || status === "LOST") {
        day += 1 + Math.floor(rand() * 4);
        const at = addDays(createdAt, day, 15);
        acts.push({ type: "STATUS", result: status, text: status === "LOST" ? lead.lostReason : null, createdAt: at });
        if (status === "WON") wonAt = at;
      }
      const valid = acts.filter((x) => x.createdAt <= now);
      if (valid.length) await db.leadActivity.createMany({ data: valid.map((x) => ({ ...x, leadId: lead.id, userId: seller.id })) });
      const open = ["NEW", "CONTACTED", "TRIAL"].includes(status);
      // open leads get a follow-up: some overdue, some today, some later
      const nextActionAt = open ? addDays(now, pick([-2, -1, 0, 0, 1, 2]), pick([10, 14, 17])) : null;
      let studentId: number | null = null;
      if (wonAt && wonAt <= now) {
        const candidate = await db.student.findFirst({
          where: { id: { notIn: [...linkedStudents] }, createdAt: { gte: new Date(wonAt.getFullYear(), wonAt.getMonth(), 1), lt: new Date(wonAt.getFullYear(), wonAt.getMonth() + 1, 1) } },
        });
        if (candidate) { studentId = candidate.id; linkedStudents.add(candidate.id); }
      }
      await db.lead.update({ where: { id: lead.id }, data: { nextActionAt, wonAt: wonAt && wonAt <= now ? wonAt : null, studentId } });
    }
  }
  for (let ago = 3; ago >= 0; ago--) {
    const d = monthStart(ago);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    for (const sl of sellers) {
      await db.kpiTarget.createMany({
        data: [
          { userId: sl.id, month: key, metric: "WON", target: 4, bonus: 400_000, perExtra: 100_000 },
          { userId: sl.id, month: key, metric: "CALLS", target: 12, bonus: 150_000 },
          { userId: sl.id, month: key, metric: "CONVERSION", target: 35, bonus: 300_000 },
        ],
      });
    }
  }

  // shop: books and merch, sold to students over the last 6 months
  const productSpecs = [
    ["Python asoslari (kitob)", "BOOK", 120_000, 70_000],
    ["JavaScript darsligi", "BOOK", 110_000, 65_000],
    ["Kompyuter savodxonligi daftari", "BOOK", 45_000, 25_000],
    ["Algoritm futbolkasi", "MERCH", 90_000, 45_000],
    ["Algoritm xudi", "MERCH", 220_000, 120_000],
    ["Algoritm krujkasi", "MERCH", 50_000, 22_000],
    ["Stiker to'plami", "OTHER", 15_000, 5_000],
  ] as const;
  const products = [];
  for (const [name, category, price, cost] of productSpecs) {
    const initial = 30 + Math.floor(rand() * 30);
    const p = await db.product.create({ data: { name, category, price, cost, stock: initial } });
    await db.stockMove.create({ data: { productId: p.id, type: "IN", qty: initial, note: "Boshlang'ich qoldiq", createdAt: monthStart(6) } });
    await db.expense.create({ data: { title: `Tovar xaridi — ${name} × ${initial}`, category: "GOODS", amount: initial * cost, date: monthStart(6) } });
    products.push(p);
  }
  const cashier = await db.user.findUniqueOrThrow({ where: { phone: "901114455" } });
  const allStudents = await db.student.findMany({ select: { id: true } });
  for (let ago = 5; ago >= 0; ago--) {
    const n = 8 + Math.floor(rand() * 10);
    for (let i = 0; i < n; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - ago, 1 + Math.floor(rand() * 27), 10 + Math.floor(rand() * 8));
      if (date > now) continue;
      const picks = [pick(products), ...(rand() < 0.3 ? [pick(products)] : [])];
      const items = [...new Map(picks.map((p) => [p.id, p])).values()].map((p) => ({ productId: p.id, qty: rand() < 0.85 ? 1 : 2, price: p.price, cost: p.cost }));
      const fresh = await db.product.findMany({ where: { id: { in: items.map((x) => x.productId) } } });
      if (items.some((it) => (fresh.find((f) => f.id === it.productId)?.stock ?? 0) < it.qty)) continue;
      for (const it of items) {
        await db.product.update({ where: { id: it.productId }, data: { stock: { decrement: it.qty } } });
        await db.stockMove.create({ data: { productId: it.productId, type: "OUT", qty: -it.qty, createdAt: date } });
      }
      await db.sale.create({
        data: {
          studentId: pick(allStudents).id, userId: cashier.id, date, method: pick(["CASH", "CASH", "CARD"]),
          total: items.reduce((s, it) => s + it.qty * it.price, 0), items: { create: items },
        },
      });
    }
  }

  // fixed monthly costs and salaries for each finished month (current month: only rent so far)
  for (let ago = 11; ago >= 0; ago--) {
    const d = monthStart(ago);
    await db.expense.create({ data: { title: "Bino ijarasi", category: "RENT", amount: 4_000_000, date: new Date(d.getFullYear(), d.getMonth(), 1) } });
    if (ago === 0) continue;
    await db.expense.create({ data: { title: "Instagram reklama", category: "MARKETING", amount: 800_000 + Math.round(rand() * 8) * 100_000, date: new Date(d.getFullYear(), d.getMonth(), 10) } });
    await db.expense.create({ data: { title: "Kommunal to'lovlar", category: "UTILITIES", amount: 600_000 + Math.round(rand() * 6) * 50_000, date: new Date(d.getFullYear(), d.getMonth(), 15) } });
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    for (const row of await salariesForMonth(key)) {
      if (row.accrued <= 0) continue;
      const date = new Date(d.getFullYear(), d.getMonth() + 1, 5);
      const expense = await db.expense.create({ data: { title: `Ish haqi — ${row.name} (${key})`, category: "SALARY", amount: row.accrued, date } });
      await db.salaryPayment.create({ data: { userId: row.userId, month: key, amount: row.accrued, date, expenseId: expense.id } });
    }
  }

  await db.auditLog.create({ data: { userId: admin.id, action: "auth.login", summary: "Direktor tizimga kirdi" } });
  console.log(`Seed done: ${await db.student.count()} o'quvchi, ${attendance.length} davomat, ${grades.length} baho.`);
  console.log("Login: 901234567 / admin123 — boshqa demo xodimlar README da");
}

main().finally(() => db.$disconnect());
