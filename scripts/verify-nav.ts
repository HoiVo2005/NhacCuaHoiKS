/**
 * Test logic menu + tieu de trang: npx tsx scripts/verify-nav.ts
 *  - ham nav (muc dang mo, tieu de header theo duong dan, nut "Sang tao" nhanh)
 *  - hanh vi bat/tat cua nut 3 gach + vi tri tai khoan/sang tao/doi giao dien
 *    tren header mobile (kiem tra tren ma nguon component)
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  createItemFor,
  findNavItem,
  isActiveNav,
  navItemsFor,
  navSectionsFor,
  pageMeta,
} from "../src/lib/nav";

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

/** Lay item menu theo href cho de kiem tra */
function item(href: string, role: "ADMIN" | "EMPLOYEE" | null) {
  const found = navItemsFor(role).find((entry) => entry.href === href);
  if (!found) throw new Error(`Khong tim thay muc menu ${href}`);
  return found;
}

// ------------------------------------------------------------- Muc menu dang mo
check("Trang chu active dung khi o /music", isActiveNav(item("/music", null), "/music"));
check(
  "Trang chu KHONG active khi o trang con",
  !isActiveNav(item("/music", null), "/music/discover"),
);
check("Kham pha active khi o /music/discover", isActiveNav(item("/music/discover", null), "/music/discover"));
check(
  "Playlist active khi o trang chi tiet",
  isActiveNav(item("/music/playlists", null), "/music/playlists/abc123"),
);
check("Tong quan admin active dung khi o /admin", isActiveNav(item("/admin", "ADMIN"), "/admin"));
check(
  "Tong quan admin KHONG active khi o trang con",
  !isActiveNav(item("/admin", "ADMIN"), "/admin/music"),
);
check(
  "Thư viện nhạc KHÔNG active khi o /admin/music/new (chi muc cu the nhat duoc to sang)",
  !isActiveNav(item("/admin/music", "ADMIN"), "/admin/music/new"),
);
check(
  "Them bai nhac active khi o /admin/music/new",
  isActiveNav(item("/admin/music/new", "ADMIN"), "/admin/music/new"),
);

// ------------------------- Chi mot muc duy nhat duoc to sang tren moi duong dan
/** Dem so muc menu dang duoc danh dau la dang mo */
function activeCount(pathname: string, role: "ADMIN" | "EMPLOYEE" | null): number {
  return navItemsFor(role).filter((entry) => isActiveNav(entry, pathname)).length;
}

/** Cac duong dan that trong khu quan tri (ke ca trang con /admin/music/new) */
const ADMIN_PATHS = [
  "/admin",
  "/admin/music",
  "/admin/music/new",
  "/admin/genres",
  "/admin/playlists",
  "/admin/employees",
  "/admin/history",
  "/admin/settings",
];

/** Cac duong dan that trong khu nghe nhac (ke ca trang chi tiet playlist) */
const EMPLOYEE_PATHS = [
  "/music",
  "/music/discover",
  "/music/favorites",
  "/music/playlists",
  "/music/playlists/abc123",
  "/music/history",
  "/music/stats",
  "/music/profile",
];

for (const path of ADMIN_PATHS) {
  check(
    `Chi 1 muc admin dang mo tai ${path}`,
    activeCount(path, "ADMIN") === 1,
    `so muc active: ${activeCount(path, "ADMIN")}`,
  );
}

for (const path of EMPLOYEE_PATHS) {
  check(
    `Chi 1 muc nhan vien dang mo tai ${path}`,
    activeCount(path, "EMPLOYEE") === 1,
    `so muc active: ${activeCount(path, "EMPLOYEE")}`,
  );
}

check(
  "Muc dang mo la muc cu the nhat va khop tieu de header",
  ADMIN_PATHS.every((path) => {
    const active = navItemsFor("ADMIN").find((entry) => isActiveNav(entry, path));
    return active !== undefined && pageMeta(path, "ADMIN").title === active.label;
  }),
);

