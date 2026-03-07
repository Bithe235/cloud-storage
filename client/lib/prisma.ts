import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Lazily initialize Prisma to avoid database connection attempts during static Next.js build analysis
export const prisma = globalForPrisma.prisma || new Proxy({} as PrismaClient, {
  get(target, prop) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = new PrismaClient();
    }
    const targetProp = (globalForPrisma.prisma as any)[prop];
    if (typeof targetProp === 'function') {
      return targetProp.bind(globalForPrisma.prisma);
    }
    return targetProp;
  }
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = globalForPrisma.prisma || (prisma as PrismaClient);
