import { ALLOWED_METADATA_HOSTS } from "@/lib/constants";
import { AdapterError } from "./types";

/**
 * Kiem tra host nam trong danh sach cho phep (chong SSRF).
 */
export function assertAllowedHost(url: URL): void {
  const hostname = url.hostname.toLowerCase();
  const allowed = ALLOWED_METADATA_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );

  if (!allowed) {
    throw new AdapterError(
      `Tên miền "${hostname}" không nằm trong danh sách được phép lấy metadata.`,
      "HOST_NOT_ALLOWED",
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new AdapterError("Chỉ hỗ trợ đường dẫn http/https.", "PROTOCOL_NOT_ALLOWED");
  }
}

export function parseHttpUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new AdapterError("Đường dẫn không hợp lệ.", "INVALID_URL");
  }

  if (!["https:", "http:"].includes(url.protocol)) {
    throw new AdapterError("Chỉ hỗ trợ đường dẫn http/https.", "PROTOCOL_NOT_ALLOWED");
  }

  return url;
}

interface SafeFetchOptions {
  timeoutMs?: number;
  accept?: string;
  hostAllowlist?: string[];
}

/**
 * Nhieu nen tang (SoundCloud, TikTok) chan request co User-Agent la.
 * Dung User-Agent tuong tu trinh duyet cho cac request metadata cong khai.
 */
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function assertFinalHostAllowed(response: Response, hostAllowlist?: string[]): void {
  if (!hostAllowlist || hostAllowlist.length === 0) return;

  const finalHost = new URL(response.url).hostname.toLowerCase();
  const ok = hostAllowlist.some((host) => finalHost === host || finalHost.endsWith(`.${host}`));

  if (!ok) {
    throw new AdapterError(
      "Máy chủ trả về chuyển hướng tới tên miền không được phép.",
      "HOST_NOT_ALLOWED",
    );
  }
}

async function safeFetch(
  target: string,
  options: SafeFetchOptions & { accept: string },
): Promise<Response> {
  const { timeoutMs = 8000, accept, hostAllowlist } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target, {
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
      headers: {
        accept,
        "accept-language": "vi,en;q=0.9",
        "user-agent": BROWSER_USER_AGENT,
      },
    });

    assertFinalHostAllowed(response, hostAllowlist);

    if (!response.ok) {
      throw new AdapterError(
        `Nền tảng trả về lỗi ${response.status} ${response.statusText}.`,
        "UPSTREAM_ERROR",
      );
    }

    return response;
  } catch (error) {
    if (error instanceof AdapterError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AdapterError("Quá thời gian lấy dữ liệu từ nền tảng.", "TIMEOUT");
    }
    throw new AdapterError("Không kết nối được tới nền tảng.", "NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * fetch co gioi han thoi gian + kiem tra host sau khi redirect.
 * Tra ve JSON da parse.
 */
export async function fetchJsonSafely<T = unknown>(
  target: string,
  options: SafeFetchOptions = {},
): Promise<T> {
  const response = await safeFetch(target, {
    ...options,
    accept: options.accept ?? "application/json",
  });

  return (await response.json()) as T;
}

/** Nhu fetchJsonSafely nhung tra ve HTML (dung cho the meta Open Graph) */
export async function fetchTextSafely(
  target: string,
  options: SafeFetchOptions = {},
): Promise<string> {
  const response = await safeFetch(target, {
    ...options,
    accept: options.accept ?? "text/html,application/xhtml+xml",
  });

  return response.text();
}

/** Gioi han do dai chuoi truoc khi luu DB */
export function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/** Doi ISO 8601 duration (PT1H2M3S) sang giay */
export function parseIsoDurationToSeconds(iso: string | null | undefined): number {
  if (!iso) return 0;
  const match = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!match) return 0;

  const [, days, hours, minutes, seconds] = match;
  return (
    Number(days ?? 0) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Math.round(Number(seconds ?? 0))
  );
}
