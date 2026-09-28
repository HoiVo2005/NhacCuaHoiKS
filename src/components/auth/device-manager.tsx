"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  Check,
  Loader2,
  LogOut,
  Monitor,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Unlock,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DeviceDTO } from "@/types";

interface DeviceManagerProps {
  /** `self` = thiết bị của chính mình, `admin` = thiết bị của một nhân viên */
  scope?: "self" | "admin";
  /** Bắt buộc khi `scope="admin"` */
  userId?: string;
  title?: string;
  description?: string;
}

/** Nhãn nhỏ đánh dấu trạng thái thiết bị */
function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium ring-1", className)}>
      {children}
    </span>
  );
}

/** Một dòng thông tin của thiết bị (IP, vị trí, thời gian…) */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-1">
      <dt className="shrink-0 text-muted-foreground/80">{label}:</dt>
      <dd className="min-w-0 truncate text-foreground/90">{value}</dd>
    </div>
  );
}

/**
 * “Thiết bị đang đăng nhập”: mỗi dòng hiện **tên máy – IP – vị trí – lần dùng gần nhất** kèm nút
 * **Đăng xuất** (từng máy hoặc tất cả) và **Chặn đăng nhập** (thiết bị bị chặn không thể đăng nhập
 * lại cho tới khi bấm “Mở chặn”).
 */
