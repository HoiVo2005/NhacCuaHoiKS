"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Màn hình desktop của ứng dụng — trùng breakpoint `lg` của Tailwind (1024px) */
export const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";
/** Người dùng đã bật "giảm chuyển động" ở hệ điều hành */
export const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

/** Lúc SSR chưa biết kích thước/thiết lập thật -> trả `false` (không kích hoạt hiệu ứng) */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Theo dõi một media query.
 *
 * Vì sao cần hook này thay vì chỉ ẩn bằng class CSS (`hidden lg:block`): hiệu ứng sóng nhạc chạy vòng lặp
 * `requestAnimationFrame` và đọc phổ âm thanh — những việc đó phải **tắt hẳn** khi không hiển thị, chứ
 * ẩn bằng CSS thì vẫn tốn CPU và pin (nhất là trên điện thoại).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};

      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);

      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;

    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Đang ở màn hình desktop? (từ 1024px) */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_MEDIA_QUERY);
}

/** Người dùng muốn giảm chuyển động? (hiệu ứng sẽ đứng yên) */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_MEDIA_QUERY);
}
