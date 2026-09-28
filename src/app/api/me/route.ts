import type { NextRequest } from "next/server";

import { handleApi, ok } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/guards";
import { updateProfileSchema } from "@/lib/validations";

import { updateOwnProfile } from "@/services/user.service";

/** GET /api/me - thong tin nguoi dung hien tai */
export const GET = handleApi(async () => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  return ok(guard.user);
});

/** PATCH /api/me - cap nhat ho so ca nhan */
export const PATCH = handleApi(async (request: NextRequest) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const payload = await request.json();
  const input = updateProfileSchema.parse(payload);

  return ok(await updateOwnProfile(guard.user.id, input));
});
