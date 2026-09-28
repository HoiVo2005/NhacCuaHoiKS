/**
 * Quản lý thiết bị đăng nhập của người dùng.
 *
 *  - `registerDeviceLogin` gọi trong `authorize()` khi đăng nhập thành công: ghi nhận IP,
 *    tên máy, vị trí và trả về id thiết bị để nhét vào JWT.
 *  - `getDeviceState` / `touchDevice` gọi trong guard mỗi request: phát hiện thiết bị đã bị
 *    đăng xuất từ xa (`revokedAt`) hoặc bị chặn (`blockedAt`) để vô hiệu hoá phiên.
 *  - `listDevices` / `revokeDevice` / `setDeviceBlocked` cho trang “Quản lý thiết bị”.
 */
import { ServiceError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { isPrivateIp } from "@/lib/device";
import { lookupIpLocation } from "@/lib/device-location";
import type { DeviceDTO, Role } from "@/types";

/** Chỉ cập nhật “hoạt động gần nhất” tối đa 5 phút một lần cho mỗi thiết bị */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/** Không thử lại việc tra cứu vị trí trong 7 ngày (kể cả khi thất bại) */
const LOCATION_RETRY_MS = 7 * 24 * 60 * 60 * 1000;

/** Mỗi lần mở trang chỉ tra cứu tối đa 3 IP để trang không bị chậm */
const MAX_LOCATION_LOOKUPS = 3;

export interface RegisterDeviceInput {
  userId: string;
  deviceKey: string;
  deviceName: string;
  browser: string | null;
  platform: string | null;
  userAgent: string | null;
  ipAddress: string | null;
}

function ipLabel(ip: string | null): string {
  if (!ip) return "Không xác định";
  return isPrivateIp(ip) ? `Mạng nội bộ (${ip})` : ip;
}

function toDeviceDTO(
  row: {
    id: string;
    label: string | null;
    deviceName: string;
    browser: string | null;
    platform: string | null;
    ipAddress: string | null;
    location: string | null;
    firstLoginAt: Date;
    lastSeenAt: Date;
    revokedAt: Date | null;
    revokedByEmail: string | null;
    blockedAt: Date | null;
    blockedByEmail: string | null;
    blockedReason: string | null;
  },
  currentDeviceId: string | null,
): DeviceDTO {
  return {
    id: row.id,
    label: row.label,
    deviceName: row.deviceName,
    displayName: row.label?.trim() || row.deviceName,
    browser: row.browser,
    platform: row.platform,
    ipAddress: row.ipAddress,
    ipLabel: ipLabel(row.ipAddress),
    location: row.location,
    firstLoginAt: row.firstLoginAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    isCurrent: currentDeviceId !== null && row.id === currentDeviceId,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    revokedByEmail: row.revokedByEmail,
    blockedAt: row.blockedAt?.toISOString() ?? null,
    blockedByEmail: row.blockedByEmail,
    blockedReason: row.blockedReason,
    status: row.blockedAt ? "BLOCKED" : row.revokedAt ? "REVOKED" : "ACTIVE",
  };
}

/**
 * Ghi nhận thiết bị vừa đăng nhập (tạo mới hoặc cập nhật thiết bị đã biết).
 * KHÔNG xoá `blockedAt` — thiết bị bị chặn thì `authorize()` đã chặn từ trước.
 */
export async function registerDeviceLogin(input: RegisterDeviceInput): Promise<string> {
  const existing = await prisma.userDevice.findUnique({
    where: { userId_deviceKey: { userId: input.userId, deviceKey: input.deviceKey } },
    select: { id: true, ipAddress: true },
  });

  const now = new Date();
  const ipChanged = Boolean(existing && existing.ipAddress !== input.ipAddress);

  if (existing) {
    const updated = await prisma.userDevice.update({
      where: { id: existing.id },
      data: {
        deviceName: input.deviceName,
        browser: input.browser,
        platform: input.platform,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        lastSeenAt: now,
        /* Đăng nhập lại = phiên mới còn hiệu lực (nhưng vẫn giữ nguyên cờ CHẶN) */
        revokedAt: null,
        revokedByEmail: null,
        /* Đổi IP thì xoá vị trí cũ để lần mở trang sau tra cứu lại */
        ...(ipChanged ? { location: null, locationUpdatedAt: null } : {}),
      },
      select: { id: true },
    });

    return updated.id;
  }

  const created = await prisma.userDevice.create({
    data: {
      userId: input.userId,
      deviceKey: input.deviceKey,
      deviceName: input.deviceName,
      browser: input.browser,
      platform: input.platform,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      firstLoginAt: now,
      lastSeenAt: now,
    },
    select: { id: true },
  });

  return created.id;
}

/** Trạng thái thiết bị của phiên đang dùng */
export type DeviceState = "active" | "revoked" | "blocked" | "missing";

export async function getDeviceState(
  deviceId: string | null | undefined,
  userId: string,
): Promise<DeviceState> {
  if (!deviceId) return "missing";

  const row = await prisma.userDevice.findFirst({
    where: { id: deviceId, userId },
    select: { revokedAt: true, blockedAt: true },
  });

  if (!row) return "missing";
  if (row.blockedAt) return "blocked";
  if (row.revokedAt) return "revoked";

  return "active";
}

/* ------------------------------ Trang quản lý ------------------------------ */

interface ActorInfo {
  id: string;
  email: string;
  role: Role;
  /** Thiết bị đang dùng của người thao tác (để đánh dấu “Thiết bị này”) */
  deviceId?: string | null;
}

interface LocationRow {
  id: string;
  ipAddress: string | null;
  location: string | null;
  locationUpdatedAt: Date | null;
}

/**
 * Tra cứu bù vị trí cho các thiết bị chưa biết / đã cũ.
 * Chỉ chạy tối đa `MAX_LOCATION_LOOKUPS` IP mỗi lần mở trang, chạy song song nên không chậm.
 */
async function refreshLocations(rows: LocationRow[]): Promise<void> {
  const now = Date.now();

  const targets = rows
    .filter((row) => {
      if (!row.ipAddress || isPrivateIp(row.ipAddress)) return false;
      if (!row.locationUpdatedAt) return true;
      return now - row.locationUpdatedAt.getTime() > LOCATION_RETRY_MS;
    })
    .slice(0, MAX_LOCATION_LOOKUPS);

  await Promise.all(
    targets.map(async (row) => {
      const location = await lookupIpLocation(row.ipAddress);

      await prisma.userDevice
        .update({ where: { id: row.id }, data: { location, locationUpdatedAt: new Date() } })
        .catch(() => undefined);

      row.location = location;
    }),
  );
}

function assertCanManage(actor: ActorInfo, deviceUserId: string): void {
  if (actor.role === "ADMIN" || actor.id === deviceUserId) return;

  throw new ServiceError(
    "Bạn chỉ quản lý được thiết bị của chính mình",
    403,
    "DEVICE_FORBIDDEN",
  );
}

/** Danh sách thiết bị của một người dùng (kèm tra cứu bù vị trí) */
export async function listDevicesForUser(
  userId: string,
  currentDeviceId: string | null,
  options?: { refreshLocation?: boolean },
): Promise<DeviceDTO[]> {
  const rows = await prisma.userDevice.findMany({
    where: { userId },
    orderBy: [{ lastSeenAt: "desc" }, { firstLoginAt: "desc" }],
  });

  if (options?.refreshLocation !== false) {
    await refreshLocations(rows);
  }

  return rows.map((row) => toDeviceDTO(row, currentDeviceId));
}

async function loadDevice(deviceId: string) {
  const row = await prisma.userDevice.findUnique({ where: { id: deviceId } });

  if (!row) {
    throw new ServiceError("Không tìm thấy thiết bị này", 404, "DEVICE_NOT_FOUND");
  }

  return row;
}

/** Đăng xuất từ xa một thiết bị (thiết bị đó phải đăng nhập lại) */
export async function revokeDevice(deviceId: string, actor: ActorInfo): Promise<DeviceDTO> {
  const device = await loadDevice(deviceId);
  assertCanManage(actor, device.userId);

  const updated = await prisma.userDevice.update({
    where: { id: deviceId },
    data: { revokedAt: new Date(), revokedByEmail: actor.email },
  });

  return toDeviceDTO(updated, actor.deviceId ?? null);
}

/** Chặn / mở chặn đăng nhập của một thiết bị */
export async function setDeviceBlocked(
  deviceId: string,
  blocked: boolean,
  actor: ActorInfo,
  reason?: string | null,
): Promise<DeviceDTO> {
  const device = await loadDevice(deviceId);
  assertCanManage(actor, device.userId);

  const updated = await prisma.userDevice.update({
    where: { id: deviceId },
    data: blocked
      ? {
          blockedAt: new Date(),
          blockedByEmail: actor.email,
          blockedReason: reason?.trim() ? reason.trim().slice(0, 300) : null,
          /* Chặn = cắt phiên đang chạy luôn */
          revokedAt: new Date(),
          revokedByEmail: actor.email,
        }
      : { blockedAt: null, blockedByEmail: null, blockedReason: null },
  });

  return toDeviceDTO(updated, actor.deviceId ?? null);
}

/** Đổi tên gợi nhớ cho thiết bị (ví dụ “Điện thoại của Hội”) */
export async function renameDevice(
  deviceId: string,
  label: string | null,
  actor: ActorInfo,
): Promise<DeviceDTO> {
  const device = await loadDevice(deviceId);
  assertCanManage(actor, device.userId);

  const updated = await prisma.userDevice.update({
    where: { id: deviceId },
    data: { label: label?.trim() ? label.trim().slice(0, 100) : null },
  });

  return toDeviceDTO(updated, actor.deviceId ?? null);
}

/**
 * Đăng xuất mọi thiết bị (trừ thiết bị đang dùng nếu có `keepDeviceId`).
 * Trả về số thiết bị đã bị đăng xuất.
 */
export async function revokeOtherDevices(
  userId: string,
  keepDeviceId: string | null,
  actor: ActorInfo,
): Promise<{ revoked: number }> {
  assertCanManage(actor, userId);

  const result = await prisma.userDevice.updateMany({
    where: {
      userId,
      ...(keepDeviceId ? { NOT: { id: keepDeviceId } } : {}),
    },
    data: { revokedAt: new Date(), revokedByEmail: actor.email },
  });

  return { revoked: result.count };
}

/**
 * Thông tin thiết bị đang dùng (cho trang đăng nhập): có bị chặn hay không.
 * Không trả về dữ liệu gì khác để không lộ thông tin khi chưa đăng nhập.
 */
export async function describeDeviceAccess(
  email: string | null,
  deviceKey: string,
): Promise<{ blocked: boolean; blockedAt: string | null; blockedReason: string | null; blockedByEmail: string | null }> {
  if (!email) {
    return { blocked: false, blockedAt: null, blockedReason: null, blockedByEmail: null };
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
  if (!user) {
    return { blocked: false, blockedAt: null, blockedReason: null, blockedByEmail: null };
  }

  const device = await prisma.userDevice.findUnique({
    where: { userId_deviceKey: { userId: user.id, deviceKey } },
    select: { blockedAt: true, blockedReason: true, blockedByEmail: true },
  });

  if (!device?.blockedAt) {
    return { blocked: false, blockedAt: null, blockedReason: null, blockedByEmail: null };
  }

  return {
    blocked: true,
    blockedAt: device.blockedAt.toISOString(),
    blockedReason: device.blockedReason,
    blockedByEmail: device.blockedByEmail,
  };
}

/** Cập nhật “hoạt động gần nhất” + IP (tối đa 5 phút/lần) */
export async function touchDevice(deviceId: string, ipAddress: string | null): Promise<void> {
  const now = new Date();

  try {
    if (ipAddress) {
      await prisma.userDevice.updateMany({
        where: { id: deviceId, NOT: { ipAddress } },
        data: { ipAddress, location: null, locationUpdatedAt: null },
      });
    }

    await prisma.userDevice.updateMany({
      where: { id: deviceId, lastSeenAt: { lt: new Date(now.getTime() - TOUCH_INTERVAL_MS) } },
      data: { lastSeenAt: now },
    });
  } catch {
    /* Không cập nhật được thì bỏ qua - không được làm hỏng request của người dùng */
  }
}
