"use client";

import Link from "next/link";
import { ListMusic, Play } from "lucide-react";

import { Artwork } from "@/components/ui/artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import type { PlaylistDTO } from "@/types";

export function PlaylistCard({ playlist, href }: { playlist: PlaylistDTO; href?: string }) {
  const target = href ?? `/music/playlists/${playlist.id}`;

  return (
    <Link
      href={target}
      className="group card-surface lift flex flex-col gap-3 rounded-2xl p-2.5"
    >
      <div className="art-frame aspect-square w-full">
        {playlist.coverUrl ? (
          <Artwork
            src={playlist.coverUrl}
            alt={playlist.name}
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center bg-gradient-to-br from-brand/20 to-brand-sky/10 text-3xl text-primary">
            <ListMusic />
          </span>
        )}

        {/* Chip so bai o goc bia */}
        <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white backdrop-blur-sm">
          {playlist.songCount} bài
        </span>

        {/* Nut phat: dien thoai luon hien, desktop hien khi hover */}
        <span className="bg-gradient-brand absolute bottom-2 right-2 flex size-10 translate-y-0 items-center justify-center rounded-full text-white opacity-100 shadow-float transition-all duration-300 sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100">
          <Play className="size-4" />
        </span>
      </div>

      <div className="min-w-0 space-y-1 px-0.5 pb-1">
        <p className="truncate text-sm font-semibold leading-snug">{playlist.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {playlist.songCount} bài · {formatDuration(playlist.totalDurationSeconds)}
        </p>
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          {playlist.isFeatured ? (
            <Badge variant="neon" className="py-0 text-[10px]">
              Nội bộ
            </Badge>
          ) : null}
          {playlist.isPublic && !playlist.isFeatured ? (
            <Badge variant="outline" className="py-0 text-[10px]">
              Công khai
            </Badge>
          ) : null}
          {!playlist.isPublic && !playlist.isFeatured ? (
            <Badge variant="secondary" className="py-0 text-[10px]">
              Riêng tư
            </Badge>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function PlaylistGrid({ playlists }: { playlists: PlaylistDTO[] }) {
  if (playlists.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
        Chưa có playlist nào.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {playlists.map((playlist) => (
        <PlaylistCard key={playlist.id} playlist={playlist} />
      ))}
    </div>
  );
}

export function PlaylistCreateHint() {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href="/music/playlists">
        <ListMusic /> Quản lý playlist
      </Link>
    </Button>
  );
}
