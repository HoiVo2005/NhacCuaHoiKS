"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Save, UserCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import type { SessionUser } from "@/types";

export function ProfileForm({ user, createdAt }: { user: SessionUser; createdAt?: string }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);

    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), avatarUrl: avatarUrl.trim() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data?.error ?? "Không cập nhật được hồ sơ.");
        return;
      }

      toast.success("Đã cập nhật hồ sơ.");
      router.refresh();
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu nhập lại không khớp.");
      return;
    }

    setSavingPassword(true);

    try {
      const response = await fetch("/api/me/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data?.error ?? "Không đổi được mật khẩu.");
        return;
      }

      toast.success("Đã đổi mật khẩu thành công.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <UserCircle2 className="size-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Hồ sơ cá nhân</h1>
          <p className="text-sm text-muted-foreground">
            {user.role === "ADMIN" ? "Quản trị viên" : "Nhân viên"} · tham gia{" "}
            {createdAt ? formatDateTime(createdAt) : "—"}
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={saveProfile}
          className="space-y-4 rounded-xl border border-border/70 bg-card/60 p-5"
        >
          <h2 className="text-sm font-semibold">Thông tin hiển thị</h2>

          <div className="space-y-2">
            <Label htmlFor="profile-email">Email (không đổi được)</Label>
            <Input id="profile-email" value={user.email} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-name">Tên hiển thị</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-avatar">Ảnh đại diện (đường dẫn)</Label>
            <Input
              id="profile-avatar"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://..."
            />
          </div>

          <Button type="submit" variant="gradient" disabled={savingProfile}>
            {savingProfile ? <Loader2 className="animate-spin" /> : <Save />}
            Lưu thay đổi
          </Button>
        </form>

        <form
          onSubmit={changePassword}
          className="space-y-4 rounded-xl border border-border/70 bg-card/60 p-5"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="size-4" /> Đổi mật khẩu
          </h2>

          <div className="space-y-2">
            <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Mật khẩu mới</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              required
            />
            <p className="text-[11px] text-muted-foreground">Tối thiểu 8 ký tự.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Nhập lại mật khẩu mới</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          <Button type="submit" variant="outline" disabled={savingPassword}>
            {savingPassword ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Đổi mật khẩu
          </Button>
        </form>
      </div>
    </div>
  );
}