"use client";

import { Play, Shuffle } from "lucide-react";

import { SongRow } from "@/components/music/song-row";
import { Button } from "@/components/ui/button";
import { formatDuration, formatNumber } from "@/lib/format";
import { usePlayerStore } from "@/store/player-store";
import type { SongDTO } from "@/types";
import { cn } from "@/lib/utils";

interface SongListProps {
  songs: SongDTO[];
  label?: string;
  showHeader?: boolean;
  showIndex?: boolean;
  onRemove?: (song: SongDTO) => void;
  emptyMessage?: string;
  className?: string;
}

export function SongList({
  songs,
  label,
  showHeader = true,
  showIndex = true,
  onRemove,
  emptyMessage = "Chưa có bài nhạc nào.",
  className,
}: SongListProps) {
  if (songs.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const totalDuration = songs.reduce((total, song) => total + (song.durationSeconds || 0), 0);
  const totalPlays = songs.reduce((total, song) => total + song.playCount, 0);

  const playAll = () => usePlayerStore.getState().playQueue(songs, 0, label ?? "Danh sách phát");

  const playShuffled = () => {
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    usePlayerStore.getState().playQueue(shuffled, 0, `${label ?? "Danh sách"} (ngẫu nhiên)`);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {showHeader ? (
        <div className="chip-glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-3 py-2.5 shadow-soft">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{songs.length} bài</span> ·{" "}
            {formatDuration(totalDuration)}
            {totalPlays > 0 ? ` · ${formatNumber(totalPlays)} lượt nghe` : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="gradient" className="rounded-full" onClick={playAll}>
              <Play /> Phát tất cả
            </Button>
            <Button size="sm" variant="outline" className="rounded-full" onClick={playShuffled}>
              <Shuffle /> Ngẫu nhiên
            </Button>
          </div>
        </div>
      ) : null}

      <div className="divide-y divide-border/40">
        {songs.map((song, index) => (
          <SongRow
            key={`${song.id}-${index}`}
            song={song}
            index={index}
            queue={songs}
            queueLabel={label}
            showIndex={showIndex}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}
