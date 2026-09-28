"use client";

import { useCallback, useRef } from "react";
import { ArrowUpToLine, GripVertical, ListMusic, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Artwork } from "@/components/ui/artwork";
import { useListReorder } from "@/hooks/use-list-reorder";
import { SOURCE_LABELS } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";

export function QueuePanel() {
  const queueOpen = usePlayerStore((state) => state.queueOpen);
  const queue = usePlayerStore((state) => state.queue);
  const currentIndex = usePlayerStore((state) => state.currentIndex);
  const queueLabel = usePlayerStore((state) => state.queueLabel);
  const isPlaying = usePlayerStore((state) => state.isPlaying);

  const listRef = useRef<HTMLDivElement | null>(null);

  const handleMove = useCallback((from: number, to: number) => {
    usePlayerStore.getState().moveInQueue(from, to);
  }, []);

  // Keo-tha de sap xep hang cho (hoat dong ca tren cam ung lan ban phim)
  const { draggingIndex, setItemRef, dragHandleProps } = useListReorder({
    itemCount: queue.length,
    onMove: handleMove,
    scrollContainerRef: listRef,
  });

  if (!queueOpen) return null;

  const totalDuration = queue.reduce((total, song) => total + (song.durationSeconds || 0), 0);

  return (
    <aside className="bg-popover/95 backdrop-blur-xl safe-bottom animate-slide-up fixed bottom-36 right-3 z-[60] flex max-h-[68vh] w-[min(93vw,380px)] flex-col overflow-hidden rounded-2xl border border-border/80 shadow-2xl sm:bottom-24">
      <header className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <ListMusic className="size-4 text-primary" />
          <div>
            <p className="text-sm font-semibold">Danh sách phát</p>
            <p className="text-[11px] text-muted-foreground">
              {queue.length} bài · {formatDuration(totalDuration)}
              {queueLabel ? ` · ${queueLabel}` : ""}
            </p>
            {queue.length > 1 ? (
              <p className="text-[10px] text-primary/80">
                Kéo tay cầm ⠿ để ưu tiên bài bạn thích lên trên
              </p>
            ) : null}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => usePlayerStore.getState().toggleQueue()}
          title="Đóng"
        >
          <X />
        </Button>
      </header>

      <div ref={listRef} className="scrollbar-thin flex-1 overflow-y-auto p-2">
        {queue.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Danh sách phát đang trống.
          </p>
        ) : (
          <ul className="space-y-1">
            {queue.map((song, index) => {
              const isCurrent = index === currentIndex;
              return (
                <li
                  key={`${song.id}-${index}`}
                  ref={setItemRef(index)}
                  className={cn(
                    "rounded-lg transition",
                    draggingIndex === index && "bg-primary/20 ring-1 ring-primary/60",
                  )}
                >
                  <div
                    className={cn(
                      "group flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 transition sm:px-2",
                      isCurrent ? "bg-primary/15" : "hover:bg-surface-hover",
                      draggingIndex === index && "shadow-lg",
                    )}
                  >
                    <button
                      type="button"
                      {...dragHandleProps(index)}
                      aria-label="Kéo để sắp xếp lại"
                      title="Kéo để sắp xếp (hoặc dùng phím ↑ ↓)"
                      className="shrink-0 cursor-grab rounded-md p-1 text-muted-foreground/70 transition hover:bg-surface-hover hover:text-foreground active:cursor-grabbing"
                    >
                      <GripVertical className="size-4" />
                    </button>

                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => usePlayerStore.getState().playQueue(queue, index, queueLabel)}
                    >
                      <span className="w-5 shrink-0 text-center text-[11px] text-muted-foreground">
                        {isCurrent && isPlaying ? "▶" : index + 1}
                      </span>
                      {song.thumbnailUrl ? (
                         
                        <Artwork
                          src={song.thumbnailUrl}
                          alt=""
                          className="size-9 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <span className="flex size-9 shrink-0 items-center justify-center rounded bg-surface text-xs text-muted-foreground">
                          ♪
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{song.title}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {song.artist || "Không rõ nghệ sĩ"} · {SOURCE_LABELS[song.sourceType]}
                        </span>
                      </span>
                    </button>

                    <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">
                      {formatDuration(song.durationSeconds)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={() => usePlayerStore.getState().removeFromQueue(index)}
                      title="Xoá khỏi danh sách"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-border/70 px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => usePlayerStore.getState().clearQueue()}
          disabled={queue.length === 0}
        >
          <Trash2 /> Xoá tất cả
        </Button>

        {currentIndex > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-primary"
            onClick={() => usePlayerStore.getState().moveInQueue(currentIndex, 0)}
            title="Đưa bài đang phát lên đầu danh sách"
          >
            <ArrowUpToLine /> Lên đầu
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => usePlayerStore.getState().toggleQueue()}
        >
          Đóng
        </Button>
      </footer>
    </aside>
  );
}
