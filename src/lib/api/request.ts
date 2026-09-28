import type { NextRequest } from "next/server";

/** Khoa gioi han tan suat theo IP (dung cho khach chua dang nhap) */
export function getClientKey(request: NextRequest, fallback = "guest"): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "";

  return ip ? `ip:${ip}` : fallback;
}
