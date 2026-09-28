import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Cho phep thu lai MOT lan khi loi o tang ket noi.
 *
 * Ly do: Neon tu ngu sau ~5 phut khong dung. Lan request dau tien sau do co the gap loi
 * "Connection terminated unexpectedly" (ket noi cu trong pool da bi cat) trong khi ban than
 * CSDL van khoe. Neu de nguyen, health check cua Render thay 503 lien tuc se khoi dong lai
 * dich vu va nguoi dung thay trang loi. Loi that (sai cau hinh, CSDL chet) van tra 503 binh thuong.
 */
const RETRY_DELAY_MS = 300;

function isConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return /connection terminated|ECONNRESET|ETIMEDOUT|ENOTFOUND|P1001|P1017|closed the connection/i.test(
    message,
  );
}

async function queryHealth() {
  return prisma.$queryRaw<{ db: string; login_name: string }[]>`
      SELECT current_database() AS db, current_user AS login_name
    `;
}

/** GET /api/health - kiem tra ket noi he thong (dung cho Docker/Render healthcheck) */
export async function GET() {
  const startedAt = Date.now();

  try {
    let rows: Awaited<ReturnType<typeof queryHealth>>;

    try {
      rows = await queryHealth();
    } catch (error) {
      if (!isConnectionError(error)) throw error;

      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      rows = await queryHealth();
    }

    return NextResponse.json({
      status: "ok",
      database: "connected",
      databaseName: rows[0]?.db ?? null,
      databaseLogin: rows[0]?.login_name ?? null,
      /*
       * Bản đang chạy: Render cấp biến RENDER_GIT_COMMIT -> nhìn health là biết deploy nào đang sống
       * (kể cả khi deploy mới lỗi và Render vẫn giữ bản cũ).
       */
      commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? "local",
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[health] database error", error);

    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? "local",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
