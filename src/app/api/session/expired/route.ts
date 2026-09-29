import { NextResponse, type NextRequest } from "next/server";

import { authConfig } from "@/auth.config";
import { handleApi } from "@/lib/api/response";

/**
 * Tên cookie phiên của Auth.js: `authjs.session-token` (mạng nội bộ, HTTP) hoặc
 * `__Secure-authjs.session-token` (HTTPS). Phiên dài còn bị chia thành `....0`, `....1` nên phải khớp
 * theo phần tên chứ không so sánh cả chuỗi.
 */
const SESSION_COOKIE_PATTERN = /authjs\.session-token/;

/**
 * GET /api/session/expired
 *
 * Dọn cookie phiên đã HẾT HIỆU LỰC ở máy đang dùng rồi mới đưa về trang đăng nhập.
 *
 * Vì sao cần endpoint này: “Đăng xuất thiết bị” từ xa chỉ đánh dấu `revokedAt` trong CSDL — máy chủ
 * không xoá được cookie phiên nằm trên máy của người khác. Nếu `requireUserPage()` chỉ
 * `redirect("/login")` thì `proxy.ts` vẫn thấy JWT còn hạn nên lại đá ngược về `/music`
 * (ADMIN: `/admin`) ⇒ vòng lặp chuyển hướng, người dùng không bao giờ tới được trang đăng nhập và cũng
 * không đăng nhập lại được. Xoá cookie thật rồi mới chuyển trang nên hết vòng lặp.
 *
 * Là endpoint công khai (xem `isPublicApi` trong `proxy.ts`), không trả về dữ liệu gì.
 */
export const GET = handleApi(async (request: NextRequest) => {
  const response = NextResponse.redirect(new URL("/login", request.nextUrl.origin));

  for (const { name } of request.cookies.getAll()) {
    if (!SESSION_COOKIE_PATTERN.test(name)) continue;

    response.cookies.set({
      name,
      value: "",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: "lax",
      secure: Boolean(authConfig.useSecureCookies),
    });
  }

  return response;
});
