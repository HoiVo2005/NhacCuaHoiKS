"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Quan ly giao dien sang / toi.
 * Mac dinh la SANG; lua chon cua nguoi dung duoc luu trong localStorage va
 * duoc ap dung truoc khi ve trang (khong bi nhay mau).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      storageKey="nhaccuahoiks-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
