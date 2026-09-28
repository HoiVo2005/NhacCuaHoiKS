"use client";

import { useSyncExternalStore } from "react";

/**
 * Ngưỡng màn hình nhỏ - trùng với breakpoint `sm` của Tailwind (640px).
 *
 * Vì sao cần hook này thay vì chỉ dùng class `sm:hidden`: hai cách trình bày (menu nhỏ neo vào nút
 * và panel rộng như "Danh sách phát") không thể cùng tồn tại trong DOM. Menu nhỏ tự đóng khi bấm ra
 * ngoài, nên nếu render cả hai rồi ẩn bằng CSS thì bản đang ẩn vẫn nghe sự kiện và sẽ đóng panel
 * đang mở của bản kia.
 */
export const MOBILE_MEDIA_QUERY = "(max-width: 639px)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};

  const query = window.matchMedia(MOBILE_MEDIA_QUERY);
  query.addEventListener("change", onChange);

  return () => query.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;

  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

/** Lúc SSR chưa biết kích thước thật -> coi như desktop (menu nhỏ, không chiếm màn hình) */
function getServerSnapshot(): boolean {
  return false;
}

/** Người dùng đang ở màn hình điện thoại? (dưới 640px) */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