export function DeviceManager({
  scope = "self",
  userId,
  title = "Thiết bị đang đăng nhập",
  description = "Xem máy nào đang dùng tài khoản này (IP, vị trí). Nghi ngờ máy lạ thì đăng xuất hoặc chặn đăng nhập ngay.",
}: DeviceManagerProps) {
  const confirm = useConfirm();
  const [devices, setDevices] = useState<DeviceDTO[] | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");

  const endpoint = scope === "admin" ? `/api/employees/${userId ?? ""}/devices` : "/api/me/devices";

  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data?.error ?? "Không tải được danh sách thiết bị.");
        setDevices([]);
        return;
      }

      setDevices((data?.devices ?? []) as DeviceDTO[]);
    } catch {
      toast.error("Không kết nối được tới máy chủ.");
      setDevices([]);
    }
  }, [endpoint]);

  /*
   * Tải danh sách khi mở trang. Dùng IIFE async + AbortController (giống `lyrics-panel.tsx`)
   * thay vì gọi thẳng `load()` để không đặt state ngay trong thân effect.
   */
  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (controller.signal.aborted) return;

        if (!response.ok) {
          toast.error(data?.error ?? "Không tải được danh sách thiết bị.");
          setDevices([]);
          return;
        }

        setDevices((data?.devices ?? []) as DeviceDTO[]);
      } catch {
        if (controller.signal.aborted) return;
        toast.error("Không kết nối được tới máy chủ.");
        setDevices([]);
      }
    })();

    return () => controller.abort();
  }, [endpoint]);

  /** Gửi thao tác lên máy chủ rồi tải lại danh sách */
  async function send(
    action: "revoke" | "revoke-others" | "revoke-all" | "block" | "unblock" | "rename",
    deviceId?: string,
    extra?: { label?: string; reason?: string },
    successMessage = "Đã cập nhật thiết bị.",
  ): Promise<boolean> {
    setPendingKey(deviceId ?? action);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, deviceId, ...extra }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data?.error ?? "Không thực hiện được thao tác.");
        return false;
      }

      toast.success(successMessage);
      await load();
      return true;
    } catch {
      toast.error("Không kết nối được tới máy chủ.");
      return false;
    } finally {
      setPendingKey(null);
    }
  }

  async function handleRevoke(device: DeviceDTO) {
    if (device.isCurrent && scope === "self") {
      const accepted = await confirm({
        title: "Đăng xuất khỏi máy này?",
        description: "Bạn sẽ cần đăng nhập lại trên thiết bị đang dùng.",
        confirmLabel: "Đăng xuất",
        variant: "warning",
      });
      if (!accepted) return;

      await signOut({ callbackUrl: "/login" });
      return;
    }

    const accepted = await confirm({
      title: "Đăng xuất thiết bị này?",
      description: `Thiết bị “${device.displayName}” sẽ bị đăng xuất ngay và phải đăng nhập lại.`,
      highlights: [device.ipLabel, device.location ?? "Không rõ vị trí"],
      confirmLabel: "Đăng xuất",
      variant: "warning",
    });
    if (!accepted) return;

    await send("revoke", device.id, undefined, "Đã đăng xuất thiết bị đó.");
  }

  async function handleBlock(device: DeviceDTO) {
    if (device.status === "BLOCKED") {
      const accepted = await confirm({
        title: "Mở chặn thiết bị này?",
        description: `Sau khi mở chặn, “${device.displayName}” có thể đăng nhập lại bình thường.`,
        confirmLabel: "Mở chặn",
        variant: "default",
      });
      if (!accepted) return;

      await send("unblock", device.id, undefined, "Đã mở chặn thiết bị.");
      return;
    }

    const accepted = await confirm({
      title: "Chặn đăng nhập từ thiết bị này?",
      description: `“${device.displayName}” sẽ bị cắt phiên đang dùng và KHÔNG thể đăng nhập lại cho tới khi bạn bấm “Mở chặn”.`,
      highlights: [device.ipLabel, device.location ?? "Không rõ vị trí"],
      confirmLabel: "Chặn đăng nhập",
      variant: "danger",
    });
    if (!accepted) return;

    await send(
      "block",
      device.id,
      { reason: "Bị chặn từ trang quản lý thiết bị" },
      "Đã chặn thiết bị.",
    );
  }

  async function handleRevokeOthers() {
    const accepted = await confirm({
      title: "Đăng xuất tất cả thiết bị khác?",
      description: "Mọi thiết bị khác đang đăng nhập tài khoản này sẽ bị đăng xuất, trừ máy bạn đang dùng.",
      confirmLabel: "Đăng xuất các máy khác",
      variant: "warning",
    });
    if (!accepted) return;

    await send("revoke-others", undefined, undefined, "Đã đăng xuất các thiết bị khác.");
  }

  async function handleRevokeAll() {
    const accepted = await confirm({
      title: "Đăng xuất TẤT CẢ thiết bị?",
      description: "Kể cả máy bạn đang dùng. Bạn sẽ được đưa về trang đăng nhập.",
      confirmLabel: "Đăng xuất tất cả",
      variant: "danger",
    });
    if (!accepted) return;

    const done = await send("revoke-all", undefined, undefined, "Đã đăng xuất tất cả thiết bị.");
    if (done) await signOut({ callbackUrl: "/login" });
  }

  async function handleRename(device: DeviceDTO) {
    const done = await send(
      "rename",
      device.id,
      { label: labelDraft.trim() },
      "Đã đổi tên thiết bị.",
    );

    if (done) {
      setRenamingId(null);
      setLabelDraft("");
    }
  }

  const phonePlatforms = ["iPhone", "iPad", "Android"];
  const activeCount = (devices ?? []).filter((device) => device.status === "ACTIVE").length;

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-card/60 p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{description}</p>
            {devices ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Đang hoạt động:{" "}
                <span className="font-medium text-foreground">{activeCount}</span> thiết bị
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 flex-1 sm:min-h-0 sm:flex-none"
            onClick={() => void load()}
            disabled={pendingKey !== null}
          >
            <RefreshCw className={cn("size-4", pendingKey && "animate-spin")} />
            Tải lại
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11 flex-1 gap-1.5 sm:min-h-0 sm:flex-none"
            onClick={() => void handleRevokeOthers()}
            disabled={pendingKey !== null}
          >
            <LogOut className="size-4" />
            Đăng xuất máy khác
          </Button>

          {scope === "self" ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="min-h-11 flex-1 gap-1.5 sm:min-h-0 sm:flex-none"
              onClick={() => void handleRevokeAll()}
              disabled={pendingKey !== null}
            >
              <Ban className="size-4" />
              Đăng xuất tất cả
            </Button>
          ) : null}
        </div>
      </header>

      {devices === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Đang tải danh sách thiết bị…
        </p>
      ) : devices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-surface/50 p-4 text-sm text-muted-foreground">
          Chưa có thiết bị nào được ghi nhận. Lần đăng nhập kế tiếp sẽ xuất hiện tại đây.
        </p>
      ) : (
        <ul className="space-y-3">
          {devices.map((device) => (
            <li
              key={device.id}
              className={cn(
                "rounded-xl border p-3 sm:p-4",
                device.status === "BLOCKED"
                  ? "border-destructive/40 bg-destructive-soft/40"
                  : device.status === "REVOKED"
                    ? "border-border/70 bg-surface/40"
                    : "border-border/70 bg-surface/60",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  {phonePlatforms.includes(device.platform ?? "") ? (
                    <Smartphone className="size-4" />
                  ) : (
                    <Monitor className="size-4" />
                  )}
                </span>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">{device.displayName}</p>

                    {device.isCurrent ? (
                      <Chip className="bg-primary/15 text-primary ring-primary/25">Thiết bị này</Chip>
                    ) : null}
                    {device.status === "BLOCKED" ? (
                      <Chip className="bg-destructive-soft text-destructive-soft-foreground ring-destructive/30">
                        Đang chặn đăng nhập
                      </Chip>
                    ) : null}
                    {device.status === "REVOKED" ? (
                      <Chip className="bg-warning-soft text-warning-soft-foreground ring-warning/30">
                        Đã đăng xuất
                      </Chip>
                    ) : null}
                  </div>

                  <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                    <Detail label="IP" value={device.ipLabel} />
                    <Detail label="Vị trí" value={device.location ?? "Không xác định được"} />
                    <Detail
                      label="Trình duyệt / hệ điều hành"
                      value={
                        [device.browser, device.platform].filter(Boolean).join(" · ") ||
                        device.deviceName
                      }
                    />
                    <Detail
                      label="Hoạt động gần nhất"
                      value={`${formatRelativeTime(device.lastSeenAt)} (${formatDateTime(device.lastSeenAt)})`}
                    />
                    <Detail label="Đăng nhập lần đầu" value={formatDateTime(device.firstLoginAt)} />
                    {device.blockedAt ? (
                      <Detail
                        label="Bị chặn lúc"
                        value={`${formatDateTime(device.blockedAt)}${
                          device.blockedByEmail ? ` · ${device.blockedByEmail}` : ""
                        }`}
                      />
                    ) : null}
                  </dl>

                  {renamingId === device.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={labelDraft}
                        onChange={(event) => setLabelDraft(event.target.value)}
                        placeholder="Tên gợi nhớ, ví dụ: Điện thoại của Hội"
                        maxLength={100}
                        className="min-h-11 flex-1 text-base sm:min-h-0 sm:text-sm"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-11 gap-1.5 sm:min-h-0"
                        onClick={() => void handleRename(device)}
                        disabled={pendingKey === device.id}
                      >
                        {pendingKey === device.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                        Lưu
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-11 sm:min-h-0"
                        onClick={() => {
                          setRenamingId(null);
                          setLabelDraft("");
                        }}
                      >
                        <X className="size-4" />
                        Huỷ
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-11 flex-1 gap-1.5 sm:min-h-0 sm:flex-none"
                        onClick={() => void handleRevoke(device)}
                        disabled={pendingKey !== null}
                      >
                        <LogOut className="size-4" />
                        {device.isCurrent && scope === "self" ? "Đăng xuất máy này" : "Đăng xuất"}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant={device.status === "BLOCKED" ? "secondary" : "destructive"}
                        className="min-h-11 flex-1 gap-1.5 sm:min-h-0 sm:flex-none"
                        onClick={() => void handleBlock(device)}
                        disabled={pendingKey !== null}
                      >
                        {device.status === "BLOCKED" ? (
                          <Unlock className="size-4" />
                        ) : (
                          <Ban className="size-4" />
                        )}
                        {device.status === "BLOCKED" ? "Mở chặn" : "Chặn đăng nhập"}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-11 gap-1.5 sm:min-h-0"
                        onClick={() => {
                          setRenamingId(device.id);
                          setLabelDraft(device.label ?? "");
                        }}
                        disabled={pendingKey !== null}
                      >
                        <Pencil className="size-4" />
                        Đổi tên
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
