import type { NextRequest } from "next/server";

import { handleApi, ok } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/guards";
import { addSongToPlaylistSchema, reorderPlaylistSchema } from "@/lib/validations";

import { addSongToPlaylist, getPlaylist, reorderPlaylist } from "@/services/playlist.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST /api/playlists/:id/songs - them bai nhac vao playlist */
export const POST = handleApi(async (request: NextRequest, context: RouteContext) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const payload = await request.json();
  const { songId } = addSongToPlaylistSchema.parse(payload);

  await addSongToPlaylist(id, songId, guard.user.id, guard.user.role === "ADMIN");

  const playlist = await getPlaylist(id, {
    userId: guard.user.id,
    allowAdmin: guard.user.role === "ADMIN",
  });

  return ok(playlist);
});

/** PUT /api/playlists/:id/songs - sap xep lai thu tu bai nhac */
export const PUT = handleApi(async (request: NextRequest, context: RouteContext) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const payload = await request.json();
  const { songIds } = reorderPlaylistSchema.parse(payload);

  await reorderPlaylist(id, songIds, guard.user.id, guard.user.role === "ADMIN");

  return ok({ reordered: songIds.length });
});
