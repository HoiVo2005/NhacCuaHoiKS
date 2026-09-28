import type { NextRequest } from "next/server";

import { badRequest, handleApi, ok } from "@/lib/api/response";
import { getCurrentDeviceId, requireApiUser } from "@/lib/auth/guards";
import { deviceCommandSchema } from "@/lib/validations";
import {
  listDevicesForUser,
  renameDevice,
  revokeDevice,
  revokeOtherDevices,
  setDeviceBlocked,
} from "@/services/device.service";

/**
 * GET  /api/me/devices  - danh sách thiết bị đang/đã đăng nhập của chính mình
 * POST /api/me/devices  - thao tác: đăng xuất 1 thiết bị / tất cả / chặn / mở chặn / đổi tên
 */
export const GET = handleApi(async () => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const deviceId = await getCurrentDeviceId();

  return ok({ devices: await listDevicesForUser(guard.user.id, deviceId) });
});

export const POST = handleApi(async (request: NextRequest) => {
  const guard = await requireApiUser();
  if (!guard.ok) return guard.response;

  const deviceId = await getCurrentDeviceId();
  const input = deviceCommandSchema.parse(await request.json());

  const actor = {
    id: guard.user.id,
    email: guard.user.email,
    role: guard.user.role,
    deviceId,
  };

  if (input.action === "revoke-others") {
    return ok(await revokeOtherDevices(guard.user.id, deviceId, actor));
  }

  if (input.action === "revoke-all") {
    return ok(await revokeOtherDevices(guard.user.id, null, actor));
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
