"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { History, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/music/empty-state";
import { SongRow } from "@/components/music/song-row";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useRowSelection } from "@/hooks/use-row-selection";
import { formatRelativeTime } from "@/lib/format";
import type { HistoryEntryDTO } from "@/types";

export function HistoryList({
  entries,
  title = "Lịch sử nghe nhạc",
  showClearAll = true,
}: {
  entries: HistoryEntryDTO[];
  title?: string;
  showClearAll?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(entries);
  const [pending, setPending] = useState(false);
  const selection = useRowSelection(items.map((entry) => entry.id));
  const confirm = useConfirm();

  const queue = items.map((entry) => entry.song);

  async function removeEntry(entry: HistoryEntryDTO) {
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== entry.id));

    try {
      const response = await fetch(`/api/history/${entry.id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) throw new Error("failed");
    } catch {
      setItems(previous);
      toast.error("Không xoá được mục này. Vui lòng thử lại.");
    }
  }

  /** Xoá nhanh các mục đã tick chọn */
  async function removeSelected() {
    if (selection.count === 0) return;

    const accepted = await confirm({
      title: `Xoá ${selection.count} mục trong lịch sử?`,
      description: "Các lượt nghe đã chọn sẽ bị xoá khỏi lịch sử của bạn.",
      confirmLabel: `Xoá ${selection.count} mục`,
      variant: "danger",
    });

    if (!accepted) return;

    const previous = items;
    const removed = new Set(selection.selectedIds);
    setItems((current) => current.filter((item) => !removed.has(item.id)));

    try {
      const response = await fetch("/api/history/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: selection.selectedIds }),
      });

      if (!response.ok) throw new Error("failed");

      const data = await response.json().catch(() => ({}));
      toast.success(`Đã xoá ${data.affected ?? removed.size} mục khỏi lịch sử.`);
      selection.clear();
      router.refresh();
    } catch {
      setItems(previous);
      toast.error("Không xoá được các mục đã chọn. Vui lòng thử lại.");
    }
  }

  async function clearAll() {
    const accepted = await confirm({
      title: "Xoá toàn bộ lịch sử nghe nhạc?",
      description: `${items.length} lượt nghe sẽ bị xoá khỏi lịch sử của bạn. Hành động này không thể hoàn tác.`,
      confirmLabel: "Xoá toàn bộ",
      variant: "danger",
    });

    if (!accepted) return;

    setPending(true);
    const previous = items;
    setItems([]);

    try {
      const response = await fetch("/api/history", { method: "DELETE" });
      if (!response.ok && response.status !== 204) throw new Error("failed");
      toast.success("Đã xoá toàn bộ lịch sử nghe nhạc.");
      selection.clear();
      router.refresh();
    } catch {
      setItems(previous);
      toast.error("Không xoá được lịch sử. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="size-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{items.length} lượt nghe gần đây</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {items.length > 0 ? (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
              <Checkbox
                aria-label="Chọn tất cả lượt nghe"
                checked={selection.allSelected ? true : selection.someSelected ? "indeterminate" : false}
                onCheckedChange={() => selection.toggleAll()}
              />
              Chọn tất cả
            </label>
          ) : null}

          {showClearAll && items.length > 0 ? (
            <Button variant="outline" size="sm" onClick={clearAll} disabled={pending}>
              <Trash2 /> Xoá toàn bộ lịch sử
            </Button>
          ) : null}
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="Chưa có lịch sử nghe nhạc"
          description="Hãy phát một bài nhạc để bắt đầu ghi lại lịch sử."
        />
      ) : (
        <div className="space-y-3">
          <ul className="divide-y divide-border/40">
            {items.map((entry, index) => (
              <li key={entry.id} className="py-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    aria-label="Chọn lượt nghe này"
                    className="ml-1"
                    checked={selection.selectedIds.includes(entry.id)}
                    onCheckedChange={() => selection.toggle(entry.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <SongRow
                      song={entry.song}
                      index={index}
                      queue={queue}
                      queueLabel={title}
                      showIndex={false}
                      onRemove={() => void removeEntry(entry)}
                      removeLabel="Xoá khỏi lịch sử"
                    />
                  </div>
                  <span className="hidden w-28 shrink-0 text-right text-[11px] text-muted-foreground sm:block">
                    {formatRelativeTime(entry.playedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <BulkActionBar count={selection.count} onClear={selection.clear}>
            <Button size="sm" variant="destructive" onClick={() => void removeSelected()}>
              <Trash2 /> Xoá đã chọn
            </Button>
          </BulkActionBar>
        </div>
      )}
    </div>
  );
}
