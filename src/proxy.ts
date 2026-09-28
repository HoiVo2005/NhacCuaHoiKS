import { NextResponse } from "next/server";

import { auth } from "@/auth";

/** Cac trang ca nhan bat buoc dang nhap (khach chi xem duoc trang nghe nhac) */
const PROTECTED_PAGES = [
  "/admin",
  "/music/favorites",
  "/music/history",
  "/music/profile",
  /* "Nhip nghe" la thong ke cua CHINH nguoi dung -> phai dang nhap moi xem duoc */
  "/music/stats",
];

function isProtectedPage(pathname: string): boolean {
  if (PROTECTED_PAGES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }
  // "/music/playlists" (playlist cua toi) can dang nhap, nhung
  // "/music/playlists/<id>" (playlist cong khai) thi khach xem duoc
  return pathname === "/music/playlists" || pathname === "/music/playlists/";
}

/** API cong khai: khach chua dang nhap van doc duoc de nghe nhac */
function isPublicApi(pathname: string, method: string): boolean {
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/api/health") return true;

  /*
   * File nhac/anh trong storage noi bo: khach cung phai doc duoc.
   * HEAD duoc cho phep nhu GET (cung la method an toan, khong doi du lieu): mot so trinh duyet/CDN
   * dung HEAD de do kich thuoc/loai file truoc khi phat -> chan HEAD se lam nhac khong tai duoc.
   */
  if (pathname.startsWith("/api/files")) return method === "GET" || method === "HEAD";

  // Cap nhat thoi luong bai nhac (metadata, khong phai du lieu ca nhan)
  if (/^\/api\/songs\/[^/]+\/duration$/.test(pathname)) return method === "POST";

  // "Mix quanh bai nay": chi doc bai da phat hanh nen khach cung tao duoc mix
  if (/^\/api\/songs\/[^/]+\/mix$/.test(pathname)) return method === "GET";

  /*
   * Loi bai hat (karaoke): chi DOC nen khach cung xem duoc nhu nghe nhac.
   * Viec dan/sua loi (POST) va xoa cache (DELETE) van phai qua guard quan tri vien.
   */
  if (/^\/api\/songs\/[^/]+\/lyrics$/.test(pathname)) return method === "GET";

  if (method !== "GET") return false;

  return (
    pathname === "/api/songs" ||
    /^\/api\/songs\/[^/]+$/.test(pathname) ||
    pathname === "/api/genres" ||
    pathname === "/api/search" ||
    pathname === "/api/playlists" ||
    /^\/api\/playlists\/[^/]+$/.test(pathname)
  );
}

/**
 * Next.js 16: file `middleware.ts` duoc doi ten thanh `proxy.ts`.
 *
 * Khach (chua dang nhap) duoc xem trang chu va nghe nhac.
 * Chi cac trang ca nhan (/music/favorites, /music/history, /music/profile,
 * /music/playlists) va khu quan tri (/admin) moi bat buoc dang nhap.
 */
export const proxy = auth((request) => {
  const { nextUrl } = request;
  const pathname = nextUrl.pathname;
  const method = request.method;
  const user = request.auth?.user;
  const isLoggedIn = Boolean(user?.id);
  const role = user?.role;

  const isLoginPage = pathname === "/login";
  const isRootPage = pathname === "/";
  const isApi = pathname.startsWith("/api/");

  // API cong khai: cho qua
  if (isApi && isPublicApi(pathname, method)) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    if (isApi) {
      return NextResponse.json(
        { error: "Bạn cần đăng nhập để thực hiện thao tác này" },
        { status: 401 },
      );
    }

    // Khach duoc xem trang dang nhap va tat ca trang cong khai
    if (isLoginPage || !isProtectedPage(pathname)) {
      return NextResponse.next();
    }

    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Da dang nhap: khong can vao lai trang dang nhap
  if (isLoginPage) {
    return NextResponse.redirect(new URL(role === "ADMIN" ? "/admin" : "/music", nextUrl));
  }

  if (isRootPage) {
    return NextResponse.redirect(new URL(role === "ADMIN" ? "/admin" : "/music", nextUrl));
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/music", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Bo qua file tinh (favicon, logo, manifest, sitemap...) de trinh duyet doc duoc
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|mp3|wav|ogg|css|js|map|json|txt|webmanifest)$).*)",
  ],
};

