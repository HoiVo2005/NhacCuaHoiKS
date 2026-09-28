/**
 * Nhận diện thiết bị đăng nhập (hàm thuần, không truy vấn DB nên kiểm chứng được).
 *
 * Dùng cho tính năng “Quản lý thiết bị”: hiện **IP**, **tên máy** (suy ra từ User-Agent),
 * **vị trí** (suy ra từ IP) và cho phép đăng xuất từ xa / chặn đăng nhập theo thiết bị.
 *
 * Khoá thiết bị = sha256(cookie thiết bị + User-Agent):
 *  - Cookie `nch_device` (đặt tự động trong `proxy.ts`) giữ nguyên sau khi đăng xuất, nhờ vậy
 *    một máy đã bị CHẶN thì lần sau đăng nhập lại vẫn nhận ra và từ chối.
 *  - Ghép thêm User-Agent để hai trình duyệt khác nhau trên cùng một máy là hai thiết bị riêng.
 */
import { createHash, randomBytes } from "node:crypto";

export const DEVICE_COOKIE = "nch_device";

/** 400 ngày (giới hạn tối đa của Chrome) - để “chặn thiết bị” còn hiệu lực lâu dài */
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export interface DeviceInfo {
  /** Tên hiển thị, ví dụ “Chrome trên Windows” */
  deviceName: string;
  /** Trình duyệt nhận diện được */
  browser: string | null;
  /** Hệ điều hành / nền tảng */
  platform: string | null;
}

/** Id thiết bị ngẫu nhiên (32 ký tự hex) - ghi vào cookie */
export function createDeviceId(): string {
  return randomBytes(16).toString("hex");
}

/** Khoá thiết bị (64 ký tự hex) - ổn định cho cùng máy + cùng trình duyệt */
export function deviceKeyFrom(
  deviceId: string | null | undefined,
  userAgent: string | null | undefined,
): string {
  return createHash("sha256")
    .update(`${deviceId ?? "khong-co-cookie"}|${userAgent ?? "khong-co-ua"}`)
    .digest("hex");
}

/** Đọc một cookie từ chuỗi `Cookie:` của request (không phụ thuộc next/headers) */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.split("=");
    if (key?.trim() === name) {
      const value = rest.join("=").trim();
      return value.length > 0 ? decodeURIComponent(value) : null;
    }
  }

  return null;
}

/** Bỏ cổng / dạng `::ffff:` / ngoặc vuông của IPv6 để lưu và hiển thị gọn */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let value = raw.trim();

  /* Dạng [IPv6] hoặc [IPv6]:port */
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(value);
  if (bracketed) value = bracketed[1];

  /* IPv4 kèm cổng: 203.0.113.7:5678 */
  const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(value);
  if (withPort) value = withPort[1];

  /* IPv4 được ánh xạ trong IPv6: ::ffff:203.0.113.7 */
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped) value = mapped[1];

  value = value.trim();

  return value.length > 0 && value.length <= 60 ? value : null;
}

/** Lấy IP của khách từ header (Render/Cloudflare/Vercel đều có `x-forwarded-for`) */
export function clientIpFromHeaders(headers: {
  get(name: string): string | null;
}): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    const normalized = normalizeIp(first);
    if (normalized) return normalized;
  }

  for (const header of ["cf-connecting-ip", "true-client-ip", "x-real-ip", "x-client-ip"]) {
    const normalized = normalizeIp(headers.get(header));
    if (normalized) return normalized;
  }

  return null;
}

/** IP nội bộ (localhost/mạng LAN) thì không tra cứu vị trí và không hiển thị như IP công khai */
export function isPrivateIp(raw: string | null | undefined): boolean {
  const ip = normalizeIp(raw);
  if (!ip) return true;

  const value = ip.toLowerCase();
  if (value === "::1" || value === "localhost") return true;
  if (value.startsWith("127.") || value.startsWith("10.") || value.startsWith("192.168.")) return true;
  if (value.startsWith("169.254.")) return true;

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (v4) {
    const first = Number(v4[1]);
    const second = Number(v4[2]);
    if (first === 172 && second >= 16 && second <= 31) return true;
    if (first >= 224) return true;
  }

  // IPv6 nội bộ: fc00::/7 (ULA) và fe80::/10 (link-local)
  if (value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80")) return true;

  return false;
}

/** Nhận diện trình duyệt + hệ điều hành từ User-Agent */
export function describeDevice(userAgent: string | null | undefined): DeviceInfo {
  if (!userAgent) {
    return { deviceName: "Thiết bị không rõ", browser: null, platform: null };
  }

  const ua = userAgent;
  const browser =
    /SamsungBrowser/i.test(ua)
      ? "Samsung Internet"
      : /EdgA?|EdgiOS/i.test(ua)
        ? "Edge"
        : /OPR\/|Opera/i.test(ua)
          ? "Opera"
          : /Zalo/i.test(ua)
            ? "Zalo"
            : /FBAV|FBAN|FB_IAB/i.test(ua)
              ? "Facebook"
              : /CriOS|Chrome/i.test(ua)
                ? "Chrome"
                : /FxiOS|Firefox/i.test(ua)
                  ? "Firefox"
                  : /Safari/i.test(ua)
                    ? "Safari"
                    : null;

  const version = browser
    ? (/Version\/([\d.]+)/.exec(ua)?.[1] ??
      new RegExp(`${browser === "Edge" ? "Edg" : browser}/([\\d.]+)`, "i").exec(ua)?.[1] ??
      null)
    : null;

  const platform = /iPhone/i.test(ua)
    ? "iPhone"
    : /iPad/i.test(ua)
      ? "iPad"
      : /Android/i.test(ua)
        ? "Android"
        : /Windows/i.test(ua)
          ? "Windows"
          : /Macintosh|Mac OS X/i.test(ua)
            ? "macOS"
            : /Linux/i.test(ua)
              ? "Linux"
              : null;

  const browserLabel = browser ? (version ? `${browser} ${version.split(".")[0]}` : browser) : null;

  return {
    deviceName:
      browserLabel && platform
        ? `${browserLabel} trên ${platform}`
        : (browserLabel ?? platform ?? "Thiết bị không rõ"),
    browser: browserLabel,
    platform,
  };
}
