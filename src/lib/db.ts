import { PrismaClient } from "@prisma/client";

type Db = PrismaClient<{ omit: { course: { image: true } } }>;
const globalForPrisma = globalThis as unknown as { prisma?: Db };

// one client per server process (the pages and the Telegram bot load this module separately): fewer SQLite locks
// course pictures are large data URLs: left out of every query unless asked for (`omit: { image: false }`, Kurslar)
export const db = (globalForPrisma.prisma ??= new PrismaClient({ omit: { course: { image: true } } }));
