/**
 * Kiem tra giao dien menu mobile + header desktop tren HTML that:
 *   node scripts/ui-check.cjs      (can server dang chay)
 */
const BASE = process.env.SMOKE_BASE || "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL || "admin@mymusic.local";
const PASSWORD = process.env.SMOKE_PASSWORD || "Admin@123456";

const results = [];

function cookiesOf(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
  }
  const raw = response.headers.get("set-cookie");
  return raw ? [raw.split(";")[0]] : [];
}

function merge(jar, response) {
  const map = new Map(jar.map((cookie) => [cookie.split("=")[0], cookie]));
  for (const cookie of cookiesOf(response)) map.set(cookie.split("=")[0], cookie);
  return [...map.values()];
}

async function signIn() {
  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`);
  let jar = merge([], csrfResponse);
  const csrf = await csrfResponse.json();

  const loginResponse = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.join("; ") },
    body: new URLSearchParams({
      email: EMAIL,
      password: PASSWORD,
      csrfToken: csrf.csrfToken,
      callbackUrl: `${BASE}/`,
    }),
  });

  jar = merge(jar, loginResponse);
  return jar.join("; ");
}

function check(label, passed, detail = "") {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | ${detail}` : ""}`);
}

async function main() {
  // ------------------------------------------------- Menu mobile + header (khach)
  const guestHtml = await fetch(`${BASE}/music`).then((response) => response.text());

  const mobileChecks = [
    ["Nut 3 gach (aria-label Mo menu)", guestHtml.includes('aria-label="Mở menu"')],
    ["Trang thai dong ban dau (aria-expanded=false)", guestHtml.includes('aria-expanded="false"')],
    ["Nut lien ket ngan keo (aria-controls + id)", guestHtml.includes('aria-controls="mobile-menu"') && guestHtml.includes('id="mobile-menu"')],
    ["Ba thanh cua nut menu", guestHtml.includes("h-0.5 w-4 rounded-full bg-current")],
    ["Ngan keo render nhung dong mac dinh", guestHtml.includes("max-h-0 opacity-0") && guestHtml.includes("pointer-events-none")],
    ["Khong con dai pill o header mobile (menu nam trong 3 gach)", !guestHtml.includes("snap-x-strip")],
    ["Dang nhap hien tren thanh mobile", guestHtml.includes("Đăng nhập")],
    [
      "Thanh tim kiem mobile khong con chip tai khoan (da chuyen len header)",
      guestHtml.includes("hidden shrink-0 items-center gap-2 lg:flex"),
    ],
    [
      "Logo thuong hieu hien thi bang gradient CSS (khong bi tang hinh)",
      guestHtml.includes("bg-gradient-brand inline-flex") &&
        guestHtml.includes('aria-label="NhacCuaHoiKS"'),
    ],
    [
      "Ten thuong hieu to mau gradient",
      guestHtml.includes("text-gradient truncate text-sm font-bold"),
    ],
  ];

  for (const [label, passed] of mobileChecks) check(label, Boolean(passed));

  // ------------------------------------------------------------- Header desktop
  const headerChecks = [
    ["Tieu de trang tren header", guestHtml.includes("Trang chủ") && guestHtml.includes("Nghe tiếp và nhạc nổi bật")],
    [
      "Thanh header mobile cao dung 3rem (bang nut 3 gach, khong lech chieu cao)",
      guestHtml.includes(
        "mx-auto flex h-12 w-full max-w-screen-2xl items-center gap-1.5 px-3 sm:h-auto sm:gap-3 sm:px-5 sm:py-2.5",
      ),
    ],
    [
      "O tim kiem pill gon theo man hinh (mobile khong con 80px chet)",
      guestHtml.includes(
        "h-9 rounded-full border-border/60 bg-surface/60 pl-9 pr-9 sm:h-10 sm:pl-10 sm:pr-20",
      ),
    ],
    ["Goi y phim tat tim kiem (kbd)", guestHtml.includes("<kbd")],
    ["Icon tim kiem noi mau thuong hieu", guestHtml.includes("text-primary/70 sm:left-3.5")],
    ["O tim kiem sticky ngay duoi thanh mobile", guestHtml.includes("sticky top-12")],
    ["Bo dem mobile dung 3rem (chi 1 hang)", guestHtml.includes("pt-12 lg:pt-0")],
    ["Icon tieu de trang", guestHtml.includes("rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25")],
  ];

  for (const [label, passed] of headerChecks) check(label, Boolean(passed));

  // ----------------------------------------------------------- Trang quan tri
  const adminCookie = await signIn();
  const adminHtml = await fetch(`${BASE}/admin`, { headers: { cookie: adminCookie } }).then((response) => response.text());

  check(
    "Header admin hien dung muc menu",
    adminHtml.includes("Tổng quan") && adminHtml.includes("Số liệu và biểu đồ hệ thống"),
  );
  check(
    "Nut chuyen nhanh sang khu nghe nhac",
    adminHtml.includes("Nghe nhạc") || adminHtml.includes('href="/music"'),
  );
  check("Menu mobile co mat tren trang admin", adminHtml.includes('aria-label="Mở menu"'));
  check(
    "Header admin: avatar tai khoan nam tren header mobile",
    adminHtml.includes('aria-label="Mở menu tài khoản"'),
  );
  check(
    "Header admin: nut Sang tao -> them bai nhac",
    adminHtml.includes('aria-label="Sáng tạo: Thêm bài nhạc"') &&
      adminHtml.includes('href="/admin/music/new"'),
  );

  // ------------------------------------------ Tong quan: so lieu, bieu do va bo cuc
  const dashboardChecks = [
    [
      "Tong quan: co du 4 the so lieu",
      ["Tổng bài nhạc", "Tổng lượt nghe", "Người dùng", "Thời lượng nghe"].every((label) =>
        adminHtml.includes(label),
      ),
    ],
    [
      "Tong quan: tieu de + mo ta khong bi cat (line-clamp + truncate)",
      adminHtml.includes("mt-0.5 line-clamp-2 text-sm text-muted-foreground sm:truncate"),
    ],
    [
      "Tong quan: hai nut hanh dong full-width tren dien thoai",
      adminHtml.split("h-10 w-full justify-center sm:h-9 sm:w-auto").length - 1 >= 2,
    ],
    [
      "Tong quan: luoi so lieu 2 cot tren dien thoai",
      adminHtml.includes("grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4"),
    ],
    [
      "Tong quan: the khong bi tran ngang (min-w-0 tren the)",
      adminHtml.split("card-surface min-w-0").length - 1 >= 5,
    ],
    [
      "Tong quan: bieu do 14 ngay co gian theo khung (khong cuon ngang)",
      adminHtml.includes('preserveAspectRatio="none"') && !adminHtml.includes("min-w-[560px]"),
    ],
    [
      "Tong quan: ti le nguon phat + 3 loi tat quan tri",
      ["Tỉ lệ theo nguồn phát", "Quản lý thư viện nhạc", "Playlist nội bộ", "Lịch sử nghe toàn hệ thống"].every(
        (text) => adminHtml.includes(text),
      ),
    ],
  ];

  for (const [label, passed] of dashboardChecks) check(label, Boolean(passed));

  // --------------------------------------------- Thu vien nhac: tick chon + xoa nhanh
  const adminMusicHtml = await fetch(`${BASE}/admin/music`, {
    headers: { cookie: adminCookie },
  }).then((response) => response.text());

  check(
    "Thu vien nhac: co checkbox chon dong",
    adminMusicHtml.includes('data-slot="checkbox"'),
  );
  check(
    "Thu vien nhac: co nut chon tat ca",
    adminMusicHtml.includes("Chọn tất cả bài nhạc đang hiển thị"),
  );
  check("Thu vien nhac: co nut xoa tat ca", adminMusicHtml.includes("Xoá tất cả ("));

  // ------------------------- Muc menu dang mo: khong bao gio to sang 2 muc cung luc
  /**
   * Cac href dang duoc danh dau la muc dang mo trong HTML that.
   * React xuat thuoc tinh theo thu tu khai bao trong JSX nen aria-current dung truoc href.
   */
  const activeHrefs = (html) =>
    [...html.matchAll(/<a[^>]*aria-current="page"[^>]*href="([^"]+)"/g)].map((match) => match[1]);

  const musicPageActives = [...new Set(activeHrefs(adminMusicHtml))];

  check(
    "Thu vien nhac: chi dung muc 'Thu vien nhac' duoc to sang",
    musicPageActives.length === 1 && musicPageActives[0] === "/admin/music",
    `muc sang: ${musicPageActives.join(", ") || "khong co"}`,
  );

  const adminMusicNewHtml = await fetch(`${BASE}/admin/music/new`, {
    headers: { cookie: adminCookie },
  }).then((response) => response.text());

  const newPageActives = [...new Set(activeHrefs(adminMusicNewHtml))];

  check(
    "Them bai nhac: CHI 'Them bai nhac' sang, muc cha 'Thu vien nhac' khong sang",
    newPageActives.length === 1 && newPageActives[0] === "/admin/music/new",
    `muc sang: ${newPageActives.join(", ") || "khong co"}`,
  );

  const adminPlaylistsHtml = await fetch(`${BASE}/admin/playlists`, {
    headers: { cookie: adminCookie },
  }).then((response) => response.text());

  check(
    "Playlist noi bo: co checkbox + nut xoa tat ca",
    adminPlaylistsHtml.includes('data-slot="checkbox"') &&
      adminPlaylistsHtml.includes("Xoá tất cả"),
  );

  // ------------------------------------------------ Giao dien sang / toi
  check(
    "Mac dinh giao dien SANG (khong co class dark tren <html>)",
    !/<html[^>]*class="[^"]*dark/.test(guestHtml),
  );
  check(
    "Co nut doi giao dien sang/toi",
    guestHtml.includes('aria-label="Đổi giao diện sáng/tối"'),
  );
  check(
    "Co script chong nhay mau cua next-themes",
    guestHtml.includes("nhaccuahoiks-theme"),
  );

  // ------------------------- Trang chu (da dang nhap): lien ket "Xem tat ca"
  const memberHtml = await fetch(`${BASE}/music`, {
    headers: { cookie: adminCookie },
  }).then((response) => response.text());

  const homeChecks = [
    [
      "Header mobile (da dang nhap): avatar gon tren mobile (khong con pill thua)",
      memberHtml.includes(
        "flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-surface/60 p-0.5",
      ),
    ],
    [
      "Header mobile (da dang nhap): avatar tai khoan + doi giao dien + nut Sang tao",
      memberHtml.includes('aria-label="Mở menu tài khoản"') &&
        memberHtml.includes('aria-label="Đổi giao diện sáng/tối"') &&
        /aria-label="Sáng tạo: [^"]+"/.test(memberHtml),
    ],
    [
      "Trang chu: 'Nghe tiep' co lien ket Xem tat ca -> /music/history",
      memberHtml.includes('aria-label="Xem tất cả lịch sử nghe"') &&
        memberHtml.includes('href="/music/history"'),
    ],
    [
      "Trang chu: 'Playlist noi bat' co lien ket Xem tat ca -> /music/playlists",
      memberHtml.includes('aria-label="Xem tất cả playlist nổi bật"') &&
        memberHtml.includes('href="/music/playlists"'),
    ],
    [
      "Trang chu: 'Moi them vao thu vien' co lien ket Xem tat ca -> /music/discover",
      memberHtml.includes('aria-label="Xem tất cả bài nhạc mới"'),
    ],
    [
      "Trang chu: 'Nghe nhieu nhat' co lien ket Xem tat ca -> /music/discover?sort=plays",
      memberHtml.includes('aria-label="Xem tất cả bài nghe nhiều nhất"') &&
        memberHtml.includes('href="/music/discover?sort=plays"'),
    ],
    [
      "Trang chu: banner dem bai noi bat theo id (khong dem trung)",
      memberHtml.includes("Tổng hợp") && !memberHtml.includes("Tổng cộng"),
    ],
  ];

  for (const [label, passed] of homeChecks) check(label, Boolean(passed));

  // --------------------- Banner dem dung so bai that (khong cong don 8 + 6)
  const publishedTotal = await fetch(`${BASE}/api/songs?pageSize=1`)
    .then((response) => response.json())
    .then((payload) => payload.total);

  const heroCount = Number(
    ((memberHtml.match(/Tổng hợp ([\d.,]+) bài nhạc nổi bật/) ?? [])[1] ?? "").replace(/[.,]/g, ""),
  );

  // Chi so sanh chac chan khi thu vien <= 8 bai (moi bai deu nam trong "nhac moi")
  const heroCountOk = publishedTotal > 8 ? heroCount > 0 : heroCount === publishedTotal;

  check(
    "Trang chu: so bai noi bat tren banner khop thuc te (khong dem trung)",
    heroCountOk,
    `banner ${heroCount} | thu vien ${publishedTotal}`,
  );

  const failures = results.filter((line) => line.startsWith("FAIL"));
  console.log(results.join("\n"));
  console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error("UI CHECK FAILED:", error);
  process.exitCode = 1;
});
