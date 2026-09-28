"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  MonitorSmartphone,
  Plus,
  Shield,
  ShieldOff,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { DeviceManager } from "@/components/auth/device-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatDateTime, formatNumber, initialsOf } from "@/lib/format";
import type { UserDTO } from "@/types";

export function EmployeeManager({ initialUsers }: { initialUsers: UserDTO[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [users, setUsers] = useState(initialUsers);
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<UserDTO | null>(null);
  const [deviceTarget, setDeviceTarget] = useState<UserDTO | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("EMPLOYEE");

  async function createEmployee() {
    setPending(true);

    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const details = data?.details as Record<string, string> | undefined;
        toast.error(
          details ? Object.values(details)[0] : (data?.error ?? "Không tạo được tài khoản."),
        );
        return;
      }

      setUsers((current) => [data as UserDTO, ...current]);
      setCreateOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("EMPLOYEE");
      toast.success("Đã tạo tài khoản nhân viên.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function patchUser(user: UserDTO, payload: Record<string, unknown>) {
    const response = await fetch(`/api/employees/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(data?.error ?? "Không cập nhật được tài khoản.");
      return;
    }

    setUsers((current) => current.map((item) => (item.id === user.id ? (data as UserDTO) : item)));
    toast.success("Đã cập nhật tài khoản.");
    router.refresh();
  }

  async function resetPassword() {
    if (!passwordTarget) return;

    if (newPassword.length < 8) {
      toast.error("Mật khẩu tối thiểu 8 ký tự.");
      return;
    }

    setPending(true);

    try {
      const response = await fetch(`/api/employees/${passwordTarget.id}/password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data?.error ?? "Không đặt lại được mật khẩu.");
        return;
      }

      toast.success(`Đã đặt lại mật khẩu cho ${passwordTarget.name}.`);
      setPasswordTarget(null);
      setNewPassword("");
    } finally {
      setPending(false);
    }
  }

  async function removeUser(user: UserDTO) {
    const accepted = await confirm({
      title: "Xoá tài khoản này?",
      description: "Tài khoản, playlist riêng và lịch sử nghe của người này sẽ bị xoá.",
      highlights: [`${user.name} · ${user.email}`],
      confirmLabel: "Xoá tài khoản",
      variant: "danger",
    });

    if (!accepted) return;

    const response = await fetch(`/api/employees/${user.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok && response.status !== 204) {
      toast.error(data?.error ?? "Không xoá được tài khoản.");
      return;
    }

    setUsers((current) => current.filter((item) => item.id !== user.id));
    toast.success("Đã xoá tài khoản.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Quản lý nhân viên</h1>
          <p className="text-sm text-muted-foreground">
            {users.length} tài khoản · phân quyền, khoá/mở và đặt lại mật khẩu
          </p>
        </div>

        <Button size="sm" variant="gradient" onClick={() => setCreateOpen(true)}>
          <Plus /> Thêm nhân viên
        </Button>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-surface/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Nhân viên</th>
              <th className="px-3 py-2 font-medium">Vai trò</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Hoạt động</th>
              <th className="px-3 py-2 font-medium">Đăng nhập cuối</th>
              <th className="px-3 py-2 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-surface-hover/60">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-full bg-gradient-brand text-[11px] font-semibold text-white">
                      {initialsOf(user.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{user.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {user.email}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={user.role === "ADMIN" ? "neon" : "secondary"}>
                    {user.role === "ADMIN" ? "Quản trị viên" : "Nhân viên"}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={user.isActive ? "success" : "destructive"}>
                    {user.isActive ? "Đang hoạt động" : "Đã khoá"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {formatNumber(user.stats?.playCount ?? 0)} lượt ·{" "}
                  {user.stats?.playlistCount ?? 0} playlist · {user.stats?.favoriteCount ?? 0} yêu
                  thích
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Chưa đăng nhập"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={user.role === "ADMIN" ? "Hạ xuống nhân viên" : "Cấp quyền quản trị"}
                      onClick={() =>
                        void patchUser(user, {
                          role: user.role === "ADMIN" ? "EMPLOYEE" : "ADMIN",
                        })
                      }
                    >
                      {user.role === "ADMIN" ? <ShieldOff /> : <Shield />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={user.isActive ? "Khoá tài khoản" : "Mở khoá tài khoản"}
                      onClick={() => void patchUser(user, { isActive: !user.isActive })}
                    >
                      {user.isActive ? <UserX /> : <UserCheck />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Thiết bị đang đăng nhập (IP, vị trí) — đăng xuất / chặn đăng nhập"
                      onClick={() => setDeviceTarget(user)}
                    >
                      <MonitorSmartphone />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Đặt lại mật khẩu"
                      onClick={() => setPasswordTarget(user)}
                    >
                      <KeyRound />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hover:text-destructive"
                      title="Xoá tài khoản"
                      onClick={() => void removeUser(user)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm nhân viên</DialogTitle>
            <DialogDescription>
              Tài khoản nội bộ dùng để đăng nhập hệ thống nghe nhạc.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employee-name">Họ và tên</Label>
              <Input
                id="employee-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nguyễn Văn A"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee-email">Email</Label>
              <Input
                id="employee-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nhanvien@congty.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee-password">Mật khẩu ban đầu</Label>
              <Input
                id="employee-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tối thiểu 8 ký tự"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee-role">Vai trò</Label>
              <Select
                id="employee-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                options={[
                  { value: "EMPLOYEE", label: "Nhân viên" },
                  { value: "ADMIN", label: "Quản trị viên" },
                ]}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Huỷ
            </Button>
            <Button variant="gradient" onClick={createEmployee} disabled={pending}>
              {pending ? "Đang tạo..." : "Tạo tài khoản"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(passwordTarget)}
        onOpenChange={(open) => !open && setPasswordTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Đặt lại mật khẩu</DialogTitle>
            <DialogDescription>
              Mật khẩu mới cho {passwordTarget?.name} ({passwordTarget?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reset-password">Mật khẩu mới</Label>
            <Input
              id="reset-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Tối thiểu 8 ký tự"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPasswordTarget(null)}>
              Huỷ
            </Button>
            <Button variant="gradient" onClick={resetPassword} disabled={pending}>
              Đặt lại mật khẩu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Thiết bị đang đăng nhập của nhân viên: xem IP / vị trí, đăng xuất từng máy hoặc chặn */}
      <Dialog
        open={deviceTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeviceTarget(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Thiết bị đang đăng nhập</DialogTitle>
            <DialogDescription>
              {deviceTarget ? `${deviceTarget.name} · ${deviceTarget.email}` : ""}
            </DialogDescription>
          </DialogHeader>

          {deviceTarget ? (
            <DeviceManager
              key={deviceTarget.id}
              scope="admin"
              userId={deviceTarget.id}
              title={`Thiết bị của ${deviceTarget.name}`}
              description="Đăng xuất từng thiết bị hoặc chặn đăng nhập cho tới khi được mở chặn."
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
