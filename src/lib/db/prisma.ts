import { PrismaMssql } from "@prisma/adapter-mssql";

import { PrismaClient } from "@/generated/prisma/client";

import { parseSqlServerUrl } from "./connection";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "Thieu bien moi truong DATABASE_URL. Xem file .env.example de biet dinh dang ket noi SQL Server.",
    );
  }

  const mssqlConfig = parseSqlServerUrl(databaseUrl);

  // Driver adapter thuan JavaScript (node-mssql/tedious) - khong can Rust engine
  const adapter = new PrismaMssql(mssqlConfig, {
    schema: "dbo",
    onPoolError: (error) => console.error("[prisma:mssql] pool error", error),
    onConnectionError: (error) => console.error("[prisma:mssql] connection error", error),
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
