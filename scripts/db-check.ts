import "dotenv/config";

import { PrismaMssql } from "@prisma/adapter-mssql";

import { PrismaClient } from "../src/generated/prisma/client";
import { parseSqlServerUrl } from "../src/lib/db/connection";

/** Script chan doan ket noi SQL Server: npx tsx scripts/db-check.ts */
async function main() {
  const url = process.env.DATABASE_URL ?? "";
  console.log("DATABASE_URL:", url);

  const config = parseSqlServerUrl(url);
  console.log(
    "PARSED:",
    JSON.stringify({ ...config, password: "***" }, null, 2),
  );

  const prisma = new PrismaClient({
    adapter: new PrismaMssql(config, { schema: "dbo" }),
  });

  const rows = await prisma.$queryRaw<{ db: string; login_name: string }[]>`
    SELECT DB_NAME() AS db, SUSER_SNAME() AS login_name
  `;
  console.log("CONNECTED:", rows);

  const tables = await prisma.$queryRaw<{ name: string }[]>`
    SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_NAME
  `;
  console.log(
    "TABLES:",
    tables.map((table) => table.name).join(", "),
  );

  console.log("USER COUNT:", await prisma.user.count());

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("DB CHECK FAILED:", error);
  process.exitCode = 1;
});
