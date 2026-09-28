import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { BrandMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Đăng nhập",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-2">
        {/* Gioi thieu */}
        <section className="hidden flex-col justify-center gap-6 rounded-2xl border border-border/70 bg-card/50 p-8 lg:flex">
          <div className="flex items-center gap-3">
            <BrandMark className="size-11 rounded-2xl shadow-lg" />
            <div>
              <p className="text-lg font-semibold">{APP_NAME}</p>
              <p className="text-xs text-muted-foreground">Thư viện nhạc nội bộ doanh nghiệp</p>
            </div>
          </div>

          <h1 className="text-3xl font-semibold leading-tight">
            Nghe nhạc nội bộ, <span className="text-gradient">tập trung và an toàn</span>
          </h1>

          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>• Thư viện nhạc tập trung: YouTube, SoundCloud, TikTok và file tải lên.</li>
            <li>• Trình phát nhạc toàn cục: hàng chờ, ngẫu nhiên, lặp lại, video.</li>
            <li>• Playlist, yêu thích và lịch sử nghe cho từng nhân viên.</li>
            <li>• Quản trị tập trung: phân quyền, thể loại, thống kê lượt nghe.</li>
          </ul>

          <p className="text-xs text-muted-foreground">
            Hệ thống chỉ nhúng nội dung qua API chính thức của các nền tảng, không bóc tách
            DRM hay tải xuống trái phép.
          </p>
        </section>

        {/* Form dang nhap */}
        <section className="rounded-2xl border border-border/70 bg-card/70 p-8 backdrop-blur-sm">
          {/* useSearchParams() can duoc boc trong Suspense khi prerender */}
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">Đang tải biểu mẫu đăng nhập...</p>
            }
          >
            <LoginForm />
          </Suspense>

          <p className="mt-6 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
            Chưa cần tài khoản?{" "}
            <Link href="/music" className="text-primary hover:underline">
              Nghe nhạc ngay →
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
