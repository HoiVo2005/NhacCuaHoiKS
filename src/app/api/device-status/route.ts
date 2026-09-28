import { NextResponse, type NextRequest } from "next/server";

import { handleApi } from "@/lib/api/response";
import {
  clientIpFromHeaders,
  createDeviceId,
  DEVICE_COOKIE,
  DEVICE_COOKIE_MAX_AGE,
  describeDevice,
  deviceKeyFrom,
  readCookie,
} from "@/lib/device";
import { describeDeviceAccess } from "@/services/device.service";

/**
 * GET /api/device-status?email=...
 *
 * Trang đăng nhập gọi endpoint này để:
 *  - Nhận tên máy + IP + vị trí của thiết bị đang dùng (hiển thị cho người dùng biết).
 *  - Biết thiết bị này có đang bị CHẶN không -> báo đúng lý do thay vì “sai mật khẩu”.
 *  - Đặt cookie định danh thiết bị (`nch_device`) nếu chưa có, để việc chặn còn hiệu lực
 *    cả sau khi người dùng đăng xuất.
 *
 * Là endpoint công khai (không cần đăng nhập) và chỉ trả về thông tin của CHÍNH thiết bị đang gọi.
 */
export const GET = handleApi(async (request: NextRequest) => {
  const userAgent = request.headers.get("user-agent");
  const deviceId = readCookie(request.headers.get("cookie"), DEVICE_COOKIE);
  const email = request.nextUrl.searchParams.get("email");

  const [deviceInfo, access] = await Promise.all([
    Promise.resolve(describeDevice(userAgent)),
    describeDeviceAccess(email, deviceKeyFrom(deviceId, userAgent)),
  ]);

  const response = NextResponse.json({
    ...deviceInfo,
    ipAddress: clientIpFromHeaders(request.headers),
    deviceId: deviceId ?? null,
    ...access,
  });

  if (!deviceId) {
    response.cookies.set({
      name: DEVICE_COOKIE,
      value: createDeviceId(),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
});
