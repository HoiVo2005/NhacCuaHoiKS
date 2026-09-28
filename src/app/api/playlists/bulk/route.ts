import type { NextRequest } from "next/server";

import { handleApi, ok } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/guards";
import { bulkPlaylistActionSchema } from "@/lib/validations";

import { deletePlaylists } from "@/services/playlist.service";

/**
 * POST /api/playlists/bulk - xoa nhieu playlist cung luc.
 * Chi xoa duoc playlist cua chinh minh (quan tri vien duoc xoa tat ca).
 */
export const POST = handleApi(async (request: NextRequest) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const payload = await request.json();
  const { ids } = bulkPlaylistActionSchema.parse(payload);

  const affected = await deletePlaylists(ids, guard.user.id, guard.user.role === "ADMIN");

  return ok({ action: "delete", affected });
});
