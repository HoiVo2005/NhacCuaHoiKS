import type { NextRequest } from "next/server";

import { getClientKey } from "@/lib/api/request";
import { handleApi, ok, tooManyRequests } from "@/lib/api/response";
import { getActiveSessionUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { durationSchema } from "@/lib/validations";

import { syncDuration } from "@/services/song.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/songs/:id/duration
 * Trinh phat bao cao thoi luong thuc te; chi cap nhat khi DB chua co du lieu.
 * Cho phep ca khach (khong phai du lieu ca nhan) nhung co gioi han tan suat.
 */
export const POST = handleApi(async (request: NextRequest, context: RouteContext) => {
  const user = await getActiveSessionUser();

  const limit = rateLimit(
    `duration:${user?.id ?? getClientKey(request)}`,
    60,
    60_000,
  );

  if (!limit.ok) {
    return tooManyRequests(
      `Bạn thao tác quá nhanh, vui lòng thử lại sau ${limit.retryAfterSeconds} giây.`,
    );
  }

  const { id } = await context.params;
  const payload = await request.json();
  const { durationSeconds } = durationSchema.parse(payload);

  const updated = await syncDuration(id, durationSeconds);
  return ok({ updated, durationSeconds });
});
