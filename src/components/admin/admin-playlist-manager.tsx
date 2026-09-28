"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FolderCog, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Artwork } from "@/components/ui/artwork";
import { Badge } from "@/components/ui/badge";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRowSelection } from "@/hooks/use-row-selection";
import { formatDuration } from "@/lib/format";
import type { PlaylistDTO, SongDTO } from "@/types";

export function AdminPlaylistManager({ initialPlaylists }: { initialPlaylists: PlaylistDTO[] }) {
  const router = useRouter();
  const [playlists, setPlaylists] = useState(initialPlaylists);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const selection = useRowSelection(playlists.map((playlist) => playlist.id));
  const confirm = useConfirm();

  const [addTarget, setAddTarget] = useState<PlaylistDTO | null>(null);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SongDTO[]>([]);
  const [searching, setSearching] = useState(false);

  async function createPlaylist() {
    if (name.trim().length === 0) {
      toast.error("Vui lòng nhập tên playlist.");
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/playlists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description, isPublic: true, isFeatured: true }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data?.error ?? "Không tạo được playlist.");
        return;
      }

      setPlaylists((current) => [data as PlaylistDTO, ...current]);
      setCreateOpen(false);
      setName("");
      setDescription("");
      toast.success("Đã tạo playlist nội bộ.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function toggleFeatured(playlist: PlaylistDTO) {
    const response = await fetch(`/api/playlists/${playlist.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isFeatured: !playlist.isFeatured }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(data?.error ?? "Không cập nhật được playlist.");
      return;
    }

    setPlaylists((current) =>
      current.map((item) => (item.id === playlist.id ? (data as PlaylistDTO) : item)),
    );
    toast.success("Đã cập nhật trạng thái playlist nội bộ.");
    router.refresh();
  }

  async function removePlaylist(playlist: PlaylistDTO) {
    const accepted = await confirm({
      title: "Xoá playlist này?",
      description: "Playlist và danh sách bài bên trong sẽ bị xoá. Bài nhạc trong thư viện vẫn được giữ.",
      highlights: [`${playlist.name} · ${playlist.songCount} bài`],
      confirmLabel: "Xoá playlist",
      variant: "danger",
    });

    if (!accepted) return;

    const response = await fetch(`/api/playlists/${playlist.id}`, { method: "DELETE" });

    if (!response.ok && response.status !== 204) {
      toast.error("Không xoá được playlist.");
      return;
    }

    setPlaylists((current) => current.filter((item) => item.id !== playlist.id));
    toast.success("Đã xoá playlist.");
    router.refresh();
  }

  /** Xoá nhiều playlist cùng lúc (tick chọn hoặc xoá tất cả) */
  async function removePlaylists(ids: string[], title: string) {
    if (ids.length === 0) return;

    const accepted = await confirm({
      title,
      description: `${ids.length} playlist sẽ bị xoá. Bài nhạc trong thư viện vẫn được giữ.`,
      highlights: playlists
        .filter((playlist) => ids.includes(playlist.id))
        .slice(0, 10)
        .map((playlist) => playlist.name),
      confirmLabel: `Xoá ${ids.length} playlist`,
      variant: "danger",
    });

    if (!accepted) return;

    const response = await fetch("/api/playlists/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", ids }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(data?.error ?? "Không xoá được các playlist đã chọn.");
      return;
    }

    const removed = new Set(ids);
    setPlaylists((current) => current.filter((playlist) => !removed.has(playlist.id)));
    selection.clear();
    toast.success(`Đã xoá ${data.affected ?? ids.length} playlist.`);
    router.refresh();
  }

  async function searchSongs(value: string) {
    setTerm(value);

    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);

    try {
      const response = await fetch(
        `/api/songs?q=${encodeURIComponent(value.trim())}&pageSize=8&scope=all`,
      );
      const data = await response.json().catch(() => ({ items: [] }));
      setResults((data.items ?? []) as SongDTO[]);
    } finally {
      setSearching(false);
    }
  }

  async function addSong(song: SongDTO) {
    if (!addTarget) return;

    const response = await fetch(`/api/playlists/${addTarget.id}/songs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ songId: song.id }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(data?.error ?? "Không thêm được bài nhạc.");
      return;
    }

    setPlaylists((current) =>
      current.map((item) =>
        item.id === addTarget.id
          ? { ...item, songCount: item.songCount + 1 }
          : item,
      ),
    );
    toast.success(`Đã thêm "${song.title}" vào ${addTarget.name}.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderCog className="size-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Playlist nội bộ</h1>
            <p className="text-sm text-muted-foreground">
              {playlists.length} playlist · playlist có nhãn “Nội bộ” sẽ hiển thị trên trang chủ
              của nhân viên
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {playlists.length > 0 ? (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
              <Checkbox
                aria-label="Chọn tất cả playlist"
                checked={selection.allSelected ? true : selection.someSelected ? "indeterminate" : false}
                onCheckedChange={() => selection.toggleAll()}
              />
              Chọn tất cả
            </label>
          ) : null}

          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:border-destructive/40 hover:text-destructive"
            disabled={playlists.length === 0}
            onClick={() =>
              void removePlaylists(
                playlists.map((playlist) => playlist.id),
                "Xoá toàn bộ playlist nội bộ?",
              )
            }
          >
            <Trash2 /> Xoá tất cả ({playlists.length})
          </Button>

          <Button size="sm" variant="gradient" onClick={() => setCreateOpen(true)}>
            <Plus /> Tạo playlist nội bộ
          </Button>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {playlists.map((playlist) => (
          <div
            key={playlist.id}
            className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <Checkbox
                  aria-label={`Chọn playlist ${playlist.name}`}
                  className="mt-0.5"
                  checked={selection.selectedIds.includes(playlist.id)}
                  onCheckedChange={() => selection.toggle(playlist.id)}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{playlist.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {playlist.songCount} bài · {formatDuration(playlist.totalDurationSeconds)} ·{" "}
                    {playlist.ownerName}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {playlist.isFeatured ? (
                  <Badge variant="neon" className="py-0 text-[10px]">
                    Nội bộ
                  </Badge>
                ) : (
                  <Badge variant="outline" className="py-0 text-[10px]">
                    Cá nhân
                  </Badge>
                )}
                {playlist.isPublic ? (
                  <Badge variant="success" className="py-0 text-[10px]">
                    Công khai
                  </Badge>
                ) : null}
              </div>
            </div>

            {playlist.description ? (
              <p className="line-clamp-2 text-[11px] text-muted-foreground">
                {playlist.description}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setAddTarget(playlist)}>
                <Plus /> Thêm bài nhạc
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void toggleFeatured(playlist)}>
                <Sparkles /> {playlist.isFeatured ? "Bỏ nhãn nội bộ" : "Đặt làm nội bộ"}
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/music/playlists/${playlist.id}`}>Xem</Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="hover:text-destructive"
                onClick={() => void removePlaylist(playlist)}
              >
                <Trash2 /> Xoá
              </Button>
            </div>
          </div>
        ))}
      </div>

      <BulkActionBar count={selection.count} onClear={selection.clear}>
        <Button
          size="sm"
          variant="destructive"
          onClick={() =>
            void removePlaylists(selection.selectedIds, `Xoá ${selection.count} playlist đã chọn?`)
          }
        >
          <Trash2 /> Xoá đã chọn
        </Button>
      </BulkActionBar>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo playlist nội bộ</DialogTitle>
            <DialogDescription>
              Playlist này sẽ được chia sẻ cho toàn bộ nhân viên và hiển thị ở trang chủ.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-playlist-name">Tên playlist</Label>
              <Input
                id="admin-playlist-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ví dụ: Nhạc công ty tháng 9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-playlist-description">Mô tả</Label>
              <Textarea
                id="admin-playlist-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Huỷ
            </Button>
            <Button variant="gradient" onClick={createPlaylist} disabled={pending}>
              {pending ? "Đang tạo..." : "Tạo playlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(addTarget)} onOpenChange={(open) => !open && setAddTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm bài nhạc vào “{addTarget?.name}”</DialogTitle>
            <DialogDescription>
              Tìm bài nhạc trong thư viện rồi bấm “Thêm” để đưa vào playlist.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => void searchSongs(event.target.value)}
              placeholder="Nhập tên bài nhạc hoặc nghệ sĩ..."
              className="pl-9"
            />
          </div>

          <div className="max-h-72 space-y-1 overflow-y-auto">
            {searching ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Đang tìm...</p>
            ) : results.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nhập ít nhất 2 ký tự để tìm bài nhạc.
              </p>
            ) : (
              results.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-hover"
                >
                  {song.thumbnailUrl ? (
                     
                    <Artwork
                      src={song.thumbnailUrl}
                      alt=""
                      className="size-9 rounded object-cover"
                    />
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded bg-surface text-xs">
                      ♪
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{song.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {song.artist || "Không rõ nghệ sĩ"} · {formatDuration(song.durationSeconds)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void addSong(song)}>
                    Thêm
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddTarget(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
