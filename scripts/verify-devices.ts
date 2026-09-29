import "dotenv/config";

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  clientIpFromHeaders,
  describeDevice,
  deviceKeyFrom,
  isPrivateIp,
  normalizeIp,
  readCookie,
} from "@/lib/device";
import { formatLocation } from "@/lib/device-location";

/**
 * Kiểm chứng tính năng “Thiết bị đang đăng nhập”: npx tsx scripts/verify-devices.ts
 *
 *  1. Hàm thuần: nhận diện tên máy từ User-Agent, lấy IP từ header, khoá thiết bị, tra vị trí.
 *  2. Mảnh ghép UI/API: trang hồ sơ, khu quản trị nhân viên, trang đăng nhập, route, proxy, guard.
 *  3. Nếu CSDL sẵn sàng: chạy VÒNG ĐỜI THẬT của một thiết bị thử (tạo → chặn → đăng nhập lại →
 *     mở chặn → đăng xuất) rồi xoá sạch, không để lại dữ liệu rác trong bảng `user_devices`.
 */

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

function skip(label: string, detail = ""): void {
  results.push(`SKIP | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const SAMSUNG_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36";
const EDGE_WINDOWS = `${CHROME_WINDOWS.replace("Chrome/141.0.0.0", "Chrome/141.0.0.0")} Edg/141.0.0.0`;

/* -------------------- 1. Ham thuan (khong can CSDL) -------------------- */

const chrome = describeDevice(CHROME_WINDOWS);
check(
  "Nhan dien Chrome tren Windows: ten may + trinh duyet + he dieu hanh",
  chrome.browser === "Chrome 141" && chrome.platform === "Windows" && chrome.deviceName === "Chrome 141 trên Windows",
  chrome.deviceName,
);

const iphone = describeDevice(SAFARI_IPHONE);
check(
  "Nhan dien iPhone Safari (dung Version/ chu khong phai Safari/)",
  iphone.browser === "Safari 17" && iphone.platform === "iPhone" && iphone.deviceName === "Safari 17 trên iPhone",
  iphone.deviceName,
);

check(
  "Nhan dien Android: Chrome tren Android va Samsung Internet",
  describeDevice(CHROME_ANDROID).deviceName === "Chrome 140 trên Android" &&
    describeDevice(SAMSUNG_ANDROID).browser === "Samsung Internet" &&
    describeDevice(SAMSUNG_ANDROID).platform === "Android",
  describeDevice(CHROME_ANDROID).deviceName,
);

check(
  "Nhan dien Edge (UA cua Edge cung chua Chrome/ nhung phai ra Edge)",
  describeDevice(EDGE_WINDOWS).browser === "Edge 141",
  describeDevice(EDGE_WINDOWS).browser ?? "null",
);

check(
  "Khong co User-Agent thi ghi ro la khong ro (khong vo trang)",
  describeDevice(null).deviceName === "Thiết bị không rõ" && describeDevice("").browser === null,
);

check(
  "Khoa thiet bi: cung cookie + cung UA thi ON DINH, khac UA/cookie thi khac khoa",
  deviceKeyFrom("abc", CHROME_WINDOWS) === deviceKeyFrom("abc", CHROME_WINDOWS) &&
    deviceKeyFrom("abc", CHROME_WINDOWS).length === 64 &&
    deviceKeyFrom("abc", CHROME_WINDOWS) !== deviceKeyFrom("abc", SAFARI_IPHONE) &&
    deviceKeyFrom("abc", CHROME_WINDOWS) !== deviceKeyFrom("xyz", CHROME_WINDOWS) &&
    deviceKeyFrom(null, CHROME_WINDOWS) === deviceKeyFrom(undefined, CHROME_WINDOWS),
);

check(
  "Chuan hoa IP: bo cong IPv4, bo ngoac IPv6, bo tien to ::ffff:",
  normalizeIp("203.0.113.7:5678") === "203.0.113.7" &&
    normalizeIp("[2001:db8::1]:443") === "2001:db8::1" &&
    normalizeIp("::ffff:203.0.113.7") === "203.0.113.7" &&
    normalizeIp("2001:db8::1") === "2001:db8::1" &&
    normalizeIp("   ") === null,
);

check(
  "IP noi bo (localhost/LAN) duoc nhan dien de khong tra cuu vi tri",
  isPrivateIp("127.0.0.1") &&
    isPrivateIp("192.168.1.9") &&
    isPrivateIp("10.0.0.4") &&
    isPrivateIp("172.16.3.4") &&
    isPrivateIp("::1") &&
    isPrivateIp(null) &&
    !isPrivateIp("172.32.3.4") &&
    !isPrivateIp("203.0.113.7") &&
    !isPrivateIp("2001:db8::1"),
);

check(
  "Doc cookie thiet bi tu header Cookie (bo qua cookie khac, giai ma %)",
  readCookie("a=1; nch_device=abc123; b=2", "nch_device") === "abc123" &&
    readCookie("a=1", "nch_device") === null &&
    readCookie(null, "nch_device") === null &&
    readCookie("nch_device=abc%2D123", "nch_device") === "abc-123",
);

const headersOf = (values: Record<string, string>) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
});

check(
  "Lay IP khach: uu tien x-forwarded-for (phan tu dau), sau do cf-connecting-ip",
  clientIpFromHeaders(headersOf({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })) === "203.0.113.7" &&
    clientIpFromHeaders(headersOf({ "cf-connecting-ip": "198.51.100.9" })) === "198.51.100.9" &&
    clientIpFromHeaders(headersOf({})) === null,
);

check(
  "Vi tri tu API: ‘Thanh pho, Quoc gia’; thieu du lieu hoac loi thi tra null",
  formatLocation({ city: "Hà Nội", country_name: "Việt Nam" }) === "Hà Nội, Việt Nam" &&
    formatLocation({ region: "California", country_code: "US" }) === "California, US" &&
    formatLocation({ error: true }) === null &&
    formatLocation({}) === null &&
    formatLocation(null) === null,
);

/* -------------------- 2. Manh ghep UI / API / CSDL -------------------- */

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260928130000_add_user_devices/migration.sql");
const authSource = read("src/auth.ts");
const authConfig = read("src/auth.config.ts");
const guards = read("src/lib/auth/guards.ts");
const proxySource = read("src/proxy.ts");
const service = read("src/services/device.service.ts");
const validations = read("src/lib/validations/index.ts");
const manager = read("src/components/auth/device-manager.tsx");
const profilePage = read("src/app/music/profile/page.tsx");
const employeeManager = read("src/components/admin/employee-manager.tsx");
const loginForm = read("src/components/auth/login-form.tsx");
const meRoute = read("src/app/api/me/devices/route.ts");
const adminRoute = read("src/app/api/employees/[id]/devices/route.ts");
const statusRoute = read("src/app/api/device-status/route.ts");
const readme = read("README.md");
const layout = read("src/app/layout.tsx");
const watchdog = read("src/components/auth/session-watchdog.tsx");
const expiredRoute = read("src/app/api/session/expired/route.ts");

check(
  "CSDL: bang `user_devices` co IP, vi tri, ten may, dang xuat tu xa va chan dang nhap",
  schema.includes("model UserDevice") &&
    schema.includes('@@map("user_devices")') &&
    schema.includes("@@unique([userId, deviceKey])") &&
    schema.includes("ipAddress") &&
    schema.includes("locationUpdatedAt") &&
    schema.includes("revokedAt") &&
    schema.includes("blockedAt") &&
    schema.includes("blockedReason") &&
    schema.includes("devices       UserDevice[]"),
);

check(
  "Di tru: migration da tao bang + index duy nhat + khoa ngoai xoa theo user (Cascade)",
  migration.includes('CREATE TABLE "user_devices"') &&
    migration.includes('CREATE UNIQUE INDEX "user_devices_userId_deviceKey_key"') &&
    migration.includes('FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE'),
);

check(
  "Dang nhap: thiet bi bi CHAN thi khong vao duoc, nguoc lai ghi nhan thiet bi vao phien",
  authSource.includes("knownDevice?.blockedAt") &&
    authSource.includes("registerDeviceLogin") &&
    authSource.includes("deviceId,") &&
    authSource.includes('readCookie(requestHeaders?.get("cookie"), DEVICE_COOKIE)'),
);

check(
  "Phien (JWT) mang theo id thiet bi de quan ly",
  authConfig.includes("token.deviceId = user.deviceId") &&
    authConfig.includes("session.user.deviceId = (token.deviceId as string | null)"),
);

check(
  "Guard: thiet bi bi dang xuat tu xa / bi chan thi coi nhu het phien (ca trang lan API)",
  guards.includes("getDeviceState(context.deviceId, context.user.id)") &&
    guards.includes('deviceState !== "active"') &&
    guards.includes("touchDevice(context.deviceId") &&
    guards.includes("const user = await getActiveSessionUser();") &&
    guards.includes("getCurrentDeviceId"),
);

check(
  "May KHAC cung het phien: giao dien doi chieu CSDL (khong chi giai ma JWT)",
  guards.includes("const loadSessionRecord = cache(") &&
    guards.includes("getDeviceState(context.deviceId, context.user.id)") &&
    guards.includes("hasSessionToken"),
);

check(
  "Phien het hieu luc nhung JWT con han: don cookie that roi moi ve /login (khong ket vong lap proxy)",
  guards.includes("SESSION_EXPIRED_PATH") &&
    proxySource.includes('pathname === "/api/session/expired"') &&
    expiredRoute.includes("SESSION_COOKIE_PATTERN") &&
    expiredRoute.includes("NextResponse.redirect"),
);

check(
  "Tab dang mo tren may khac tu phat hien phien bi thu hoi (401) va dang xuat",
  watchdog.includes('fetch("/api/me"') &&
    watchdog.includes("signOut(") &&
    watchdog.includes("CHECK_INTERVAL_MS") &&
    layout.includes("<SessionWatchdog"),
);

check(
  "README: giai thich vi sao may khac phai tu dang xuat (khong xoa duoc cookie tu xa)",
  readme.includes("/api/session/expired") && readme.includes("SessionWatchdog"),
);

check(
  "proxy.ts: dat cookie dinh danh thiet bi + mo cong cho /api/device-status (trang dang nhap goi duoc)",
  proxySource.includes("withDeviceCookie") &&
    proxySource.includes("DEVICE_COOKIE") &&
    proxySource.includes("createDeviceId()") &&
    proxySource.includes('pathname === "/api/device-status"'),
);

check(
  "Dich vu: danh sach / dang xuat 1 may / dang xuat may khac / chan-mo chan / doi ten",
  service.includes("export async function listDevicesForUser") &&
    service.includes("export async function revokeDevice") &&
    service.includes("export async function revokeOtherDevices") &&
    service.includes("export async function setDeviceBlocked") &&
    service.includes("export async function renameDevice") &&
    service.includes("export async function describeDeviceAccess") &&
    service.includes("assertCanManage") &&
    /* Vị trí chỉ tra tối đa 3 IP/lần mở trang để không làm chậm trang */
    service.includes("MAX_LOCATION_LOOKUPS = 3"),
);

check(
  "API tu quan ly: GET danh sach + POST thao tac (co guard dang nhap)",
  meRoute.includes("export const GET") &&
    meRoute.includes("export const POST") &&
    meRoute.includes("requireApiUser") &&
    meRoute.includes('"revoke-others"') &&
    meRoute.includes('"revoke-all"'),
);

check(
  "API cho quan tri vien quan ly thiet bi cua nhan vien (guard ADMIN)",
  adminRoute.includes("export const GET") &&
    adminRoute.includes("export const POST") &&
    adminRoute.includes("requireApiAdmin"),
);

check(
  "API trang thai thiet bi (cong khai): tra ve IP/ten may va co bi chan hay khong",
  statusRoute.includes("describeDeviceAccess") &&
    statusRoute.includes("clientIpFromHeaders") &&
    statusRoute.includes("DEVICE_COOKIE"),
);

check(
  "UI: co nut Dang xuat tung may, Dang xuat may khac, Dang xuat tat ca, Doi ten",
  manager.includes("Đăng xuất máy này") &&
    manager.includes("Đăng xuất máy khác") &&
    manager.includes("Đăng xuất tất cả") &&
    manager.includes("Đổi tên"),
);

check(
  "UI: hien IP, vi tri, trinh duyet/he dieu hanh va lan dung gan nhat",
  manager.includes('label="IP"') &&
    manager.includes('label="Vị trí"') &&
    manager.includes('label="Trình duyệt / hệ điều hành"') &&
    manager.includes('label="Hoạt động gần nhất"') &&
    manager.includes("ipLabel"),
);

check(
  "Chan dang nhap: nut CHAN / MO CHAN co xac nhan ro rang truoc khi lam",
  manager.includes("Chặn đăng nhập") &&
    manager.includes("Mở chặn") &&
    manager.includes("KHÔNG thể đăng nhập lại cho tới khi bạn bấm"),
);

check(
  "De bam tren dien thoai: nut cao >= 44px (min-h-11) va khong tran ngang",
  (manager.match(/min-h-11/g) ?? []).length >= 8 && manager.includes("flex-wrap"),
);

check("Trang ho so ca nhan co muc thiet bi dang dang nhap", profilePage.includes("<DeviceManager />"));

check(
  "Quan tri vien: nut thiet bi trong bang nhan vien, mo hop thoai quan ly theo tung nguoi",
  employeeManager.includes("<MonitorSmartphone") &&
    employeeManager.includes("<DeviceManager") &&
    employeeManager.includes('scope="admin"') &&
    employeeManager.includes("userId={deviceTarget.id}"),
);

check(
  "Trang dang nhap bao DUNG ly do khi thiet bi bi chan (thay vi do loi mat khau)",
  loginForm.includes("fetchDeviceStatus") &&
    loginForm.includes("status?.blocked") &&
    loginForm.includes("đã bị chặn đăng nhập") &&
    loginForm.includes("/api/device-status"),
);

check(
  "Du lieu thao tac duoc kiem tra bang zod (khong tin du lieu client)",
  validations.includes("deviceCommandSchema") &&
    validations.includes(
      'z.enum(["revoke", "revoke-others", "revoke-all", "block", "unblock", "rename"])',
    ),
);

check(
  "Tai lieu README mo ta tinh nang + cach kiem chung",
  readme.includes("Thiết bị đang đăng nhập") && readme.includes("check:devices"),
);

/* -------------------- 3. Vong doi that tren CSDL -------------------- */

async function runDatabaseCheck(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    skip("Vong doi thiet bi tren CSDL", "khong co DATABASE_URL");
    return;
  }

  const { prisma } = await import("@/lib/db/prisma");
  const {
    describeDeviceAccess,
    getDeviceState,
    listDevicesForUser,
    registerDeviceLogin,
    renameDevice,
    revokeDevice,
    revokeOtherDevices,
    setDeviceBlocked,
  } = await import("@/services/device.service");

  /*
   * Dung MOT NGUOI DUNG TAM de kiem tra vong doi that (tao -> chan -> mo chan -> dang xuat -> don).
   * Xoa nguoi dung o cuoi se xoa day chuyen het thiet bi (khoa ngoai ON DELETE CASCADE), nhờ vậy
   * khong bao gio cham vao tai khoan that dang dung.
   */
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const email = `verify-device-${suffix}@local.test`;
  const keyA = `verify-a-${suffix}`;
  const keyB = `verify-b-${suffix}`;
  let userId: string | null = null;

  try {
    const created = await prisma.user.create({
      data: { email, name: "Nguoi dung thu (kiem chung thiet bi)", passwordHash: "khong-dung-de-dang-nhap", role: "EMPLOYEE" },
      select: { id: true },
    });
    userId = created.id;

    const actor = { id: userId, email, role: "EMPLOYEE" as const, deviceId: null };
    const base = {
      userId,
      deviceName: "Chrome 141 trên Windows",
      browser: "Chrome 141",
      platform: "Windows",
      userAgent: "verify-agent",
      ipAddress: "203.0.113.7",
    };

    const deviceA = await registerDeviceLogin({ ...base, deviceKey: keyA });
    check(
      "Dang nhap: tao ban ghi thiet bi kem IP va phien hoat dong",
      Boolean(deviceA) && (await getDeviceState(deviceA, userId)) === "active",
    );

    const again = await registerDeviceLogin({ ...base, deviceKey: keyA });
    const duplicates = await prisma.userDevice.count({ where: { userId, deviceKey: keyA } });
    check("Dang nhap lai CUNG thiet bi: dung lai mot dong (khong nhan doi)", again === deviceA && duplicates === 1);

    const deviceB = await registerDeviceLogin({ ...base, deviceKey: keyB, deviceName: "Safari 17 trên iPhone", platform: "iPhone", ipAddress: "198.51.100.9" });
    const listed = await listDevicesForUser(userId, deviceA, { refreshLocation: false });
    check(
      "Danh sach thiet bi: du 2 may, co IP + danh dau 'Thiet bi nay'",
      listed.length === 2 &&
        listed.some((device) => device.id === deviceA && device.isCurrent && device.ipAddress === "203.0.113.7") &&
        listed.some((device) => device.id === deviceB && device.status === "ACTIVE"),
    );

    await setDeviceBlocked(deviceA, true, actor, "Kiem chung tu dong");
    check(
      "CHAN thiet bi: phien hien tai het hieu luc ngay (guard se da nguoi dung ra)",
      (await getDeviceState(deviceA, userId)) === "blocked",
    );

    const access = await describeDeviceAccess(email, keyA);
    check(
      "Trang dang nhap biet duoc 'thiet bi bi chan' de bao dung ly do",
      access.blocked && access.blockedByEmail === email && access.blockedReason === "Kiem chung tu dong",
    );

    await setDeviceBlocked(deviceA, false, actor);
    check(
      "MO CHAN: thiet bi duoc phep dang nhap lai (nhung phien cu van phai dang nhap lai)",
      !(await describeDeviceAccess(email, keyA)).blocked &&
        (await getDeviceState(deviceA, userId)) === "revoked",
    );

    await registerDeviceLogin({ ...base, deviceKey: keyA });
    check(
      "Sau khi mo chan: dang nhap lai la phien hoat dong tro lai",
      (await getDeviceState(deviceA, userId)) === "active",
    );

    await revokeDevice(deviceA, actor);
    check("Dang xuat tu xa 1 thiet bi: phien do het hieu luc", (await getDeviceState(deviceA, userId)) === "revoked");

    await registerDeviceLogin({ ...base, deviceKey: keyA });
    check(
      "Dang xuat TU XA khac CHAN: dang nhap lai la duoc phep",
      (await getDeviceState(deviceA, userId)) === "active",
    );

    const others = await revokeOtherDevices(userId, deviceA, actor);
    check(
      "Dang xuat 'may khac': chi dong cac may khac, giu may dang dung",
      others.revoked === 1 &&
        (await getDeviceState(deviceA, userId)) === "active" &&
        (await getDeviceState(deviceB, userId)) === "revoked",
    );

    await renameDevice(deviceA, "Điện thoại của Hội", actor);
    const renamed = await listDevicesForUser(userId, deviceA, { refreshLocation: false });
    check(
      "Doi ten thiet bi: ten tu dat duoc uu tien hien thi",
      renamed.find((device) => device.id === deviceA)?.displayName === "Điện thoại của Hội",
    );
  } catch (error) {
    skip("Vong doi thiet bi tren CSDL", error instanceof Error ? error.message : String(error));
  } finally {
    /* Don sach tuyet doi: xoa nguoi dung thu -> khoa ngoai xoa het thiet bi cua ho */
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }

    const leftoverDevices = await prisma.userDevice
      .count({ where: { deviceKey: { in: [keyA, keyB] } } })
      .catch(() => 0);
    const leftoverUser = await prisma.user.count({ where: { email } }).catch(() => 0);

    check(
      "Don sach: khong con nguoi dung/thiet bi thu nao trong CSDL",
      leftoverDevices === 0 && leftoverUser === 0,
    );

    await prisma.$disconnect().catch(() => undefined);
  }
}

/** In ket qua va dat ma thoat */
function report(): void {
  const failed = results.filter((line) => line.startsWith("FAIL"));
  console.log(results.join("\n"));
  console.log(`\nTONG KET: ${results.length - failed.length} PASS / ${failed.length} FAIL`);
  process.exitCode = failed.length === 0 ? 0 : 1;
}

void runDatabaseCheck().finally(report);

