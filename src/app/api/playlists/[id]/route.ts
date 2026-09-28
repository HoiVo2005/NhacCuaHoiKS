import type { NextRequest } from "next/server";

import { forbidden, handleApi, noContent, notFound, ok } from "@/lib/api/response";
import { getActiveSessionUser, requireApiUser } from "@/lib/auth/guards";
import { updatePlaylistSchema } from "@/lib/validations";

import { deletePlaylist, getPlaylist, updatePlaylist } from "@/services/playlist.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/playlists/:id - khach xem duoc playlist cong khai */
export const GET = handleApi(async (_request: NextRequest, context: RouteContext) => {
  const user = await getActiveSessionUser();
  const { id } = await context.params;

  const playlist = await getPlaylist(id, {
    userId: user?.id ?? "",
    allowAdmin: user?.role === "ADMIN",
  });

  if (!playlist) return notFound("Playlist không tồn tại.");
  return ok(playlist);
});

/** PATCH /api/playlists/:id */
export const PATCH = handleApi(async (request: NextRequest, context: RouteContext) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const payload = await request.json();
  const parsed = updatePlaylistSchema.parse(payload);

  // Chi quan tri vien duoc thay doi co playlist noi bo
  if (parsed.isFeatured !== undefined && guard.user.role !== "ADMIN") {
    return forbidden("Chỉ quản trị viên mới có thể đặt playlist nội bộ.");
  }

  const playlist = await updatePlaylist(id, parsed, guard.user.id, guard.user.role === "ADMIN");
  return ok(playlist);
});

/** DELETE /api/playlists/:id */
export const DELETE = handleApi(async (_request: NextRequest, context: RouteContext) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  await deletePlaylist(id, guard.user.id, guard.user.role === "ADMIN");

  return noContent();
});
