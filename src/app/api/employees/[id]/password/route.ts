import type { NextRequest } from "next/server";

import { handleApi, ok } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/guards";
import { resetPasswordSchema } from "@/lib/validations";

import { resetUserPassword } from "@/services/user.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST /api/employees/:id/password - dat lai mat khau cho nhan vien */
export const POST = handleApi(async (request: NextRequest, context: RouteContext) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const payload = await request.json();
  const { password } = resetPasswordSchema.parse(payload);

  await resetUserPassword(id, password);

  return ok({ updated: true });
});
