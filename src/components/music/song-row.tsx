"use client";

import { Pause, Play, Plus, Trash2 } from "lucide-react";

import { AddToPlaylistDialog } from "@/components/music/add-to-playlist-dialog";
import { FavoriteButton } from "@/components/music/favorite-button";
import { Artwork } from "@/components/ui/artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SOURCE_LABELS } from "@/lib/constants";
import { formatDuration, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import type { SongDTO } from "@/types";

interface SongRowProps {
  song: SongDTO;
  index: number;
  queue: SongDTO[];
  queueLabel?: string;
  showIndex?: boolean;
  onRemove?: (song: SongDTO) => void;
  removeLabel?: string;
}

export function SongRow({
  song,
  index,
  queue,
  queueLabel,
  showIndex = true,
  onRemove,
  removeLabel = "Xoá khỏi danh sách",
}: SongRowProps) {
  const currentId = usePlayerStore((state) => state.current?.id);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isCurrent = currentId === song.id;
  const isCurrentPlaying = isCurrent && isPlaying;

  return (
    <div
      className={cn(
        "group grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-xl px-1.5 py-2 transition sm:grid-cols-[auto_auto_1fr_auto_auto] sm:gap-3 sm:px-2.5",
        isCurrent
          ? "bg-primary/8 ring-1 ring-primary/20"
          : "hover:bg-surface-hover/80",
      )}
    >
      <div className="flex w-7 items-center justify-center">
        {showIndex ? (
          isCurrentPlaying ? (
            /* Song nhac dong thay cho con so thu tu (dau hieu "dang phat" truc quan) */
            <span aria-hidden className="equalize-bars">
              {["-0.15s", "-0.45s", "-0.7s"].map((delay) => (
                <span key={delay} style={{ animationDelay: delay }} />
              ))}
            </span>
          ) : (
            <span
              className={cn(
                "text-xs tabular-nums text-muted-foreground",
                isCurrent && "font-medium text-primary",
              )}
            >
              {index + 1}
            </span>
          )
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => usePlayerStore.getState().playQueue(queue, index, queueLabel)}
        className={cn(
          "art-frame size-11 shrink-0 transition sm:size-12",
          isCurrent && "ring-1 ring-primary/40",
        )}
        title={isCurrentPlaying ? "Tạm dừng" : "Phát bài này"}
      >
        {song.thumbnailUrl ? (
          <Artwork src={song.thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center bg-gradient-to-br from-brand/20 to-brand-sky/10 text-xs text-primary">
            ♪
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
          {isCurrentPlaying ? <Pause className="size-4 text-white" /> : <Play className="size-4 text-white" />}
        </span>
      </button>

      <button
        type="button"
        onClick={() => usePlayerStore.getState().playQueue(queue, index, queueLabel)}
        className="min-w-0 text-left"
      >
        <span
          className={cn(
            "block truncate text-sm leading-snug",
            isCurrent ? "font-semibold text-primary" : "font-medium",
          )}
        >
          {song.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{song.artist || "Không rõ nghệ sĩ"}</span>
          <span className="text-muted-foreground/70 sm:hidden">
            {formatDuration(song.durationSeconds)}
          </span>
          {song.genre ? (
            <Badge
              variant="outline"
              className="hidden py-0 sm:inline-flex"
              style={song.genre.color ? { borderColor: song.genre.color, color: song.genre.color } : undefined}
            >
              {song.genre.name}
            </Badge>
          ) : null}
          <span className="hidden sm:inline">{SOURCE_LABELS[song.sourceType]}</span>
          {song.playCount > 0 ? (
            <span className="hidden sm:inline">{formatNumber(song.playCount)} lượt nghe</span>
          ) : null}
        </span>
      </button>

      <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
        {formatDuration(song.durationSeconds)}
      </span>

      <div className="flex items-center gap-0.5">
        <FavoriteButton songId={song.id} initialFavorite={song.isFavorite} />
        <AddToPlaylistDialog songId={song.id}>
          <Button variant="ghost" size="icon-sm" title="Thêm vào playlist">
            <Plus />
          </Button>
        </AddToPlaylistDialog>
        {onRemove ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground opacity-100 transition hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
            onClick={() => onRemove(song)}
            title={removeLabel}
          >
            <Trash2 />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
