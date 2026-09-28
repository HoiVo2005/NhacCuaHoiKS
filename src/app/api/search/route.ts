import type { NextRequest } from "next/server";

import { handleApi, ok } from "@/lib/api/response";
import { getActiveSessionUser } from "@/lib/auth/guards";

import { quickSearch } from "@/services/song-discovery.service";

/** GET /api/search?q=... - tim kiem nhanh bai nhac va playlist (khach xem duoc) */
export const GET = handleApi(async (request: NextRequest) => {
  const user = await getActiveSessionUser();

  const term = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  const result = await quickSearch(term, user?.id);

  return ok(result);
});
