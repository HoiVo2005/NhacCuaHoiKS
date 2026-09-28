import type { NextAuthConfig } from "next-auth";

import type { Role } from "@/types";

/**
 * Cookie bao mat chi bat khi chay tren HTTPS. Voi mang noi bo dung HTTP
 * (vi du http://localhost:3000 hoac http://may-chu-noi-bo),
 * cookie __Secure- se bi trinh duyet tu choi -> phai tat.
 */
const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const useSecureCookies = process.env.AUTH_USE_SECURE_COOKIES
  ? process.env.AUTH_USE_SECURE_COOKIES === "true"
  : authUrl.startsWith("https://");

/**
 * Cau hinh Auth.js dung chung cho ca proxy (Node runtime) va server.
 * KHONG import Prisma o day de co the tai su dung o moi noi.
 */
export const authConfig = {
  trustHost: true,
  useSecureCookies,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 ngay
    updateAge: 60 * 60 * 24,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user.role as Role) ?? "EMPLOYEE";
        token.avatarUrl = user.avatarUrl ?? null;
        /* Thiết bị của phiên này (bảng `user_devices`) - xem `src/services/device.service.ts` */
        token.deviceId = user.deviceId ?? null;
      }

      // Cho phep cap nhat lai ten/avatar trong token khi nguoi dung doi ho so
      if (trigger === "update" && session?.user) {
        if (session.user.name) token.name = session.user.name;
        if (session.user.avatarUrl !== undefined) token.avatarUrl = session.user.avatarUrl;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        session.user.role = (token.role as Role) ?? "EMPLOYEE";
        session.user.avatarUrl = (token.avatarUrl as string | null) ?? null;
        session.user.deviceId = (token.deviceId as string | null) ?? null;
        if (token.name) session.user.name = token.name;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
