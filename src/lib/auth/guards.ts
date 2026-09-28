import { cache } from "react";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";

import { auth } from "@/auth";
import { forbidden, unauthorized } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import type { Role, SessionUser } from "@/types";

/**
 * Lay thong tin nguoi dung tu session (khong truy van DB).
 *
 * Cache theo request: layout goc + layout tung khu + trang deu goi ham nay,
 * nho cache() ma chi giai ma session MOT lan cho moi request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "Người dùng",
    role: (session.user.role as Role) ?? "EMPLOYEE",
    avatarUrl: session.user.avatarUrl ?? null,
  };
});

/**
 * Lay nguoi dung hien tai va xac thuc lai voi DB
 * (tai khoan bi khoa se khong the thao tac du session con hieu luc)
 */
export async function getActiveSessionUser(): Promise<SessionUser | null> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const record = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, email: true, name: true, role: true, avatarUrl: true, isActive: true },
  });

  if (!record || !record.isActive) return null;

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role === "ADMIN" ? "ADMIN" : "EMPLOYEE",
    avatarUrl: record.avatarUrl,
  };
}

/* ------------------------------- Server pages ------------------------------ */

export async function requireUserPage(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdminPage(): Promise<SessionUser> {
  const user = await requireUserPage();
  if (user.role !== "ADMIN") redirect("/music");
  return user;
}

/* --------------------------------- API ------------------------------------ */

type GuardResult<T> = { ok: true; user: T } | { ok: false; response: NextResponse };

export async function requireApiUser(): Promise<GuardResult<SessionUser>> {
  const user = await getActiveSessionUser();
  if (!user) {
    return { ok: false, response: unauthorized() };
  }
  return { ok: true, user };
}

export async function requireApiAdmin(): Promise<GuardResult<SessionUser>> {
  const user = await getActiveSessionUser();
  if (!user) {
    return { ok: false, response: unauthorized() };
  }
  if (user.role !== "ADMIN") {
    return { ok: false, response: forbidden("Chỉ quản trị viên mới có quyền thực hiện thao tác này") };
  }
  return { ok: true, user };
}
