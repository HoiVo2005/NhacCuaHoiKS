import type { NextRequest } from "next/server";

import { handleApi, noContent, ok } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/guards";
import { updateEmployeeSchema } from "@/lib/validations";

import { deleteEmployee, updateEmployee } from "@/services/user.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** PATCH /api/employees/:id - cap nhat thong tin / vai tro / trang thai */
export const PATCH = handleApi(async (request: NextRequest, context: RouteContext) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const payload = await request.json();
  const input = updateEmployeeSchema.parse(payload);

  return ok(await updateEmployee(id, input, guard.user.id));
});

/** DELETE /api/employees/:id */
export const DELETE = handleApi(async (_request: NextRequest, context: RouteContext) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  await deleteEmployee(id, guard.user.id);

  return noContent();
});
