import type { NextRequest } from "next/server";

import { handleApi, noContent } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/guards";

import { deleteHistoryEntry } from "@/services/history.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** DELETE /api/history/:id - xoa mot muc trong lich su */
export const DELETE = handleApi(async (_request: NextRequest, context: RouteContext) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  await deleteHistoryEntry(guard.user.id, id);

  return noContent();
});
