import type { ComponentType } from "react";
import {
  Activity,
  BarChart3,
  Clock,
  Compass,
  FolderCog,
  Heart,
  History,
  House,
  ListMusic,
  Music4,
  PlusCircle,
  Settings,
  Tags,
  Users,
} from "lucide-react";

import { APP_NAME } from "@/lib/constants";
import type { Role } from "@/types";

export interface NavItem {
  href: string;
  label: string;
  /** Mo ta ngan - dung cho menu mobile va tieu de trang */
  hint: string;
  icon: ComponentType<{ className?: string }>;
  /**
   * Nhom hien thi trong sidebar / ngan keo mobile (theo kieu "shelf" cua cac app nhac:
   * nhom muc de nguoi dung quet nhanh thay vi mot danh sach dai).
   */
  group?: string;
}

export const EMPLOYEE_NAV: NavItem[] = [
  {
    href: "/music",
    label: "Trang chủ",
    hint: "Nghe tiếp và nhạc nổi bật",
    icon: House,
    group: "Nghe nhạc",
  },
  {
    href: "/music/discover",
    label: "Khám phá",
    hint: "Lọc theo thể loại, nguồn phát",
    icon: Compass,
    group: "Nghe nhạc",
  },
  {
    href: "/music/favorites",
    label: "Yêu thích",
    hint: "Những bài bạn đã lưu",
    icon: Heart,
    group: "Thư viện của tôi",
  },
  {
    href: "/music/playlists",
    label: "Playlist của tôi",
    hint: "Danh sách phát cá nhân",
    icon: ListMusic,
    group: "Thư viện của tôi",
  },
  {
    href: "/music/history",
    label: "Vừa nghe",
    hint: "Lịch sử nghe gần đây",
    icon: Clock,
    group: "Thư viện của tôi",
  },
  {
    href: "/music/stats",
    label: "Nhịp nghe",
    hint: "Thói quen nghe nhạc của bạn",
    icon: Activity,
    group: "Thư viện của tôi",
  },
  {
    href: "/music/profile",
    label: "Hồ sơ cá nhân",
    hint: "Tên hiển thị và mật khẩu",
    icon: Users,
    group: "Thư viện của tôi",
  },
];

export const ADMIN_NAV: NavItem[] = [
  {
    href: "/admin",
    label: "Tổng quan",
    hint: "Số liệu và biểu đồ hệ thống",
    icon: BarChart3,
    group: "Quản trị",
  },
  {
    href: "/admin/music",
    label: "Thư viện nhạc",
    hint: "Quản lý toàn bộ bài nhạc",
    icon: Music4,
    group: "Quản trị",
  },
  {
    href: "/admin/music/new",
    label: "Thêm bài nhạc",
    hint: "Dán liên kết hoặc tải file",
    icon: PlusCircle,
    group: "Quản trị",
  },
  {
    href: "/admin/genres",
    label: "Thể loại",
    hint: "Nhóm nhạc theo chủ đề",
    icon: Tags,
    group: "Quản trị",
  },
  {
    href: "/admin/playlists",
    label: "Playlist nội bộ",
    hint: "Playlist dùng chung",
    icon: FolderCog,
    group: "Quản trị",
  },
  {
    href: "/admin/employees",
    label: "Nhân viên",
    hint: "Tài khoản và phân quyền",
    icon: Users,
    group: "Quản trị",
  },
  {
    href: "/admin/history",
    label: "Lịch sử nghe",
    hint: "Lượt nghe của mọi nhân viên",
    icon: History,
    group: "Quản trị",
  },
  {
    href: "/admin/settings",
    label: "Cài đặt hệ thống",
    hint: "Tên hệ thống và giới hạn",
    icon: Settings,
    group: "Quản trị",
  },
];

export function navItemsFor(role: Role | null): NavItem[] {
  return role === "ADMIN" ? ADMIN_NAV : EMPLOYEE_NAV;
}

/**
 * Chia menu thanh cac nhom de hien thi (sidebar desktop + ngan keo mobile).
 * Thu tu nhom giu dung thu tu xuat hien trong mang menu.
 */
export function navSectionsFor(role: Role | null): { label: string; items: NavItem[] }[] {
  const sections: { label: string; items: NavItem[] }[] = [];

  for (const item of navItemsFor(role)) {
    const label = item.group ?? "";
    const existing = sections.find((section) => section.label === label);

    if (existing) existing.items.push(item);
    else sections.push({ label, items: [item] });
  }

  return sections;
}

/**
 * Muc "Sang tao" nhanh tren header mobile:
 * - ADMIN: them bai nhac vao thu vien.
 * - EMPLOYEE: tao playlist ca nhan.
 * - Khach (chua dang nhap): khong co (khong the tao du lieu) -> tra ve null.
 */
export function createItemFor(role: Role | null): NavItem | null {
  if (role === "ADMIN") {
    return {
      href: "/admin/music/new",
      label: "Thêm bài nhạc",
      hint: "Dán liên kết hoặc tải file",
      icon: PlusCircle,
    };
  }

  if (role === "EMPLOYEE") {
    return {
      href: "/music/playlists",
      label: "Tạo playlist",
      hint: "Danh sách phát cá nhân",
      icon: ListMusic,
    };
  }

  return null;
}

/** Muc menu khop voi duong dan hien tai (khop chinh xac truoc, sau do khop tien to dai nhat) */
export function findNavItem(pathname: string, role: Role | null): NavItem | null {
  const items = navItemsFor(role);

  const exact = items.find((item) => item.href === pathname);
  if (exact) return exact;

  const parents = items
    .filter((item) => pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length);

  return parents[0] ?? null;
}

/** Tat ca muc menu cua moi vai tro - dung de so sanh do cu the giua cac duong dan */
const ALL_NAV_ITEMS: NavItem[] = [...EMPLOYEE_NAV, ...ADMIN_NAV];

/**
 * Muc menu dang mo ung voi duong dan hien tai.
 *
 * Mot duong dan co the khop nhieu muc: "/admin/music/new" khop ca "/admin/music"
 * (tien to) lan "/admin/music/new" (chinh xac). Neu chi kiem tra tien to thi sidebar
 * to sang 2 muc cung luc, nen o day chi muc CU THE NHAT duoc coi la dang mo.
 */
export function isActiveNav(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;

  const isRoot = item.href === "/music" || item.href === "/admin";
  if (isRoot || !pathname.startsWith(`${item.href}/`)) return false;

  return !ALL_NAV_ITEMS.some(
    (other) =>
      other.href !== item.href &&
      other.href.length > item.href.length &&
      (pathname === other.href || pathname.startsWith(`${other.href}/`)),
  );
}

/** Tieu de + mo ta hien tren header theo trang hien tai */
export function pageMeta(pathname: string, role: Role | null): { title: string; hint: string; icon: NavItem["icon"] } {
  if (pathname.startsWith("/music/playlists/")) {
    return { title: "Chi tiết playlist", hint: "Kéo thả để sắp xếp bài nhạc", icon: ListMusic };
  }

  if (pathname.startsWith("/music/search")) {
    return { title: "Kết quả tìm kiếm", hint: "Bài nhạc, nghệ sĩ và playlist phù hợp", icon: Compass };
  }

  const item = findNavItem(pathname, role);
  if (item) return { title: item.label, hint: item.hint, icon: item.icon };

  return {
    title: APP_NAME,
    hint: role === "ADMIN" ? "Khu quản trị hệ thống" : "Thư viện nhạc nội bộ doanh nghiệp",
    icon: House,
  };
}
