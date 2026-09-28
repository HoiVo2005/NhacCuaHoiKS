import type { NextRequest } from "next/server";

import { handleApi, noContent } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/guards";

import { removeSongFromPlaylist } from "@/services/playlist.service";

interface RouteContext {
  params: Promise<{ id: string; songId: string }>;
}

/** DELETE /api/playlists/:id/songs/:songId - xoa bai nhac khoi playlist */
export const DELETE = handleApi(async (_request: NextRequest, context: RouteContext) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const { id, songId } = await context.params;
  await removeSongFromPlaylist(id, songId, guard.user.id, guard.user.role === "ADMIN");

  return noContent();
});
