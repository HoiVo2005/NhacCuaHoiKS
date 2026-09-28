import type { NextRequest } from "next/server";

import { handleApi, noContent, notFound, ok } from "@/lib/api/response";
import { getActiveSessionUser, requireApiAdmin } from "@/lib/auth/guards";
import { updateSongSchema } from "@/lib/validations/song";

import { deleteSong, getSongById, updateSong } from "@/services/song.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/songs/:id - khach xem duoc (chi bai da xuat ban) */
export const GET = handleApi(async (_request: NextRequest, context: RouteContext) => {
  const user = await getActiveSessionUser();
  const { id } = await context.params;

  const song = await getSongById(id, {
    userId: user?.id,
    requirePublished: user?.role !== "ADMIN",
  });

  if (!song) return notFound("Bài nhạc không tồn tại hoặc chưa được xuất bản.");
  return ok(song);
});

/** PATCH /api/songs/:id - cap nhat thong tin bai nhac (quan tri vien) */
export const PATCH = handleApi(async (request: NextRequest, context: RouteContext) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const payload = await request.json();
  const input = updateSongSchema.parse(payload);

  const song = await updateSong(id, input, guard.user.id);
  return ok(song);
});

/** DELETE /api/songs/:id */
export const DELETE = handleApi(async (_request: NextRequest, context: RouteContext) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  await deleteSong(id);

  return noContent();
});
