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
 *
 * Đây mới chỉ là thông tin nằm trong JWT, CHƯA đối chiếu với CSDL: cookie phiên có thể vẫn còn trong
 * khi thiết bị đã bị “Đăng xuất”/“Chặn đăng nhập” từ xa hoặc tài khoản đã bị khoá. Muốn biết phiên còn
 * hiệu lực hay không thì dùng `getSessionUser()` / `getActiveSessionUser()`.
 */
const getRawSessionContext = cache(async (): Promise<SessionContext | null> => {
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

/**
 * Có cookie phiên hay không (chỉ giải mã JWT, không hỏi CSDL).
 *
 * Dùng cho `SessionWatchdog`: JWT còn nhưng phiên đã hết hiệu lực thì phải dọn cookie ngay, nếu không
 * `proxy.ts` sẽ đá ngược người dùng từ `/login` về `/music` nên họ không đăng nhập lại được.
 */
export const hasSessionToken = cache(async (): Promise<boolean> => {
  return (await getRawSessionContext()) !== null;
});

/**
 * Đối chiếu CSDL cho phiên đang dùng — hỏi **một lần cho mỗi request** (layout + trang + API dùng chung
 * `cache()`):
 *  - tài khoản còn hoạt động (`isActive`) hay đã bị khoá;
 *  - thiết bị của phiên còn hiệu lực (`getDeviceState`).
 *
 * Phiên cũ không kèm thông tin thiết bị (`deviceId === null`) coi như hết phiên: người dùng đăng nhập lại
 * một lần để được quản lý (xem README).
 */
const loadSessionRecord = cache(async () => {
  const context = await getRawSessionContext();
  if (!context || !context.deviceId) return null;

  const [record, deviceState] = await Promise.all([
    prisma.user.findUnique({
      where: { id: context.user.id },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, isActive: true },
    }),
    getDeviceState(context.deviceId, context.user.id),
  ]);

  return { context, record, deviceState };
});

/**
 * Người dùng cho GIAO DIỆN (layout, các trang công khai).
 *
 * Vì sao phải đối chiếu CSDL ngay tại đây: “Đăng xuất thiết bị” từ xa chỉ đánh dấu `revokedAt` trong
 * bảng `user_devices` — máy chủ KHÔNG xoá được cookie phiên nằm trên máy kia. Nếu chỉ giải mã JWT thì
 * máy đã bị đăng xuất từ xa vẫn thấy avatar/tên như đang đăng nhập (đúng như phản ánh “máy khác vẫn y
 * nguyên”).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const loaded = await loadSessionRecord();
  if (!loaded || !loaded.record?.isActive) return null;
  if (loaded.deviceState !== "active") return null;

  return loaded.context.user;
});

/** Thiết bị của phiên đang dùng (để đánh dấu “Thiết bị này” trong trang quản lý thiết bị) */
export const getCurrentDeviceId = cache(async (): Promise<string | null> => {
  const context = await getRawSessionContext();
  return context?.deviceId ?? null;
});

/**
 * Lấy người dùng hiện tại và xác thực lại với DB:
 *  - Tài khoản bị khoá thì mất hiệu lực ngay.
 *  - THIẾT BỊ bị đăng xuất từ xa (`revokedAt`) hoặc bị CHẶN (`blockedAt`) cũng bị coi như hết phiên.
 *  - Phiên cũ (chưa có thông tin thiết bị) phải đăng nhập lại một lần để được quản lý.
 */
export async function getActiveSessionUser(): Promise<SessionUser | null> {
  /* Dùng chung `loadSessionRecord` với `getSessionUser` nên mỗi request chỉ hỏi CSDL một lần */
  const loaded = await loadSessionRecord();
  if (!loaded) return null;

  const { context, record, deviceState } = loaded;
  if (!context.deviceId || !record || !record.isActive) return null;
  if (deviceState !== "active") return null;

  const requestHeaders = await headers();

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

/**
 * Nơi dọn cookie phiên đã hết hiệu lực rồi mới về `/login`
 * (xem `src/app/api/session/expired/route.ts`).
 */
export const SESSION_EXPIRED_PATH = "/api/session/expired";

export async function requireUserPage(): Promise<SessionUser> {
  /* Dùng bản có xác thực DB: thiết bị đã bị đăng xuất/chặn thì không xem được trang */
  const user = await getActiveSessionUser();
  if (user) return user;

  /*
   * Hết phiên nhưng JWT vẫn còn hạn (bị đăng xuất từ xa / bị chặn / tài khoản bị khoá): phải DỌN COOKIE
   * PHIÊN trước, rồi mới về trang đăng nhập.
   *
   * Nếu `redirect("/login")` thẳng thì `proxy.ts` thấy JWT còn hạn nên lại đá ngược về `/music`
   * (ADMIN: `/admin`) ⇒ vòng lặp chuyển hướng: người dùng không bao giờ tới được trang đăng nhập và
   * cũng không đăng nhập lại được (chính là cảnh “máy khác không đăng xuất được”).
   */
  redirect((await hasSessionToken()) ? SESSION_EXPIRED_PATH : "/login");
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
