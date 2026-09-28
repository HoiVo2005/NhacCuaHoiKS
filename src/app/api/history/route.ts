import type { NextRequest } from "next/server";

import { handleApi, noContent, ok } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/guards";
import { historySchema } from "@/lib/validations";

import { clearUserHistory, listUserHistory, registerPlay } from "@/services/history.service";

/** GET /api/history - lich su nghe nhac cua nguoi dung hien tai */
export const GET = handleApi(async (request: NextRequest) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

  const items = await listUserHistory(guard.user.id, take);
  return ok({ items, total: items.length });
});

/** POST /api/history - ghi nhan mot luot nghe */
export const POST = handleApi(async (request: NextRequest) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const payload = await request.json();
  const input = historySchema.parse(payload);

  await registerPlay({
    userId: guard.user.id,
    songId: input.songId,
    msPlayed: input.msPlayed,
    completed: input.completed,
    source: input.source ?? "web",
  });

  return ok({ recorded: true });
});

/** DELETE /api/history - xoa toan bo lich su cua nguoi dung hien tai */
export const DELETE = handleApi(async () => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  await clearUserHistory(guard.user.id);
  return noContent();
});
