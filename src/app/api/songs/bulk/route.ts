import type { NextRequest } from "next/server";

import { handleApi, ok } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/guards";
import { bulkSongActionSchema } from "@/lib/validations";

import { deleteSongs, setSongsPublished } from "@/services/song.service";

/**
 * POST /api/songs/bulk - thao tac hang loat tren thu vien nhac (ADMIN):
 * xoa nhieu bai, an hoac phat hanh nhieu bai cung luc.
 */
export const POST = handleApi(async (request: NextRequest) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const payload = await request.json();
  const { action, ids } = bulkSongActionSchema.parse(payload);

  const affected =
    action === "delete"
      ? await deleteSongs(ids)
      : await setSongsPublished(ids, action === "publish");

  return ok({ action, affected });
});
