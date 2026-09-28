"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, ListMusic, Lock, Play, Trash2, Unlock } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/music/empty-state";
import { SongRow } from "@/components/music/song-row";
import { Artwork } from "@/components/ui/artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useListReorder } from "@/hooks/use-list-reorder";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import type { PlaylistDetailDTO, SongDTO } from "@/types";

export function PlaylistDetailView({
  playlist,
  isOwner,
}: {
  playlist: PlaylistDetailDTO;
  isOwner: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [songs, setSongs] = useState(playlist.songs);
  const listRef = useRef<HTMLUListElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const totalDuration = songs.reduce((total, song) => total + (song.durationSeconds || 0), 0);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  /** Luu thu tu moi len server (gom nhieu lan keo lien tuc thanh 1 request) */
  function scheduleOrderSave(orderedSongs: SongDTO[]) {
    if (!isOwner) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    saveTimerRef.current = window.setTimeout(() => {
      void fetch(`/api/playlists/${playlist.id}/songs`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ songIds: orderedSongs.map((song) => song.id) }),
      })
        .then((response) => {
          if (!response.ok) {
            toast.error("Không lưu được thứ tự mới, vui lòng thử lại.");
            return;
          }
          toast.success("Đã lưu thứ tự bài nhạc trong playlist.");
          router.refresh();
        })
        .catch(() => toast.error("Không lưu được thứ tự mới."));
    }, 700);
  }

  function handleMove(from: number, to: number) {
    const next = [...songs];
    if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return;

    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    setSongs(next);
    scheduleOrderSave(next);
  }

  const { draggingIndex, setItemRef, dragHandleProps } = useListReorder({
    itemCount: songs.length,
    onMove: handleMove,
    scrollContainerRef: listRef as React.RefObject<HTMLElement | null>,
  });

  async function removeSong(song: SongDTO) {
    const response = await fetch(`/api/playlists/${playlist.id}/songs/${song.id}`, {
      method: "DELETE",
    });

    if (!response.ok && response.status !== 204) {
      toast.error("Không xoá được bài nhạc khỏi playlist.");
      return;
    }

    setSongs((current) => current.filter((item) => item.id !== song.id));
    toast.success("Đã xoá bài nhạc khỏi playlist.");
    router.refresh();
  }

  async function deletePlaylist() {
    const accepted = await confirm({
      title: "Xoá playlist này?",
      description: "Playlist và danh sách bài bên trong sẽ bị xoá. Bài nhạc trong thư viện vẫn được giữ.",
      highlights: [playlist.name],
      confirmLabel: "Xoá playlist",
      variant: "danger",
    });

    if (!accepted) return;

    const response = await fetch(`/api/playlists/${playlist.id}`, { method: "DELETE" });

    if (!response.ok && response.status !== 204) {
      toast.error("Không xoá được playlist.");
      return;
    }

    toast.success("Đã xoá playlist.");
    router.push("/music/playlists");
    router.refresh();
  }

  async function togglePublic() {
    const response = await fetch(`/api/playlists/${playlist.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isPublic: !playlist.isPublic }),
    });

    if (!response.ok) {
      toast.error("Không cập nhật được playlist.");
      return;
    }

    toast.success("Đã cập nhật chế độ chia sẻ.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-5 sm:flex-row sm:items-end">
        <span className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand/15 to-brand-sky/10">
          {playlist.coverUrl ? (
             
            <Artwork src={playlist.coverUrl} alt="" className="size-full object-cover" />
          ) : (
            <ListMusic className="size-8 text-primary/70 dark:text-white/70" />
          )}
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={playlist.isPublic ? "success" : "outline"}>
              {playlist.isPublic ? (
                <>
                  <Unlock className="size-3" /> Chia sẻ nội bộ
                </>
              ) : (
                <>
                  <Lock className="size-3" /> Riêng tư
                </>
              )}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {songs.length} bài · {formatDuration(totalDuration)} · {playlist.ownerName}
            </span>
          </div>

          <h1 className="text-2xl font-semibold">{playlist.name}</h1>
          {playlist.description ? (
            <p className="text-sm text-muted-foreground">{playlist.description}</p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="gradient"
              disabled={songs.length === 0}
              onClick={() => usePlayerStore.getState().playQueue(songs, 0, playlist.name)}
            >
              <Play /> Phát playlist
            </Button>
            {isOwner ? (
              <>
                <Button size="sm" variant="outline" onClick={togglePublic}>
                  {playlist.isPublic ? "Chuyển riêng tư" : "Chia sẻ nội bộ"}
                </Button>
                <Button size="sm" variant="outline" onClick={deletePlaylist}>
                  <Trash2 /> Xoá playlist
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {isOwner && songs.length > 1 ? (
        <p className="rounded-lg border border-border/60 bg-surface/50 px-3 py-2 text-[11px] text-muted-foreground">
          Mẹo: kéo tay cầm <span className="text-primary">⠿</span> ở mỗi bài để ưu tiên bài bạn
          thích lên trên — thứ tự mới được lưu tự động.
        </p>
      ) : null}

      {songs.length === 0 ? (
        <EmptyState
          title="Playlist đang trống"
          description="Thêm bài nhạc bằng nút “Thêm vào playlist” ở mỗi bài hát."
        />
      ) : (
        <ul ref={listRef} className="divide-y divide-border/40">
          {songs.map((song, index) => (
            <li
              key={song.id}
              ref={setItemRef(index)}
              className={cn(
                "flex items-center gap-0.5 transition",
                draggingIndex === index && "rounded-lg bg-primary/15 ring-1 ring-primary/50",
              )}
            >
              {isOwner ? (
                <button
                  type="button"
                  {...dragHandleProps(index)}
                  aria-label="Kéo để sắp xếp lại"
                  title="Kéo để ưu tiên bài này lên trên (hoặc dùng phím ↑ ↓)"
                  className="shrink-0 cursor-grab rounded-md p-1 text-muted-foreground/70 transition hover:bg-surface-hover hover:text-foreground active:cursor-grabbing"
                >
                  <GripVertical className="size-4" />
                </button>
              ) : null}

              <div className="min-w-0 flex-1">
                <SongRow
                  song={song}
                  index={index}
                  queue={songs}
                  queueLabel={playlist.name}
                  onRemove={isOwner ? () => void removeSong(song) : undefined}
                  removeLabel="Xoá khỏi playlist"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
