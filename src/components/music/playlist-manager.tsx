"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListMusic, Lock, MoreVertical, Plus, Trash2, Unlock } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/music/empty-state";
import { Artwork } from "@/components/ui/artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration } from "@/lib/format";
import type { PlaylistDTO } from "@/types";

export function PlaylistManager({ initialPlaylists }: { initialPlaylists: PlaylistDTO[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [playlists, setPlaylists] = useState(initialPlaylists);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

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
        body: JSON.stringify({ name: name.trim(), description, isPublic }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data?.error ?? "Không tạo được playlist.");
        return;
      }

      setPlaylists((current) => [data as PlaylistDTO, ...current]);
      setOpen(false);
      setName("");
      setDescription("");
      setIsPublic(false);
      toast.success("Đã tạo playlist mới.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function togglePublic(playlist: PlaylistDTO) {
    const response = await fetch(`/api/playlists/${playlist.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isPublic: !playlist.isPublic }),
    });

    if (!response.ok) {
      toast.error("Không cập nhật được playlist.");
      return;
    }

    const updated = (await response.json()) as PlaylistDTO;
    setPlaylists((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    toast.success(
      updated.isPublic ? "Playlist đã được chia sẻ nội bộ." : "Playlist đã chuyển riêng tư.",
    );
  }

  async function removePlaylist(playlist: PlaylistDTO) {
    const accepted = await confirm({
      title: "Xoá playlist này?",
      description: "Playlist và danh sách bài bên trong sẽ bị xoá. Bài nhạc trong thư viện vẫn được giữ.",
      highlights: [`${playlist.name} · ${playlist.songCount} bài`],
      confirmLabel: "Xoá playlist",
      variant: "danger",
    });

    if (!accepted) {
      return;
    }

    const response = await fetch(`/api/playlists/${playlist.id}`, { method: "DELETE" });

    if (!response.ok && response.status !== 204) {
      toast.error("Không xoá được playlist.");
      return;
    }

    setPlaylists((current) => current.filter((item) => item.id !== playlist.id));
    toast.success("Đã xoá playlist.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListMusic className="size-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Playlist của tôi</h1>
            <p className="text-sm text-muted-foreground">
              {playlists.length} playlist · tạo và quản lý danh sách phát cá nhân
            </p>
          </div>
        </div>

        <Button variant="gradient" size="sm" onClick={() => setOpen(true)}>
          <Plus /> Tạo playlist
        </Button>
      </header>

      {playlists.length === 0 ? (
        <EmptyState
          title="Chưa có playlist nào"
          description="Tạo playlist để gom những bài nhạc bạn thường nghe."
          action={
            <Button size="sm" variant="gradient" onClick={() => setOpen(true)}>
              <Plus /> Tạo playlist đầu tiên
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-3 transition hover:border-primary/40"
            >
              <Link
                href={`/music/playlists/${playlist.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-brand/15 to-brand-sky/10">
                  {playlist.coverUrl ? (
                    <Artwork src={playlist.coverUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <ListMusic className="size-5 text-primary/70 dark:text-white/70" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{playlist.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {playlist.songCount} bài · {formatDuration(playlist.totalDurationSeconds)}
                  </span>
                  <span className="mt-1 inline-flex gap-1">
                    {playlist.isPublic ? (
                      <Badge variant="success" className="py-0 text-[10px]">
                        <Unlock className="size-2.5" /> Nội bộ
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="py-0 text-[10px]">
                        <Lock className="size-2.5" /> Riêng tư
                      </Badge>
                    )}
                  </span>
                </span>
              </Link>

              <Dropdown
                trigger={
                  <Button variant="ghost" size="icon-sm" title="Tuỳ chọn">
                    <MoreVertical />
                  </Button>
                }
              >
                <DropdownItem onSelect={() => void togglePublic(playlist)}>
                  {playlist.isPublic ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                  {playlist.isPublic ? "Chuyển thành riêng tư" : "Chia sẻ nội bộ"}
                </DropdownItem>
                <DropdownItem destructive onSelect={() => void removePlaylist(playlist)}>
                  <Trash2 className="size-4" /> Xoá playlist
                </DropdownItem>
              </Dropdown>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo playlist mới</DialogTitle>
            <DialogDescription>
              Playlist riêng tư chỉ bạn thấy. Chia sẻ nội bộ để đồng nghiệp cùng nghe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="playlist-name">Tên playlist</Label>
              <Input
                id="playlist-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ví dụ: Nhạc tập trung buổi sáng"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="playlist-description">Mô tả</Label>
              <Textarea
                id="playlist-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Mô tả ngắn (không bắt buộc)"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
              <div>
                <p className="text-sm">Chia sẻ nội bộ</p>
                <p className="text-[11px] text-muted-foreground">
                  Mọi nhân viên đều có thể xem playlist này
                </p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button variant="gradient" onClick={createPlaylist} disabled={pending}>
              {pending ? "Đang tạo..." : "Tạo playlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}