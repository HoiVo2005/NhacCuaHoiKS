import type { NextRequest } from "next/server";

import { badRequest, handleApi, ok } from "@/lib/api/response";
import { requireApiAdmin } from "@/lib/auth/guards";
import { deviceCommandSchema } from "@/lib/validations";
import {
  listDevicesForUser,
  renameDevice,
  revokeDevice,
  revokeOtherDevices,
  setDeviceBlocked,
} from "@/services/device.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET  /api/employees/:id/devices - quản trị viên xem thiết bị của một nhân viên
 * POST /api/employees/:id/devices - đăng xuất / chặn / mở chặn / đổi tên thiết bị của nhân viên đó
 */
export const GET = handleApi(async (_request: NextRequest, context: RouteContext) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  return ok({ devices: await listDevicesForUser(id, null) });
});

export const POST = handleApi(async (request: NextRequest, context: RouteContext) => {
  const guard = await requireApiAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const input = deviceCommandSchema.parse(await request.json());

  const actor = {
    id: guard.user.id,
    email: guard.user.email,
    role: guard.user.role,
    deviceId: null,
  };

  if (input.action === "revoke-others" || input.action === "revoke-all") {
    return ok(await revokeOtherDevices(id, null, actor));
  }

  if (!input.deviceId) return badRequest("Thiếu thiết bị cần xử lý");

  if (input.action === "revoke") {
    return ok(await revokeDevice(input.deviceId, actor));
  }

  if (input.action === "rename") {
    return ok(await renameDevice(input.deviceId, input.label ?? null, actor));
  }

  return ok(
    await setDeviceBlocked(input.deviceId, input.action === "block", actor, input.reason ?? null),
  );
});
