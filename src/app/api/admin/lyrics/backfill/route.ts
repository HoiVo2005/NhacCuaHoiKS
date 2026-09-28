import type { NextRequest } from "next/server";

import { badRequest, handleApi, ok } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/guards";

import {
  countSongsMissingLyrics,
  listSongIdsMissingLyrics,
  warmLyricsCache,
} from "@/services/lyrics.service";

/** So bai xu ly toi da moi lan chay (client goi lap lai cho tới khi het bai chua co loi) */
const MAX_PER_RUN = 20;

/**
 * POST /api/admin/lyrics/backfill - lay loi cho cac bai chua co (quan tri vien).
 *
 * Moi lan chay toi da `MAX_PER_RUN` bai de request khong bi treo; ket qua tra ve co `remaining`
 * de giao dien biet con bao nhieu bai va goi tiep.
 */
export const POST = handleApi(async (request: NextRequest) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { limit?: unknown };
  const requested = Number(body.limit ?? MAX_PER_RUN);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(Math.round(requested), 1), MAX_PER_RUN)
    : MAX_PER_RUN;

  if (limit < 1) return badRequest("Số bài mỗi lần phải lớn hơn 0.");

  const songIds = await listSongIdsMissingLyrics(limit);
  const result = await warmLyricsCache(songIds);
  const remaining = await countSongsMissingLyrics();

  return ok({ ...result, remaining });
});
