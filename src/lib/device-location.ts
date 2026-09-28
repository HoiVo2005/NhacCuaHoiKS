/**
 * Tra cứu vị trí (thành phố / quốc gia) từ địa chỉ IP.
 *
 * Dùng API công khai không cần khoá (`ipapi.co`). Quy tắc an toàn:
 *  - IP nội bộ (localhost/LAN) thì bỏ qua, không gọi mạng.
 *  - Có thời gian chờ ngắn: mạng lỗi thì coi như “không xác định được”, KHÔNG làm hỏng trang.
 *  - Nhớ tạm theo IP trong 6 giờ để không gọi lại liên tục.
 */
import { isPrivateIp } from "./device";

const LOOKUP_ENDPOINT = "https://ipapi.co";
const LOOKUP_TIMEOUT_MS = 2500;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const cache = new Map<string, { location: string | null; expiresAt: number }>();

/** Chuẩn hoá dữ liệu trả về thành “Hà Nội, Việt Nam” (hàm thuần nên kiểm chứng được) */
export function formatLocation(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const data = payload as Record<string, unknown>;
  if (data.error === true) return null;

  const pick = (key: string): string | null => {
    const value = data[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  };

  const parts = [pick("city") ?? pick("region"), pick("country_name") ?? pick("country_code")].filter(
    (part): part is string => Boolean(part),
  );

  if (parts.length === 0) return null;

  return Array.from(new Set(parts)).join(", ").slice(0, 160);
}

/** Trả về “Hà Nội, Việt Nam” hoặc null nếu không tra được */
export async function lookupIpLocation(ip: string | null | undefined): Promise<string | null> {
  if (!ip || isPrivateIp(ip)) return null;

  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.location;

  let location: string | null = null;

  try {
    const response = await fetch(`${LOOKUP_ENDPOINT}/${encodeURIComponent(ip)}/json/`, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      headers: { "user-agent": "NhacCuaHoiKS/1.0 (he thong noi bo)" },
      cache: "no-store",
    });

    if (response.ok) location = formatLocation(await response.json());
  } catch {
    location = null;
  }

  cache.set(ip, { location, expiresAt: Date.now() + CACHE_TTL_MS });

  return location;
}
