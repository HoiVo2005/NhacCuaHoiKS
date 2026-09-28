import type { NextRequest } from "next/server";

import { created, forbidden, handleApi, ok } from "@/lib/api/response";
import { getActiveSessionUser, requireApiUser } from "@/lib/auth/guards";
import { playlistSchema } from "@/lib/validations";

import { createPlaylist, listPlaylistsForUser } from "@/services/playlist.service";
import { getAppSettings } from "@/services/settings.service";

/** GET /api/playlists - playlist cong khai + playlist cua toi (khach xem duoc) */
export const GET = handleApi(async () => {
  const user = await getActiveSessionUser();

  const items = await listPlaylistsForUser(user?.id);
  return ok({ items, total: items.length });
});

/** POST /api/playlists - tao playlist ca nhan */
export const POST = handleApi(async (request: NextRequest) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const settings = await getAppSettings();
  if (!settings.allowEmployeePlaylists && guard.user.role !== "ADMIN") {
    return forbidden("Quản trị viên đã tắt tính năng tạo playlist cho nhân viên.");
  }

  const payload = await request.json();
  const input = playlistSchema.parse(payload);

  return created(
    await createPlaylist(
      guard.user.role === "ADMIN" ? input : { ...input, isFeatured: false },
      guard.user.id,
    ),
  );
});
