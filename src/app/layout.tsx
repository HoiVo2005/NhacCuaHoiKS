import type { Metadata, Viewport } from "next";

import { SessionProvider } from "@/components/auth/session-context";
import { SessionWatchdog } from "@/components/auth/session-watchdog";
import { ThemeProvider } from "@/components/theme-provider";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { FullPlayer } from "@/components/player/full-player";
import { MediaSessionBridge } from "@/components/player/media-session-bridge";
import { PlayerBar } from "@/components/player/player-bar";
import { PlayerEngine } from "@/components/player/player-engine";
import { PlayerShortcuts } from "@/components/player/player-shortcuts";
import { QueuePanel } from "@/components/player/queue-panel";
import { ResumeTracker } from "@/components/player/resume-tracker";
import { Toaster } from "@/components/ui/toaster";
import { getSessionUser, hasSessionToken } from "@/lib/auth/guards";
import { APP_NAME } from "@/lib/constants";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} - Thư viện nhạc nội bộ`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "NhacCuaHoiKS - hệ thống nghe nhạc nội bộ dành cho doanh nghiệp: thư viện nhạc tập trung, playlist, yêu thích và lịch sử nghe.",
  applicationName: APP_NAME,
  /*
   * Web app khi "Them vao man hinh chinh" tren iOS/iPadOS:
   *  - `capable` -> the <meta name="apple-mobile-web-app-capable"> : chay o che do standalone
   *    (khong con thanh dia chi cua Safari) - dung voi `display: standalone` trong manifest.
   *  - `title`   -> ten ngan duoi icon (mac dinh lay <title> rat dai nen bi cat cut).
   * KHONG dat `statusBarStyle` trong suot: giao dien dang tinh san khoang an toan (env(safe-area-inset-*)
   * trong globals.css) theo thanh trang thai mac dinh, doi sang "black-translucent" se de chu bi che.
   */
  appleWebApp: {
    capable: true,
    title: APP_NAME,
  },
  icons: {
    /*
     * iOS chi ho tro `apple-touch-icon` dang PNG (SVG bi bo qua -> icon trong/manh) nen phai co ban PNG
     * 180x180 trong `public/`; Chrome/Android uu tien PNG 192 + 512. Sinh lai bang `npm run icons:pwa`.
     */
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/logo.svg"],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  /*
   * Mau thanh trinh duyet tren dien thoai (theme-color):
   * - Ban sang dung mau nen giao dien sang, ban toi dung mau nen toi (theo `prefers-color-scheme`).
   * Truoc day luon de mau toi nen tren giao dien sang, thanh trinh duyet bi le mau.
   */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fc" },
    { media: "(prefers-color-scheme: dark)", color: "#070b16" },
  ],
  width: "device-width",
  initialScale: 1,
  /*
   * KHONG dat `maximumScale: 1` / `userScalable: false` de chong zoom khi focus o nhap lieu:
   * lam vay se chan luon thao tac chum 2 ngon tay de phong to, anh huong nguoi mat thi luc.
   * Thay vao do, o nhap lieu tren dien thoai duoc dat font-size 16px trong `globals.css`
   * (Safari chi tu phong to khi o duoc focus co chu nho hon 16px).
   */
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /*
   * Khach (chua dang nhap) van xem/nghe nhac duoc; session chi dung de hien thi dung giao dien.
   *
   * `getSessionUser()` da doi chieu CSDL nen may bi “dang xuat tu xa”/“bi chan” se thay giao dien nhu
   * khach ngay (khong con avatar/ten nhu dang dang nhap). `sessionPresent` cho biet cookie phien con ton
   * tai, de `SessionWatchdog` don khi phien da het hieu luc.
   */
  const [user, sessionPresent] = await Promise.all([getSessionUser(), hasSessionToken()]);

  return (
    <html lang="vi" suppressHydrationWarning>
      {/*
        suppressHydrationWarning:
        - next-themes dat class `dark` truoc khi React hydrate (chong nhay mau)
        - mot so tien ich/extension trinh duyet tu them thuoc tinh vao <body> (cz-shortcut-listen)
        Day khong phai loi cua ung dung nen chi bo qua canh bao cho <html>/<body>.
      */}
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <SessionProvider user={user}>
            {/* Phien da het hieu luc / bi thu hoi tu xa thi dang xuat ngay tren may nay */}
            <SessionWatchdog authenticated={Boolean(user)} sessionPresent={sessionPresent} />

            <ConfirmProvider>
              {children}

              {/* Trinh phat nhac toan cuc: chi mount mot lan cho ca ung dung */}
              <PlayerEngine />
              {/* Dieu khien tu khoa man hinh / tai nghe (Media Session API) */}
              <MediaSessionBridge />
              {/* Ghi nho vi tri dang nghe de lan sau nghe tiep dung cho */}
              <ResumeTracker />
              <PlayerBar />
              <PlayerShortcuts />
              <QueuePanel />
              <FullPlayer />
              <Toaster />
            </ConfirmProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
