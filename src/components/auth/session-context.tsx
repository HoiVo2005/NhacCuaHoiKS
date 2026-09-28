"use client";

import { createContext, useContext } from "react";

import type { SessionUser } from "@/types";

interface SessionContextValue {
  user: SessionUser | null;
  isAuthenticated: boolean;
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  isAuthenticated: false,
});

/**
 * Cung cap thong tin nguoi dung cho client component.
 * Khach (chua dang nhap) van xem/nghe nhac duoc, chi cac tinh nang ca nhan moi can dang nhap.
 */
export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={{ user, isAuthenticated: Boolean(user) }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionUser(): SessionContextValue {
  return useContext(SessionContext);
}

/** Duong dan dang nhap kem tham so quay lai trang hien tai */
export function buildLoginHref(pathname: string): string {
  return `/login?callbackUrl=${encodeURIComponent(pathname)}`;
}
