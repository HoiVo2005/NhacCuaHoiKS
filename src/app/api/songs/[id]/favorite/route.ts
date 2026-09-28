import type { NextRequest } from "next/server";

import { handleApi, notFound, ok } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/guards";

import { getSongById } from "@/services/song.service";
import { toggleFavorite } from "@/services/favorite.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST /api/songs/:id/favorite - bat/tat yeu thich */
export const POST = handleApi(async (_request: NextRequest, context: RouteContext) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  const song = await getSongById(id, { userId: guard.user.id });
  if (!song) return notFound("Bài nhạc không tồn tại.");

  const isFavorite = await toggleFavorite(guard.user.id, id);
  return ok({ isFavorite });
});
