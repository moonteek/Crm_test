import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// one client per server process (the pages and the Telegram bot load this module separately): fewer SQLite locks
export const db = (globalForPrisma.prisma ??= new PrismaClient());