// ------------------------------------------------------- Tieu de tren header
check("Tieu de trang chu", pageMeta("/music", null).title === "Trang chủ", pageMeta("/music", null).title);
check(
  "Tieu de trang kham pha",
  pageMeta("/music/discover", "EMPLOYEE").title === "Khám phá",
  pageMeta("/music/discover", "EMPLOYEE").title,
);
check(
  "Tieu de trang chi tiet playlist",
  pageMeta("/music/playlists/abc", null).title === "Chi tiết playlist",
  pageMeta("/music/playlists/abc", null).title,
);
check(
  "Tieu de trang ket qua tim kiem",
  pageMeta("/music/search", null).title === "Kết quả tìm kiếm",
  pageMeta("/music/search", null).title,
);
check(
  "Tieu de trang them bai nhac (admin)",
  pageMeta("/admin/music/new", "ADMIN").title === "Thêm bài nhạc",
  pageMeta("/admin/music/new", "ADMIN").title,
);
check(
  "Tieu de trang cai dat (admin)",
  pageMeta("/admin/settings", "ADMIN").title === "Cài đặt hệ thống",
  pageMeta("/admin/settings", "ADMIN").title,
);
check(
  "Moi tieu de deu co mo ta ngan",
  navItemsFor("ADMIN")
    .concat(navItemsFor(null))
    .every((entry) => entry.hint.length > 0),
);
check(
  "Duong dan la -> dung ten he thong",
  pageMeta("/khong-ton-tai", null).title.length > 0,
  pageMeta("/khong-ton-tai", null).title,
);

// ------------------------------------------------------------------ So muc menu
check(
  "Tieu de trang nhip nghe (thong ke ca nhan)",
  pageMeta("/music/stats", "EMPLOYEE").title === "Nhịp nghe",
  pageMeta("/music/stats", "EMPLOYEE").title,
);
check("Nhan vien co 7 muc menu", navItemsFor("EMPLOYEE").length === 7, String(navItemsFor("EMPLOYEE").length));
check("Quan tri co 8 muc menu", navItemsFor("ADMIN").length === 8, String(navItemsFor("ADMIN").length));
check("Khach (null) dung menu nhan vien", navItemsFor(null).length === 7);
check(
  "Tim duoc muc cha dai nhat",
  findNavItem("/music/playlists/abc", null)?.href === "/music/playlists",
  findNavItem("/music/playlists/abc", null)?.href ?? "null",
);

// ------------------------------------------------ Nut "Sang tao" nhanh tren header
check("Khach khong co nut Sang tao", createItemFor(null) === null);
check(
  "Quan tri: Sang tao -> /admin/music/new",
  createItemFor("ADMIN")?.href === "/admin/music/new",
  createItemFor("ADMIN")?.href ?? "null",
);
check(
  "Nhan vien: Sang tao -> /music/playlists",
  createItemFor("EMPLOYEE")?.href === "/music/playlists",
  createItemFor("EMPLOYEE")?.href ?? "null",
);
check(
  "Nut Sang tao luon co nhan + mo ta de doc tren header",
  [createItemFor("ADMIN"), createItemFor("EMPLOYEE")].every(
    (entry) => !!entry && entry.label.length > 0 && entry.hint.length > 0,
  ),
);
check(
  "Sang tao tro dung muc co that trong menu cua vai tro",
  navItemsFor("ADMIN").some((entry) => entry.href === createItemFor("ADMIN")?.href) &&
    navItemsFor("EMPLOYEE").some((entry) => entry.href === createItemFor("EMPLOYEE")?.href),
);

// ---------------------------------------------------- Nhom dieu huong (shelf)
const employeeSections = navSectionsFor("EMPLOYEE");
const adminSections = navSectionsFor("ADMIN");

