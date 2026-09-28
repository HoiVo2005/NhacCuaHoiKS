"use client";

import { Play } from "lucide-react";

import { Artwork } from "@/components/ui/artwork";
import { Badge } from "@/components/ui/badge";
import { SOURCE_LABELS } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import type { SongDTO } from "@/types";

/**
 * The bai nhac (card primitive).
 *
 * Cau truc giong cac app streaming lon: khung bia vuong (`.art-frame`) + lop phu nut phat
 * hien khi hover + tieu de dam + dong phu mo. The dang phat duoc danh dau bang vien mau
 * chu dao va song nhac dong (`.equalize-bars`) thay cho chu "dang phat".
 */
export function SongCard({
  song,
  queue,
  queueLabel,
  index = 0,
}: {
  song: SongDTO;
  queue: SongDTO[];
  queueLabel?: string;
  index?: number;
}) {
  const currentId = usePlayerStore((state) => state.current?.id);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isCurrent = currentId === song.id;
  const isCurrentPlaying = isCurrent && isPlaying;

  return (
    <button
      type="button"
      onClick={() => usePlayerStore.getState().playQueue(queue, index, queueLabel)}
      className={cn(
        "group card-surface lift flex flex-col gap-3 rounded-2xl p-2.5 text-left",
        isCurrent && "border-primary/50 bg-primary/8 ring-1 ring-primary/25",
      )}
      title={`Phát "${song.title}"`}
    >
      <span className="art-frame block aspect-square w-full">
        {song.thumbnailUrl ? (
          <Artwork
            src={song.thumbnailUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center bg-gradient-to-br from-brand/20 to-brand-sky/10 text-2xl text-primary">
            ♪
          </span>
        )}

        {/* Chip thoi luong o goc bia (kieu YouTube/Spotify) */}
        {song.durationSeconds > 0 ? (
          <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white backdrop-blur-sm">
            {formatDuration(song.durationSeconds)}
          </span>
        ) : null}

        {/* Song nhac dong khi bai nay dang phat */}
        {isCurrentPlaying ? (
          <span aria-hidden className="equalize-bars absolute left-2 top-2 h-3 items-end">
            {["-0.15s", "-0.45s", "-0.7s"].map((delay) => (
              <span key={delay} style={{ animationDelay: delay }} />
            ))}
          </span>
        ) : null}

        {/* Nut phat: tren dien thoai (khong co hover) luon hien; tren desktop truot len khi hover */}
        <span
          className={cn(
            "bg-gradient-brand absolute bottom-2 right-2 flex size-10 translate-y-0 items-center justify-center rounded-full text-white opacity-100 shadow-float transition-all duration-300 sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100",
            isCurrentPlaying && "sm:translate-y-0 sm:opacity-100",
          )}
        >
          <Play className="size-4" />
        </span>
      </span>

      <span className="min-w-0 space-y-1 px-0.5 pb-1">
        <span
          className={cn(
            "block truncate text-sm font-semibold leading-snug",
            isCurrent && "text-primary",
          )}
        >
          {song.title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {song.artist || "Không rõ nghệ sĩ"}
        </span>
        <span className="flex items-center gap-1.5 pt-0.5">
          <Badge variant="outline" className="py-0 text-[10px]">
            {SOURCE_LABELS[song.sourceType]}
          </Badge>
          {song.playCount > 0 ? (
            <span className="truncate text-[10px] text-muted-foreground">
              {song.playCount} lượt
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

export function SongGrid({
  songs,
  queueLabel,
  emptyMessage = "Chưa có bài nhạc nào.",
}: {
  songs: SongDTO[];
  queueLabel?: string;
  emptyMessage?: string;
}) {
  if (songs.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {songs.map((song, index) => (
        <SongCard key={song.id} song={song} queue={songs} queueLabel={queueLabel} index={index} />
      ))}
    </div>
  );
}
