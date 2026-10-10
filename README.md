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
- **O'qituvchilar, kurslar, xonalar**
- **Baholar va imtihonlar** — har bir dars uchun 1–5 baho, modul imtihonlari (ball / maksimal ball)
- **Ish haqi** — har bir xodim uchun qoida (oylik, tushumdan foiz yoki har bir o'quvchi uchun), oylik hisob-kitob va to'lovlar (avtomatik xarajat sifatida yoziladi)
- **Analitika** — 7 bo'lim: umumiy, to'lovlar, davomat, baholar, o'qituvchilar, lidlar, moliya; 3/6/12 oy yoki yil bo'yicha, oldingi davr bilan solishtirish
- **Faoliyat jurnali** — kim, qachon, nima qildi (to'lovlar, o'chirishlar, rol o'zgarishlari, AI orqali amallar)
- **Sotuv** — lidlar sotuvchilarga biriktiriladi (avtomatik yoki qo'lda), har bir qo'ng'iroq/xabar tarixi, keyingi aloqa eslatmalari, rad etish sabablari
- **KPI va bonuslar** — har oy sotuvchiga maqsad (yozilganlar, birinchi to'lovlar, sinov darslari, qo'ng'iroqlar, konversiya) va bonus; bonus ish haqiga avtomatik qo'shiladi
- **Do'kon** — kitob, merch va boshqa mahsulotlar: sotish, ombor qoldig'i, kirim, inventarizatsiya, yalpi foyda; savdo moliya va analitikaga qo'shiladi
- **Rollar va ruxsatlar** — direktor istalgancha rol yaratadi va har biriga 23 ta ruxsatdan keraklilarini belgilaydi
- **Xodimlar** — qo'shish, rolini o'zgartirish, parolni tiklash, bloklash
- **AI / MCP** — Claude kabi AI yordamchilarni CRM ga ulash

## Rollar va ruxsatlar

Standart rollar:

| Rol | Vazifasi |
|---|---|
| **Administrator** | Hamma narsa (o'zgartirib bo'lmaydi) |
| **Nazoratchi** | Hammasini ko'radi (analitika, moliya, ish haqi, jurnal), hech narsani o'zgartira olmaydi |
| **Menejer** | Lidlar, o'quvchilar, guruhlar, to'lov qabul qilish |
| **O'quv bo'limi boshlig'i** | Guruhlar, o'quvchilar, davomat, baholar, kurslar, o'qituvchilar analitikasi — pulsiz |
| **Sotuv menejeri** | Faqat o'ziga biriktirilgan lidlar, o'z natijalari va KPI si |
| **Kassir** | To'lovlar, qarzdorlar va do'kon savdosi |
| **Qabulxona operatori** | Lidlar va o'quvchilarni ro'yxatga olish |
| **O'qituvchi** | Faqat o'z guruhlari: davomat va baholar |
| **Yordamchi o'qituvchi** | Faqat yordamchi sifatida biriktirilgan guruhlari: davomat va baholar |

Har bir guruhga asosiy o'qituvchi va ixtiyoriy **yordamchi o'qituvchi** biriktiriladi.
Mavjud bazaga yangi standart rollarni qo'shish uchun `npm run db:seed` (mavjud ma'lumotlar va rollar o'zgarmaydi).
Sozlamalar → Rollar va ruxsatlar bo'limida yangi rol qo'shish yoki mavjudini o'zgartirish mumkin; o'zgarish darhol kuchga kiradi.
Analitika, ish haqi va faoliyat jurnali uchun alohida ruxsatlar bor. Analitikadagi pul ko'rsatkichlari (tushum, qarz, ish haqi) faqat "Moliya hisobotlarini ko'rish" ruxsati borlarga ko'rinadi.

- "Barcha guruhlarni ko'rish" ruxsati bo'lmagan xodim (masalan, o'qituvchi) faqat o'zi dars beradigan guruhlar va ularning o'quvchilarini ko'radi.
- Balans va qarzlar faqat "To'lovlarni ko'rish" yoki "Qarzdorlarni ko'rish" ruxsati borlarga ko'rinadi.
- Ruxsatlar har bir amalda serverda tekshiriladi, faqat tugmalarni yashirish bilan cheklanmaydi.
- Kamida bitta faol administrator doim qoladi; xodim o'zini bloklay olmaydi.

## AI yordamchini ulash (MCP)

CRM ichida MCP server bor: `https://<sayt>/api/mcp` (Streamable HTTP).

1. Sozlamalar → **AI / MCP ulanish** → **Token yaratish** (rolda "MCP" ruxsati bo'lishi kerak).
2. Ulash:
   - **Claude Code:** `claude mcp add --transport http algoritm-crm https://<sayt>/api/mcp --header "Authorization: Bearer <token>"`
   - **Claude.ai / Claude Desktop:** Settings → Connectors → Add custom connector, URL: `https://<sayt>/api/mcp/<token>` (bu URL parol kabi maxfiy).

AI token egasi nomidan ishlaydi va faqat uning roli ruxsat bergan vositalarni ko'radi. Vositalar:
`get_overview`, `search_students`, `get_student`, `list_groups`, `get_group_attendance`, `mark_attendance`,
`list_leads`, `create_lead`, `update_lead_status`, `list_debtors`, `record_payment`, `list_payments`,
`finance_summary`, `list_courses`, `get_analytics`, `get_salaries`, `record_grades`, `list_activity`,
`list_followups`, `log_lead_contact`, `get_sales_report`, `shop_report`.

Tokenlar bazada faqat xesh ko'rinishida saqlanadi; xodim bloklansa, uning tokenlari o'chiriladi.

## Texnologiyalar

Next.js 15 (App Router, Server Actions), TypeScript, Tailwind CSS 4, Prisma ORM, MCP TypeScript SDK.
Lokal ishlashda SQLite; productionda PostgreSQL ga o'tish uchun `prisma/schema.prisma` dagi `provider` ni `"postgresql"` ga o'zgartiring.

## Instagram / Telegram lidlarini ulash

`.env` faylida `LEADS_WEBHOOK_KEY` ga uzun maxfiy so'z yozing. So'ng ManyChat, Telegram bot, sayt formasi yoki Make/Zapier
`POST https://<sayt>/api/leads/inbound?key=<kalit>` manziliga `name`, `phone`, `source`, `course`, `note` maydonlarini yuborsin.
Lid avtomatik yaratiladi va eng kam band sotuvchiga biriktiriladi; o'sha raqam qayta yozsa, mavjud lidga izoh qo'shiladi.
Tayyor manzil: Sozlamalar → Integratsiyalar.

## KPI qanday hisoblanadi

- **O'qishga yozilganlar** — shu oyda sotuvchining lidi "Yozildi" bo'lgani.
- **Birinchi to'lovlar** — sotuvchi olib kelgan o'quvchilarning birinchi to'lovi shu oyga to'g'ri kelsa.
- **Sinov darsiga yozilganlar** va **qo'ng'iroqlar** — sotuvchi shu oyda yozib qo'ygan amallar.
- **Konversiya** — shu oyda kelgan lidlardan nechtasi yozilgani.
- Bonus maqsadga yetganda beriladi, ixtiyoriy ravishda maqsaddan oshgan har bir birlik uchun qo'shimcha.

## Analitika qanday hisoblanadi

- **Hisoblangan to'lov** — har bir o'quvchi guruhda o'qigan har bir oy uchun kurs narxi; **yig'ilish darajasi** = tushum / hisoblangan.
- **Tashlab ketganlar** — faol guruhdan chiqib, boshqa guruhda o'qimayotganlar. Guruh "Tugagan" deb belgilansa, o'quvchilar **bitirgan** hisoblanadi.
- **Saqlab qolish** — davr boshida o'qiyotgan o'quvchilardan davr oxirigacha qolganlar ulushi.
- **Ish haqi ulushi** — o'qituvchiga hisoblangan ish haqi / uning guruhlaridan tushum.

## Ishga tushirish

```bash
npm install
cp .env.example .env      # AUTH_SECRET ni o'zgartiring
npm run setup             # bazani yaratadi va demo ma'lumotlarni qo'shadi
npm run dev               # http://localhost:3000
```

Demo kirish (parol hammasida `admin123`, productionda darhol o'zgartiring):

| Rol | Telefon |
|---|---|
| Administrator | `901234567` |
| Menejer | `901112233` |
| Kassir | `901114455` |
| Sotuv menejeri | `901113301`, `901113302` |
| Nazoratchi | `901117788` |
| O'quv bo'limi boshlig'i | `901119900` |
| Qabulxona operatori | `901116677` |
| O'qituvchi | `930000000` |
| Yordamchi o'qituvchi | `930000009` |

Productionda sessiya cookie faqat HTTPS orqali yuboriladi, shuning uchun saytni HTTPS bilan joylashtiring.
