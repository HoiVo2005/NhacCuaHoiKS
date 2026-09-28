import type { NextRequest } from "next/server";

import { handleApi, ok } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/guards";
import { bulkIdsSchema } from "@/lib/validations";

import { deleteHistoryEntries } from "@/services/history.service";

/** POST /api/history/bulk - xoa nhieu muc trong lich su nghe cua chinh nguoi dung */
export const POST = handleApi(async (request: NextRequest) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const payload = await request.json();
  const { ids } = bulkIdsSchema.parse(payload);

  const affected = await deleteHistoryEntries(guard.user.id, ids);

  return ok({ affected });
});
