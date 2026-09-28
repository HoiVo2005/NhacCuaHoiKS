"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn, ShieldAlert } from "lucide-react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeviceStatusResponse {
  deviceName?: string;
  ipAddress?: string | null;
  blocked?: boolean;
  blockedReason?: string | null;
  blockedByEmail?: string | null;
}

/**
 * Hỏi máy chủ xem THIẾT BỊ đang dùng có bị chặn đăng nhập không.
 * Cũng là lần gọi đầu tiên giúp máy chủ đặt cookie định danh thiết bị (`nch_device`).
 */
async function fetchDeviceStatus(email: string | null): Promise<DeviceStatusResponse | null> {
  try {
    const query = email ? `?email=${encodeURIComponent(email)}` : "";
    const response = await fetch(`/api/device-status${query}`, { cache: "no-store" });
    if (!response.ok) return null;

    return (await response.json()) as DeviceStatusResponse;
  } catch {
    return null;
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceHint, setDeviceHint] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const status = await fetchDeviceStatus(null);
      if (!active || !status?.deviceName) return;

      setDeviceHint(
        `Thiết bị này: ${status.deviceName}${status.ipAddress ? ` · IP ${status.ipAddress}` : ""}`,
      );
    })();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        /*
         * Có thể thiết bị này đã bị CHẶN đăng nhập (chặn từ trang “Thiết bị đang đăng nhập”).
         * Hỏi máy chủ để báo đúng lý do thay vì đổ lỗi cho mật khẩu.
         */
        const status = await fetchDeviceStatus(email);

        if (status?.blocked) {
          setError(
            `Thiết bị ${status.deviceName ? `“${status.deviceName}” ` : ""}đã bị chặn đăng nhập${
              status.blockedByEmail ? ` (bởi ${status.blockedByEmail})` : ""
            }. ${status.blockedReason ? `${status.blockedReason}. ` : ""}Liên hệ quản trị viên để được mở chặn.`,
          );
          return;
        }

        setError("Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khoá.");
        return;
      }

      toast.success("Đăng nhập thành công");
      router.replace(callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/");
      router.refresh();
    } catch {
      setError("Không kết nối được tới máy chủ. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Đăng nhập hệ thống</h2>
        <p className="text-sm text-muted-foreground">
          Dùng tài khoản nội bộ do quản trị viên cấp.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ten.ban@congty.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Mật khẩu</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground"
              title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {deviceHint ? (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldAlert className="size-3.5 shrink-0" />
            {deviceHint}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="gradient" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
          {pending ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
      </form>

      {/*
        Gợi ý tài khoản mẫu CHỈ hiện khi chạy dev/test. Bản deploy thật không được in mật khẩu
        của tài khoản quản trị ra màn hình đăng nhập (repo này là công khai).
      */}
      {process.env.NODE_ENV !== "production" ? (
        <div className="rounded-lg border border-border/70 bg-surface/60 p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground/90">Tài khoản mẫu (sau khi seed dữ liệu)</p>
          <p>Quản trị viên: admin@mymusic.local / Admin@123456</p>
          <p>Nhân viên: nhanvien@mymusic.local / NhanVien@123456</p>
        </div>
      ) : null}
    </div>
  );
}
