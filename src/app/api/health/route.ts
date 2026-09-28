import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/** GET /api/health - kiem tra ket noi he thong (dung cho Docker healthcheck) */
export async function GET() {
  const startedAt = Date.now();

  try {
    const rows = await prisma.$queryRaw<{ db: string; login_name: string }[]>`
      SELECT DB_NAME() AS db, SUSER_SNAME() AS login_name
    `;

    return NextResponse.json({
      status: "ok",
      database: "connected",
      databaseName: rows[0]?.db ?? null,
      databaseLogin: rows[0]?.login_name ?? null,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[health] database error", error);

    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
