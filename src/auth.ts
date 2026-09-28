import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import {
  clientIpFromHeaders,
  DEVICE_COOKIE,
  describeDevice,
  deviceKeyFrom,
  readCookie,
} from "@/lib/device";
import { loginSchema } from "@/lib/validations";
import { registerDeviceLogin } from "@/services/device.service";
import type { Role } from "@/types";

export function normalizeRole(value: string | null | undefined): Role {
  return value === "ADMIN" ? "ADMIN" : "EMPLOYEE";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "credentials",
      name: "Tài khoản nội bộ",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(rawCredentials, request) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) return null;
        if (!user.isActive) return null;

        const passwordMatches = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!passwordMatches) return null;

        /*
         * Nhận diện THIẾT BỊ + IP để quản lý phiên đăng nhập:
         *  - Thiết bị từng bị CHẶN thì không cho đăng nhập (quản trị viên phải mở chặn).
         *  - Ngược lại ghi nhận/cập nhật thiết bị rồi nhét id thiết bị vào phiên.
         */
        const requestHeaders = request?.headers ?? null;
        const userAgent = requestHeaders?.get("user-agent") ?? null;
        const deviceKey = deviceKeyFrom(readCookie(requestHeaders?.get("cookie"), DEVICE_COOKIE), userAgent);

        const knownDevice = await prisma.userDevice.findUnique({
          where: { userId_deviceKey: { userId: user.id, deviceKey } },
          select: { blockedAt: true },
        });

        if (knownDevice?.blockedAt) return null;

        const deviceInfo = describeDevice(userAgent);
        const deviceId = await registerDeviceLogin({
          userId: user.id,
          deviceKey,
          deviceName: deviceInfo.deviceName,
          browser: deviceInfo.browser,
          platform: deviceInfo.platform,
          userAgent,
          ipAddress: requestHeaders ? clientIpFromHeaders(requestHeaders) : null,
        });

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: normalizeRole(user.role),
          avatarUrl: user.avatarUrl,
          deviceId,
        };
      },
    }),
  ],
});
