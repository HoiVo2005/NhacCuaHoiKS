import type { DefaultSession } from "next-auth";

import type { Role } from "@/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      avatarUrl?: string | null;
      /** Id thiết bị đang dùng trong bảng `user_devices` (dùng để quản lý phiên) */
      deviceId?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role?: Role;
    avatarUrl?: string | null;
    deviceId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    avatarUrl?: string | null;
    deviceId?: string | null;
  }
}
