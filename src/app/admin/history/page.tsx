import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { requireAdminPage } from "@/lib/auth/guards";
import { SOURCE_LABELS } from "@/lib/constants";
import { formatDateTime, formatListeningTime } from "@/lib/format";
import { listAllHistory } from "@/services/history.service";
import type { SourceType } from "@/types";

export default async function AdminHistoryPage() {
  await requireAdminPage();
  const entries = await listAllHistory(200);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <History className="size-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Lịch sử nghe nhạc toàn hệ thống</h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} lượt nghe gần nhất của tất cả nhân viên
          </p>
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Thời gian</th>
              <th className="px-3 py-2 font-medium">Nhân viên</th>
              <th className="px-3 py-2 font-medium">Bài nhạc</th>
              <th className="px-3 py-2 font-medium">Nguồn</th>
              <th className="px-3 py-2 font-medium">Đã nghe</th>
              <th className="px-3 py-2 font-medium">Hoàn thành</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-surface-hover/60">
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {formatDateTime(entry.playedAt)}
                </td>
                <td className="px-3 py-2">
                  <span className="block text-sm">{entry.user.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {entry.user.email}
                  </span>
                </td>
                <td className="max-w-72 px-3 py-2">
                  <span className="block truncate">{entry.song.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {entry.song.artist || "Không rõ nghệ sĩ"}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">
                  {SOURCE_LABELS[entry.song.sourceType as SourceType]}
                </td>
                <td className="px-3 py-2 text-xs">{formatListeningTime(entry.msPlayed / 1000)}</td>
                <td className="px-3 py-2">
                  <Badge variant={entry.completed ? "success" : "outline"}>
                    {entry.completed ? "Đã nghe hết" : "Nghe dở"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {entries.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Chưa có lượt nghe nào được ghi nhận.
          </p>
        ) : null}
      </div>
    </div>
  );
}
