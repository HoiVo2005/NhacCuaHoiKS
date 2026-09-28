import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Cau hinh Prisma CLI (Prisma ORM 7).
 * - Schema: prisma/schema.prisma
 * - Migration: prisma/migrations
 * - Seed: prisma/seed.ts (chay bang tsx)
 *
 * Luu y Prisma 7: URL ket noi KHONG con nam trong schema.prisma ma duoc khai bao o day.
 * Bien moi truong phai duoc nap thu cong bang `import "dotenv/config"`.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
