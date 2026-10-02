import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@prisma/client";

/** Script chan doan ket noi PostgreSQL (Neon): npx tsx scripts/db-check.ts */
async function main() {
  const url = process.env.DATABASE_URL ?? "";

  // Khong in mat khau ra man hinh/log
  console.log("DATABASE_URL:", url.replace(/:\/\/([^:@/]+):([^@]*)@/, "://$1:***@"));

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  const rows = await prisma.$queryRaw<{ db: string; login_name: string; version: string }[]>`
    SELECT current_database()::text AS db, current_user::text AS login_name, version() AS version
  `;
  console.log("CONNECTED:", { database: rows[0]?.db, login: rows[0]?.login_name });
  console.log("SERVER:", (rows[0]?.version ?? "").split(",")[0]);

  /* `pg_tables.tablename` cung la kieu `name` -> phai cast ::text (xem ghi chu o truy van tren). */
  const tables = await prisma.$queryRaw<{ name: string }[]>`
    SELECT tablename::text AS name
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  console.log(
    "TABLES:",
    tables.length > 0
      ? tables.map((table) => table.name).join(", ")
      : "(chua co bang nao - hay chay `npm run db:deploy` truoc)",
  );

  /**
   * Dem user. Khi CSDL moi tao (chua chay `npm run db:deploy`) thi bang chua ton tai -
   * day la trang thai binh thuong, khong phai loi ket noi.
   */
  let userCount: number | null = null;
  try {
    userCount = await prisma.user.count();
  } catch {
    userCount = null;
  }

  console.log(
    "USER COUNT:",
    userCount === null ? "(chua co bang `users` - hay chay `npm run db:deploy`)" : userCount,
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("DB CHECK FAILED:", error);
  process.exitCode = 1;
});
