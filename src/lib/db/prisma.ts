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
   * Voi Neon:
   *  - Dung chuoi ket noi co `-pooler` (PgBouncer) de nhieu request dung chung ket noi.
   *  - `idleTimeoutMillis` PHAI ngan (10s): Neon tu "ngu" sau ~5 phut khong dung va PgBouncer dong
   *    ket noi dang nam trong pool. Neu de ket noi nhan roi lau, request dau tien sau do se loi
   *    "Connection terminated unexpectedly" (da gap that tren Render: /api/health tra 503 mot lan).
   *    Dong ket noi som thi lan sau pool mo ket noi MOI -> Neon thuc day va tra loi binh thuong.
   *  - `keepAlive` giu TCP song trong luc dang co request dai.
   *  - `max: 5` nam trong han muc ket noi cua goi Neon mien phi.
   */
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
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
