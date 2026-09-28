import type { NextRequest } from "next/server";

import { handleApi, ok } from "@/lib/api/response";
import { getActiveSessionUser } from "@/lib/auth/guards";
import { MIX_DEFAULT_SIZE } from "@/lib/music/mix";

import { buildSongMix } from "@/services/mix.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/songs/:id/mix - hang cho "Mix quanh bai nay".
 *
 * Khach (chua dang nhap) van tao duoc mix vi chi doc du lieu da phat hanh;
 * neu co session thi them co `isFavorite` cho tung bai trong mix.
 */
export const GET = handleApi(async (request: NextRequest, context: RouteContext) => {
  const { id } = await context.params;
  const user = await getActiveSessionUser();

  const requested = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(requested) && requested > 0 ? requested : MIX_DEFAULT_SIZE;

  const mix = await buildSongMix(id, { userId: user?.id, limit });
  return ok(mix);
});
