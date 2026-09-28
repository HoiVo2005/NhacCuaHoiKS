import type { NextRequest } from "next/server";

import { created, handleApi, ok } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/guards";
import { createEmployeeSchema } from "@/lib/validations";

import { createEmployee, listUsers } from "@/services/user.service";

/** GET /api/employees - danh sach nhan vien (quan tri vien) */
export const GET = handleApi(async () => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const items = await listUsers();
  return ok({ items, total: items.length });
});

/** POST /api/employees - tao tai khoan nhan vien */
export const POST = handleApi(async (request: NextRequest) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const payload = await request.json();
  const input = createEmployeeSchema.parse(payload);

  return created(await createEmployee(input));
});
