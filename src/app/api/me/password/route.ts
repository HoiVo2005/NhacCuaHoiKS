import type { NextRequest } from "next/server";

import { handleApi, ok } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/guards";
import { changePasswordSchema } from "@/lib/validations";

import { changeOwnPassword } from "@/services/user.service";

/** POST /api/me/password - doi mat khau cua chinh minh */
export const POST = handleApi(async (request: NextRequest) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const payload = await request.json();
  const { currentPassword, newPassword } = changePasswordSchema.parse(payload);

  await changeOwnPassword(guard.user.id, currentPassword, newPassword);

  return ok({ updated: true });
});
