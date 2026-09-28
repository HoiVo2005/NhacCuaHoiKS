"use client";

import { usePathname, useRouter } from "next/navigation";
import { Compass, LayoutDashboard, LogOut, UserCircle2 } from "lucide-react";
import { signOut } from "next-auth/react";

import { Dropdown, DropdownItem, DropdownLabel } from "@/components/ui/dropdown";
import { initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";

/**
 * Menu tai khoan dung chung cho header mobile va topbar desktop.
 *
 * - `showName = true` (mac dinh, desktop): avatar + ten + vai tro tren mot chip pill.
 * - `showName = false` (header mobile): chi con avatar 32px cho gon, khong chiem cho.
 *
 * Noi dung menu: ho so ca nhan, chuyen nhanh giua khu quan tri <-> khu nghe nhac (ADMIN)
 * va dang xuat. Nho vay menu 3 gach (mobile) khong con phan tai khoan lap lai.
 */
export function AccountMenu({
  user,
  showName = true,
  className,
}: {
  user: SessionUser;
  showName?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isAdminArea = pathname.startsWith("/admin");
  const roleLabel = user.role === "ADMIN" ? "Quản trị viên" : "Nhân viên";

  return (
    <Dropdown
      className="min-w-56"
      trigger={
        <button
          type="button"
          aria-label="Mở menu tài khoản"
          title="Tài khoản"
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-surface/60 p-0.5 transition hover:border-primary/40 hover:bg-surface-hover",
            showName && "sm:py-1 sm:pl-1 sm:pr-2.5",
            className,
          )}
        >
          <span
            className={cn(
              "bg-gradient-brand flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white",
              showName && "sm:size-7",
            )}
          >
            {initialsOf(user.name)}
          </span>

          {showName ? (
            <span className="hidden text-left sm:block">
              <span className="block max-w-32 truncate text-xs font-medium leading-tight">
                {user.name}
              </span>
              <span className="block text-[10px] text-muted-foreground">{roleLabel}</span>
            </span>
          ) : null}
        </button>
      }
    >
      <DropdownLabel>
        {roleLabel} · {user.email}
      </DropdownLabel>

      <DropdownItem onSelect={() => router.push("/music/profile")}>
        <UserCircle2 className="size-4" /> Hồ sơ cá nhân
      </DropdownItem>

      {user.role === "ADMIN" ? (
        <DropdownItem onSelect={() => router.push(isAdminArea ? "/music" : "/admin")}>
          {isAdminArea ? (
            <Compass className="size-4" />
          ) : (
            <LayoutDashboard className="size-4" />
          )}
          {isAdminArea ? "Mở giao diện nghe nhạc" : "Trang quản trị"}
        </DropdownItem>
      ) : null}

      <DropdownItem destructive onSelect={() => void signOut({ callbackUrl: "/login" })}>
        <LogOut className="size-4" /> Đăng xuất
      </DropdownItem>
    </Dropdown>
  );
}
