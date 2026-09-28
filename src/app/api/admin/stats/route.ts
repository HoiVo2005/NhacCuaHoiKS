import { handleApi, ok } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/guards";

import { getStatsOverview } from "@/services/stats.service";

/** GET /api/admin/stats - thong ke tong quan cho dashboard */
export const GET = handleApi(async () => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  return ok(await getStatsOverview());
});
