import type { NextRequest } from "next/server";

import { handleApi, noContent, ok } from "@/lib/api/response";
import { getActiveSessionUser, requireApiAdmin } from "@/lib/auth/guards";
import { lyricsSchema } from "@/lib/validations";

import { clearSongLyrics, getSongLyrics, saveManualLyrics } from "@/services/lyrics.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/songs/:id/lyrics - loi bai hat kem moc thoi gian (karaoke).
 *
 * Doc tu cache trong CSDL; chua co thi tra cuu LRCLIB roi luu lai. Khach chua dang nhap
 * van xem duoc loi cua bai da phat hanh (giong nhu nghe nhac), bai chua phat hanh thi
 * chi quan tri vien xem duoc.
 */
export const GET = handleApi(async (request: NextRequest, context: RouteContext) => {
  const { id } = await context.params;
  const user = await getActiveSessionUser();

  /* `force`: quan tri vien muon THU tra cuu ca voi bai dang bi bo qua (LK/mix/tuyen tap) */
  const force = request.nextUrl.searchParams.get("force") === "1" && user?.role === "ADMIN";

  const lyrics = await getSongLyrics(id, { allowUnpublished: user?.role === "ADMIN", force });
  return ok(lyrics);
});

/** POST /api/songs/:id/lyrics - quan tri vien dan/sua loi bai hat */
export const POST = handleApi(async (request: NextRequest, context: RouteContext) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const payload = await request.json();
  const { lyrics } = lyricsSchema.parse(payload);

  const saved = await saveManualLyrics(id, guard.user.id, lyrics);
  return ok(saved);
});

/** DELETE /api/songs/:id/lyrics - xoa cache loi de lan sau tra cuu lai tu dau */
export const DELETE = handleApi(async (_request: NextRequest, context: RouteContext) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  await clearSongLyrics(id);

  return noContent();
});
