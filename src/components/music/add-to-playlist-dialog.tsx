"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ListPlus, LogIn, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { useSessionUser } from "@/components/auth/session-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlaylistDTO } from "@/types";

interface AddToPlaylistDialogProps {
  songId: string;
  children?: React.ReactNode;
}

export function AddToPlaylistDialog({ songId, children }: AddToPlaylistDialogProps) {
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [creatingPending, setCreatingPending] = useState(false);

  const pathname = usePathname();
  const { isAuthenticated } = useSessionUser();

  useEffect(() => {
    if (!open || !isAuthenticated) return;

    let active = true;

    fetch("/api/playlists")
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((data: { items?: PlaylistDTO[] }) => {
        if (active) setPlaylists(data.items ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, isAuthenticated]);

  async function addTo(playlistId: string) {
    if (!isAuthenticated) {
      toast.info("Đăng nhập để lưu bài nhạc vào playlist nhé!");
      return;
    }

    try {
      const response = await fetch(`/api/playlists/${playlistId}/songs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ songId }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data?.error ?? "Không thêm được vào playlist.");
        return;
      }

      toast.success("Đã thêm bài nhạc vào playlist.");
      setOpen(false);
    } catch {
      toast.error("Lỗi kết nối, vui lòng thử lại.");
    }
  }

  async function createAndAdd() {
    if (newName.trim().length < 1) {
      toast.error("Vui lòng nhập tên playlist.");
      return;
    }

    setCreatingPending(true);

    try {
      const createResponse = await fetch("/api/playlists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), isPublic: false }),
      });

      const created = await createResponse.json().catch(() => ({}));

      if (!createResponse.ok) {
        toast.error(created?.error ?? "Không tạo được playlist.");
        return;
      }

      await addTo(created.id);
      setNewName("");
      setCreating(false);
    } finally {
      setCreatingPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="ghost" size="icon-sm" title="Thêm vào playlist">
            <ListPlus />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm vào playlist</DialogTitle>
          <DialogDescription>Chọn playlist có sẵn hoặc tạo playlist mới.</DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {!isAuthenticated ? (
            <div className="space-y-3 rounded-xl border border-border/70 bg-surface/60 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Đăng nhập để lưu bài nhạc vào playlist của bạn.
              </p>
              <Button asChild variant="gradient" size="sm" className="w-full">
                <Link href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}>
                  <LogIn className="size-4" /> Đăng nhập
                </Link>
              </Button>
            </div>
          ) : loading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Đang tải...</p>
          ) : playlists.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Bạn chưa có playlist nào.
            </p>
          ) : (
            playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => addTo(playlist.id)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-surface-hover"
              >
                <span className="truncate">{playlist.name}</span>
                <span className="text-xs text-muted-foreground">{playlist.songCount} bài</span>
              </button>
            ))
          )}
        </div>

        {!isAuthenticated ? null : creating ? (
          <div className="space-y-2 rounded-lg border border-border/70 p-3">
            <Label htmlFor="new-playlist-name">Tên playlist mới</Label>
            <Input
              id="new-playlist-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Ví dụ: Nhạc buổi chiều"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                Huỷ
              </Button>
              <Button size="sm" onClick={createAndAdd} disabled={creatingPending}>
                Tạo và thêm
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setCreating(true)}>
            <Plus /> Tạo playlist mới
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
