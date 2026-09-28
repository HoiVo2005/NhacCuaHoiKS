"use client";

import { Pause, Play, TrendingUp } from "lucide-react";

import { Artwork } from "@/components/ui/artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SOURCE_LABELS } from "@/lib/constants";
import { formatDuration, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import type { SongDTO } from "@/types";

/**
 * The "noi bat" trong hero trang chu: bia nhac khung lon + nut phat ngay.
 *
 * Y tuong thiet ke: trang chu chinh la SAN PHAM (khong phai trang gioi thieu) - nguoi dung
 * vao la bam phat duoc bai dang hot nhat ngay, khong can them thao tac nao.
 * La client component vi can dieu khien trinh phat toan cuc.
 */
export function HeroHighlight({ song, label = "Nổi bật hôm nay" }: { song: SongDTO; label?: string }) {
  const currentId = usePlayerStore((state) => state.current?.id);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isCurrent = currentId === song.id;
  const isCurrentPlaying = isCurrent && isPlaying;

  return (
    <div className="chip-glass animate-fade-up flex items-center gap-3 rounded-2xl p-2.5 shadow-soft sm:gap-4 sm:p-3">
      {/* Bia nhac: bam vao cung phat duoc */}
      <button
        type="button"
        onClick={() => usePlayerStore.getState().playQueue([song], 0, label)}
        className="art-frame group size-20 shrink-0 sm:size-24"
        title={isCurrentPlaying ? "Tạm dừng" : `Phát "${song.title}"`}
      >
        {song.thumbnailUrl ? (
          <Artwork src={song.thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center bg-gradient-to-br from-brand/25 to-brand-sky/15 text-2xl text-primary">
            ♪
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
          {isCurrentPlaying ? (
            <Pause className="size-5 text-white" />
          ) : (
            <Play className="size-5 text-white" />
          )}
        </span>
      </button>

      <div className="min-w-0 flex-1 space-y-1.5">
        <Badge variant="secondary" className="gap-1 py-0 text-[10px]">
          <TrendingUp className="size-3" /> {label}
        </Badge>
        <p className="truncate text-sm font-semibold leading-tight">{song.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {song.artist || "Không rõ nghệ sĩ"}
          {song.durationSeconds > 0 ? ` · ${formatDuration(song.durationSeconds)}` : ""}
          {song.playCount > 0 ? ` · ${formatNumber(song.playCount)} lượt nghe` : ""}
        </p>

        <div className="flex items-center gap-2 pt-0.5">
          <Button
            size="sm"
            variant="gradient"
            className="h-9 rounded-full px-3.5 sm:h-8"
            onClick={() => usePlayerStore.getState().playQueue([song], 0, label)}
          >
            {isCurrentPlaying ? <Pause /> : <Play />}
            {isCurrentPlaying ? "Tạm dừng" : "Phát ngay"}
          </Button>
          <span className="min-w-0 flex-1 truncate text-[10px] uppercase tracking-wide text-muted-foreground">
            {SOURCE_LABELS[song.sourceType]}
          </span>
        </div>
      </div>

      {/* Song nhac nhun nhay khi bai nay dang phat */}
      <span
        aria-hidden
        className={cn(
          "equalize-bars hidden shrink-0 transition-opacity sm:flex",
          isCurrentPlaying ? "opacity-100" : "opacity-0",
        )}
      >
        {["-0.15s", "-0.45s", "-0.7s"].map((delay) => (
          <span key={delay} style={{ animationDelay: delay }} />
        ))}
      </span>
    </div>
  );
}