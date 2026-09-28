import type { NextRequest } from "next/server";

import { handleApi, ok } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/guards";
import { appSettingsSchema } from "@/lib/validations";

import { getAppSettings, saveAppSettings } from "@/services/settings.service";

/** GET /api/admin/settings */
export const GET = handleApi(async () => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  return ok(await getAppSettings());
});

/** PUT /api/admin/settings */
export const PUT = handleApi(async (request: NextRequest) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const payload = await request.json();
  const input = appSettingsSchema.parse(payload);

  return ok(await saveAppSettings(input));
});
