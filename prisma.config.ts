import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Cau hinh Prisma CLI (Prisma ORM 7).
 * - Schema: prisma/schema.prisma
 * - Migration: prisma/migrations
 * - Seed: prisma/seed.ts (chay bang tsx)
 *
 * Luu y Prisma 7: URL ket noi KHONG con nam trong schema.prisma ma duoc khai bao o day.
 * Bien moi truong phai duoc nap thu cong bang `import "dotenv/config"`.
 *
 * QUAN TRONG - vi sao uu tien `DIRECT_URL`:
 *   Neon tra ve 2 dia chi: chuoi `-pooler` (PgBouncer, dung cho ung dung) va chuoi TRUC TIEP.
 *   Moi lenh migrate phai lay `pg_advisory_lock`; di qua pooler thi lock de bi treo
 *   ("Error: P1002 - Timed out trying to acquire a postgres advisory lock") va co the con giu
 *   lock lai tren mot backend trong pool -> lan deploy sau cung that bai.
 *   => Dat `DIRECT_URL` (URL khong co "-pooler") trong .env de CLI di duong truc tiep;
 *      khong dat thi van dung DATABASE_URL nhu cu (xem them ghi chu trong `Dockerfile`).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL || "",
  },
});
