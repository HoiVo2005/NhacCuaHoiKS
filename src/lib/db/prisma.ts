import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "Thieu bien moi truong DATABASE_URL. Xem file .env.example de biet dinh dang ket noi PostgreSQL (Neon).",
    );
  }

  /*
   * Driver adapter thuan JavaScript (node-postgres) - Prisma 7 khong dung Rust engine nua.
   *
   * Voi Neon: dung chuoi ket noi co `-pooler` (PgBouncer) de nhieu request dung chung ket noi;
   * `max: 5` giu so ket noi trong gioi han cua goi mien phi. Chuoi ket noi phai co
   * `?sslmode=require` (Neon bat buoc SSL) - xem .env.example.
   */
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
