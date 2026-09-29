"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

/** Bao lâu hỏi máy chủ một lần để biết phiên còn hiệu lực (thiết bị bị thu hồi / bị chặn) */
const CHECK_INTERVAL_MS = 60_000;

/** Để người dùng kịp đọc lý do trước khi trang chuyển về `/login` */
const NOTICE_DELAY_MS = 1500;

const EXPIRED_MESSAGE = "Phiên đăng nhập đã kết thúc (thiết bị bị đăng xuất hoặc bị chặn). Vui lòng đăng nhập lại.";

/**
 * Canh phiên đăng nhập ở phía trình duyệt.
 *
 * Máy chủ không xoá được cookie phiên nằm trên máy khác, nên một máy đã bị “Đăng xuất”/“Chặn đăng nhập”
 * từ xa vẫn còn cookie trong trình duyệt của chính máy đó. Hai việc được làm ở đây:
 *
 *  1. `sessionPresent && !authenticated`: cookie phiên còn nhưng phiên đã hết hiệu lực (thiết bị bị thu
 *     hồi / bị chặn, tài khoản bị khoá, hoặc phiên cũ thiếu thông tin thiết bị) ⇒ gọi `signOut()` để dọn
 *     cookie. Không dọn thì `proxy.ts` thấy JWT còn hạn nên đá ngược từ `/login` về `/music`, người dùng
 *     không đăng nhập lại được.
 *  2. `authenticated`: tab đang mở sẵn vẫn hiển thị như đang đăng nhập, nên hỏi máy chủ định kỳ
 *     (`GET /api/me`): **401** nghĩa là thiết bị vừa bị thu hồi ⇒ báo lý do rồi đăng xuất ngay.
 */
export function SessionWatchdog({
  authenticated,
  sessionPresent,
}: {
  /** Phiên đã đối chiếu CSDL và còn hiệu lực (do layout máy chủ truyền xuống) */
  authenticated: boolean;
  /** Cookie phiên còn tồn tại (chưa cần biết còn hiệu lực hay không) */
  sessionPresent: boolean;
}) {
  const expiredRef = useRef(false);

  /* (1) Hết hiệu lực nhưng cookie còn: dọn cookie phiên */
  useEffect(() => {
    if (!sessionPresent || authenticated) return;

    expiredRef.current = true;
    toast.info(EXPIRED_MESSAGE);
    void signOut({ callbackUrl: "/login" }).catch(() => undefined);
  }, [authenticated, sessionPresent]);

  /* (2) Phiên còn hiệu lực: kiểm tra lại khi mở tab, khi quay lại tab và định kỳ mỗi phút */
  useEffect(() => {
    if (!authenticated) return;

    let cancelled = false;

    const verify = async () => {
      if (expiredRef.current) return;

      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        if (cancelled || response.ok || response.status !== 401) return;

        expiredRef.current = true;
        toast.info(EXPIRED_MESSAGE);

        /* Chờ một nhịp cho người dùng đọc thông báo rồi mới chuyển về trang đăng nhập */
        await new Promise((resolve) => window.setTimeout(resolve, NOTICE_DELAY_MS));
        await signOut({ callbackUrl: "/login" });
      } catch {
        /* Mất mạng thì bỏ qua, lần kiểm tra sau thử lại */
      }
    };

    void verify();

    const timer = window.setInterval(() => void verify(), CHECK_INTERVAL_MS);
    const onWake = () => {
      if (!document.hidden) void verify();
    };

    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [authenticated]);

  return null;
}