check(
  "Menu nhan vien chia thanh 2 nhom",
  employeeSections.length === 2 &&
    employeeSections[0].label === "Nghe nhạc" &&
    employeeSections[1].label === "Thư viện của tôi",
  employeeSections.map((section) => section.label).join(" | "),
);
check(
  "Menu quan tri gom 1 nhom",
  adminSections.length === 1 && adminSections[0].label === "Quản trị",
  adminSections.map((section) => section.label).join(" | "),
);
check(
  "Chia nhom khong lam mat muc nao",
  employeeSections.reduce((total, section) => total + section.items.length, 0) ===
    navItemsFor("EMPLOYEE").length &&
    adminSections.reduce((total, section) => total + section.items.length, 0) ===
      navItemsFor("ADMIN").length,
);
check(
  "Moi muc menu deu co nhom de hien thi",
  navItemsFor("EMPLOYEE")
    .concat(navItemsFor("ADMIN"))
    .every((entry) => (entry.group ?? "").length > 0),
);
check(
  "Thu tu muc trong nhom giu nguyen nhu mang menu",
  JSON.stringify(employeeSections.flatMap((section) => section.items.map((item) => item.href))) ===
    JSON.stringify(navItemsFor("EMPLOYEE").map((item) => item.href)),
);

// ----------------------------------------- Hanh vi bat/tat cua nut 3 gach (ma nguon)
const source = readFileSync(
  path.join(process.cwd(), "src", "components", "layout", "app-sidebar.tsx"),
  "utf8",
);

check("Nut 3 gach bat/tat bang cung mot handler", source.includes("setOpen((value) => !value)"));
check("Nut co aria-expanded de biet dang mo/dong", source.includes("aria-expanded={open}"));
check("Nhan Esc de dong menu", source.includes('event.key === "Escape"'));
check(
  "Cham vao nen mo de dong menu",
  source.includes('aria-label="Đóng menu"') && source.includes("backdrop-blur-sm"),
);
check(
  "Chon muc trong menu thi dong menu",
  (source.match(/onClick=\{\(\) => setOpen\(false\)\}/g) ?? []).length >= 2,
);
check(
  "Doi trang khac khong con phu thuoc effect (menu dong ngay khi bam)",
  !/useEffect\(\(\) => \{\s*setOpen\(false\);/.test(source),
);
check("Khoa cuon nen khi menu mo", source.includes('document.body.style.overflow = "hidden"'));

// ------------------- Tai khoan + sang tao + doi giao dien nam tren header mobile
const topbarSource = readFileSync(
  path.join(process.cwd(), "src", "components", "layout", "topbar.tsx"),
  "utf8",
);
const accountSource = readFileSync(
  path.join(process.cwd(), "src", "components", "layout", "account-menu.tsx"),
  "utf8",
);

/** Vi tri ngan keo menu - moi phan tu nam truoc moc nay la thuoc header mobile */
const drawerIndex = source.indexOf('id="mobile-menu"');

check(
  "Tai khoan nam tren header mobile (khong phai trong ngan keo)",
  source.includes("<AccountMenu") && source.indexOf("<AccountMenu") < drawerIndex,
);
check(
  "Nut doi giao dien nam tren header mobile",
  source.includes("<ThemeToggle") && source.indexOf("<ThemeToggle") < drawerIndex,
);
check(
  "Nut Sang tao nam tren header mobile",
  source.includes("createItem.href") && source.indexOf("createItem.href") < drawerIndex,
);
check(
  "Ngan keo menu khong con khoi tai khoan (loi chao + dang xuat)",
  !source.includes("Đăng xuất") && (source.match(/Xin chào, \{userName\}/g) ?? []).length === 1,
);
check("Khach van co loi moi dang nhap trong menu", source.includes("Đăng nhập để lưu nhạc"));
check(
  "Menu tai khoan dung chung mot component (khong lap code voi topbar)",
  accountSource.includes('aria-label="Mở menu tài khoản"') && accountSource.includes("showName"),
);
check(
  "Menu tai khoan co ho so ca nhan + dang xuat",
  accountSource.includes("Hồ sơ cá nhân") && accountSource.includes("Đăng xuất"),
);
check(
  "Thanh tim kiem mobile gon (tai khoan/doi giao dien chi con tren desktop)",
  topbarSource.includes("hidden shrink-0 items-center gap-2 lg:flex"),
);

const failures = results.filter((line) => line.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
process.exitCode = failures.length === 0 ? 0 : 1;
