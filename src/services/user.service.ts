import { ServiceError } from "@/lib/api/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@/lib/validations";
import type { Role, UserDTO } from "@/types";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

export function normalizeRole(role: string | null | undefined): Role {
  return role === "ADMIN" ? "ADMIN" : "EMPLOYEE";
}

export function toUserDTO(
  user: UserRow,
  stats?: { playCount: number; playlistCount: number; favoriteCount: number },
): UserDTO {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: normalizeRole(user.role),
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    stats,
  };
}

export async function listUsers(): Promise<UserDTO[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { playlists: true, favorites: true, history: true } } },
  });

  return users.map((user) =>
    toUserDTO(user, {
      playCount: user._count.history,
      playlistCount: user._count.playlists,
      favoriteCount: user._count.favorites,
    }),
  );
}

export async function createEmployee(input: CreateEmployeeInput): Promise<UserDTO> {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    throw new ServiceError("Email này đã được sử dụng.", 409, "EMAIL_EXISTS", {
      email: "Email này đã được sử dụng",
    });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      role: input.role,
      passwordHash: await hashPassword(input.password),
      avatarUrl: input.avatarUrl ?? null,
    },
  });

  return toUserDTO(user);
}

async function assertEmailAvailable(email: string, excludeId: string): Promise<void> {
  const duplicate = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });

  if (duplicate && duplicate.id !== excludeId) {
    throw new ServiceError("Email này đã được sử dụng.", 409, "EMAIL_EXISTS", {
      email: "Email này đã được sử dụng",
    });
  }
}

/** He thong luon phai con it nhat 1 quan tri vien dang hoat dong */
async function assertAdminRemains(
  targetId: string,
  nextRole: Role,
  nextActive: boolean,
): Promise<void> {
  if (nextRole === "ADMIN" && nextActive) return;

  const activeAdmins = await prisma.user.count({
    where: { role: "ADMIN", isActive: true, id: { not: targetId } },
  });

  if (activeAdmins === 0) {
    throw new ServiceError(
      "Hệ thống phải còn ít nhất một quản trị viên đang hoạt động.",
      400,
      "LAST_ADMIN",
    );
  }
}

export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput,
  actorId: string,
): Promise<UserDTO> {
  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) {
    throw new ServiceError("Người dùng không tồn tại.", 404, "USER_NOT_FOUND");
  }

  if (input.email) {
    await assertEmailAvailable(input.email, id);
  }

  const nextRole = input.role ?? normalizeRole(current.role);
  const nextActive = input.isActive ?? current.isActive;

  if (id === actorId && (nextRole !== "ADMIN" || !nextActive)) {
    throw new ServiceError(
      "Bạn không thể tự hạ quyền hoặc khoá tài khoản của chính mình.",
      400,
      "SELF_LOCKOUT",
    );
  }

  if (normalizeRole(current.role) === "ADMIN") {
    await assertAdminRemains(id, nextRole, nextActive);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl ?? null } : {}),
    },
  });

  return toUserDTO(updated);
}

export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) {
    throw new ServiceError("Người dùng không tồn tại.", 404, "USER_NOT_FOUND");
  }

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ServiceError("Người dùng không tồn tại.", 404, "USER_NOT_FOUND");
  }

  const matches = await verifyPassword(currentPassword, user.passwordHash);
  if (!matches) {
    throw new ServiceError("Mật khẩu hiện tại không đúng.", 400, "WRONG_PASSWORD", {
      currentPassword: "Mật khẩu hiện tại không đúng",
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}

export async function updateOwnProfile(
  userId: string,
  input: { name?: string; avatarUrl?: string | null },
): Promise<UserDTO> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl ?? null } : {}),
    },
  });

  return toUserDTO(updated);
}

export async function deleteEmployee(id: string, actorId: string): Promise<void> {
  if (id === actorId) {
    throw new ServiceError("Bạn không thể xoá tài khoản của chính mình.", 400, "SELF_DELETE");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new ServiceError("Người dùng không tồn tại.", 404, "USER_NOT_FOUND");
  }

  if (normalizeRole(user.role) === "ADMIN") {
    await assertAdminRemains(id, "EMPLOYEE", false);
  }

  await prisma.user.delete({ where: { id } });
}

export async function countUsers(): Promise<{ total: number; active: number; admins: number }> {
  const [total, active, admins] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
  ]);

  return { total, active, admins };
}