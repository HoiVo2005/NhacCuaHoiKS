import type { NextRequest } from "next/server";

import { handleApi, ok } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

import { mapWithFavorites, songInclude } from "@/services/song.service";

/** GET /api/favorites - danh sach bai nhac yeu thich cua nguoi dung hien tai */
export const GET = handleApi(async (request: NextRequest) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? 100);
  const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 100;

  const favorites = await prisma.favorite.findMany({
    where: { userId: guard.user.id },
    orderBy: { createdAt: "desc" },
    take,
    include: { song: { include: songInclude } },
  });

  const songs = await mapWithFavorites(
    favorites.map((favorite) => favorite.song),
    guard.user.id,
  );

  return ok({ items: songs, total: songs.length });
});
