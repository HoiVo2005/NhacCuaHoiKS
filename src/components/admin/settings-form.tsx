"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Settings } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface AppSettingsState {
  siteName: string;
  allowEmployeePlaylists: boolean;
  maxUploadMb: number;
  announcement: string | null;
}

export function SettingsForm() {
  const [settings, setSettings] = useState<AppSettingsState | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch("/api/admin/settings")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: AppSettingsState | null) => {
        if (active && data) setSettings(data);
      })
      .catch(() => toast.error("Không tải được cấu hình hệ thống."))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          siteName: settings.siteName,
          allowEmployeePlaylists: settings.allowEmployeePlaylists,
          maxUploadMb: settings.maxUploadMb,
          announcement: settings.announcement ?? "",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data?.error ?? "Không lưu được cấu hình.");
        return;
      }

      setSettings(data as AppSettingsState);
      toast.success("Đã lưu cấu hình hệ thống.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Đang tải cấu hình...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <Settings className="size-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Cài đặt hệ thống</h1>
          <p className="text-sm text-muted-foreground">
            Cấu hình chung được lưu trong bảng app_settings
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Thông tin chung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <Label htmlFor="site-name">Tên hệ thống</Label>
              <Input
                id="site-name"
                value={settings.siteName}
                onChange={(event) =>
                  setSettings({ ...settings, siteName: event.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="announcement">Thông báo trên trang chủ</Label>
              <Textarea
                id="announcement"
                value={settings.announcement ?? ""}
                onChange={(event) =>
                  setSettings({ ...settings, announcement: event.target.value })
                }
                placeholder="Ví dụ: Tuần này thư viện có thêm nhạc mới!"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Quyền và giới hạn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
              <div>
                <p className="text-sm">Cho phép nhân viên tạo playlist</p>
                <p className="text-[11px] text-muted-foreground">
                  Nếu tắt, chỉ quản trị viên tạo được danh sách phát
                </p>
              </div>
              <Switch
                checked={settings.allowEmployeePlaylists}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, allowEmployeePlaylists: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-upload">Giới hạn dung lượng tải lên (MB)</Label>
              <Input
                id="max-upload"
                type="number"
                min={1}
                max={2048}
                value={settings.maxUploadMb}
                onChange={(event) =>
                  setSettings({ ...settings, maxUploadMb: Number(event.target.value) })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Giá trị này áp dụng cho giao diện quản trị; giới hạn thực tế của máy chủ nằm ở biến
                UPLOAD_MAX_BYTES trong file .env.
              </p>
            </div>

            <Button variant="gradient" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {saving ? "Đang lưu..." : "Lưu cấu hình"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
