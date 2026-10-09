# Algoritm CRM

O'quv markazi uchun CRM tizimi: lidlar, o'quvchilar, guruhlar, davomat, to'lovlar, qarzdorlar va moliya.

## Imkoniyatlar

- **Bosh sahifa** — faol o'quvchilar, guruhlar, lidlar, qarzdorlar, oylik tushum/xarajat, bugungi darslar
- **Lidlar** — kanban (Yangi → Bog'lanildi → Sinov darsi → O'qishga yozildi / Rad etdi), lidni bir bosishda o'quvchiga aylantirish
- **O'quvchilar** — qidiruv, profil, guruhga qo'shish/chiqarish, balans, to'lovlar tarixi, davomat foizi
- **Guruhlar** — jadval (toq/juft kunlar), o'qituvchi, xona, oylik davomat jadvali
- **To'lovlar** — oy bo'yicha, to'lov turi bo'yicha (naqd / karta / o'tkazma)
- **Qarzdorlar** — avtomatik hisoblanadi: har bir oy uchun kurs narxi − to'langan summa
- **Moliya** — xarajatlar, yillik tushum/xarajat grafigi, sof foyda
- **O'qituvchilar, kurslar, xonalar**, **Sozlamalar** (xodimlar va rollar: Administrator, Menejer, O'qituvchi)

## Texnologiyalar

Next.js 15 (App Router, Server Actions), TypeScript, Tailwind CSS 4, Prisma ORM.
Lokal ishlashda SQLite; productionda PostgreSQL ga o'tish uchun `prisma/schema.prisma` dagi `provider` ni `"postgresql"` ga o'zgartiring.

## Ishga tushirish

```bash
npm install
cp .env.example .env      # AUTH_SECRET ni o'zgartiring
npm run setup             # bazani yaratadi va demo ma'lumotlarni qo'shadi
npm run dev               # http://localhost:3000
```

Demo kirish: telefon `901234567`, parol `admin123` (productionda darhol o'zgartiring).

Productionda sessiya cookie faqat HTTPS orqali yuboriladi, shuning uchun saytni HTTPS bilan joylashtiring.
