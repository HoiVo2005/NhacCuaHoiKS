import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";

import { auth } from "@/auth";
import { forbidden, unauthorized } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { clientIpFromHeaders } from "@/lib/device";
import { getDeviceState, touchDevice } from "@/services/device.service";
import type { Role, SessionUser } from "@/types";

interface SessionContext {
  user: SessionUser;
  /** Id thiết bị trong bảng `user_devices`; null với phiên cũ (trước khi có tính năng) */
  deviceId: string | null;
}

/**
 * Giải mã phiên MỘT lần cho mỗi request (layout + trang + API đều dùng chung `cache()`).
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
      name: session.user.name ?? "Người dùng",
      role: (session.user.role as Role) ?? "EMPLOYEE",
      avatarUrl: session.user.avatarUrl ?? null,
    },
    deviceId: session.user.deviceId ?? null,
  };
});

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const context = await getSessionContext();
  return context?.user ?? null;
});

/** Thiết bị của phiên đang dùng (để đánh dấu “Thiết bị này” trong trang quản lý thiết bị) */
export const getCurrentDeviceId = cache(async (): Promise<string | null> => {
  const context = await getSessionContext();
  return context?.deviceId ?? null;
});

/**
 * Lấy người dùng hiện tại và xác thực lại với DB:
 *  - Tài khoản bị khoá thì mất hiệu lực ngay.
 *  - THIẾT BỊ bị đăng xuất từ xa (`revokedAt`) hoặc bị CHẶN (`blockedAt`) cũng bị coi như hết phiên.
 *  - Phiên cũ (chưa có thông tin thiết bị) phải đăng nhập lại một lần để được quản lý.
 */
export async function getActiveSessionUser(): Promise<SessionUser | null> {
  const context = await getSessionContext();
  if (!context || !context.deviceId) return null;

  const [record, deviceState, requestHeaders] = await Promise.all([
    prisma.user.findUnique({
      where: { id: context.user.id },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, isActive: true },
    }),
    getDeviceState(context.deviceId, context.user.id),
    headers(),
  ]);

  if (!record || !record.isActive) return null;
  if (deviceState !== "active") return null;

  /* Ghi nhận “hoạt động gần nhất” + IP (tối đa 5 phút một lần, xem device.service) */
  await touchDevice(context.deviceId, clientIpFromHeaders(requestHeaders));

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role === "ADMIN" ? "ADMIN" : "EMPLOYEE",
    avatarUrl: record.avatarUrl,
  };
}

/* ------------------------------- Server pages ------------------------------ */

export async function requireUserPage(): Promise<SessionUser> {
  /* Dùng bản có xác thực DB: thiết bị đã bị đăng xuất/chặn thì không xem được trang */
  const user = await getActiveSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdminPage(): Promise<SessionUser> {
  const user = await requireUserPage();
  if (user.role !== "ADMIN") redirect("/music");
  return user;
}

/* --------------------------------- API ------------------------------------ */

type GuardResult<T> = { ok: true; user: T } | { ok: false; response: NextResponse };

export async function requireApiUser(): Promise<GuardResult<SessionUser>> {
  const user = await getActiveSessionUser();
  if (!user) {
    return { ok: false, response: unauthorized() };
  }
  return { ok: true, user };
}

export async function requireApiAdmin(): Promise<GuardResult<SessionUser>> {
  const user = await getActiveSessionUser();
  if (!user) {
    return { ok: false, response: unauthorized() };
  }
  if (user.role !== "ADMIN") {
    return { ok: false, response: forbidden("Chỉ quản trị viên mới có quyền thực hiện thao tác này") };
  }
  return { ok: true, user };
}
