"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil, Search, Trash2 } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useRowSelection } from "@/hooks/use-row-selection";
import { SOURCE_LABELS, SOURCE_TYPES } from "@/lib/constants";
import { formatDuration, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GenreDTO, SongDTO, SourceType } from "@/types";

interface AdminSongsTableProps {
  initialSongs: SongDTO[];
  genres: GenreDTO[];
  total: number;
}

export function AdminSongsTable({ initialSongs, genres, total }: AdminSongsTableProps) {
  const router = useRouter();
  const [songs, setSongs] = useState(initialSongs);
  const [syncedSongs, setSyncedSongs] = useState(initialSongs);
  const [term, setTerm] = useState("");
  const [source, setSource] = useState("");
  const [editing, setEditing] = useState<SongDTO | null>(null);
  const [pending, setPending] = useState(false);

  // Server tra ve du lieu moi (router.refresh) => dong bo lai trong luc render
  if (syncedSongs !== initialSongs) {
    setSyncedSongs(initialSongs);
    setSongs(initialSongs);
  }

  const filtered = songs.filter((song) => {
    const keyword = term.trim().toLowerCase();
    const matchesTerm =
      keyword.length === 0 ||
      song.title.toLowerCase().includes(keyword) ||
      (song.artist ?? "").toLowerCase().includes(keyword);
    const matchesSource = !source || song.sourceType === source;
    return matchesTerm && matchesSource;
  });

  const selection = useRowSelection(filtered.map((song) => song.id));
  const confirm = useConfirm();

  async function togglePublished(song: SongDTO) {
    const response = await fetch(`/api/songs/${song.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isPublished: !song.isPublished }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(data?.error ?? "Không cập nhật được bài nhạc.");
      return;
    }

    setSongs((current) =>
      current.map((item) =>
        item.id === song.id ? { ...item, isPublished: !item.isPublished } : item,
      ),
    );
    toast.success(song.isPublished ? "Đã ẩn bài nhạc." : "Đã phát hành bài nhạc.");
    router.refresh();
  }

  async function removeSong(song: SongDTO) {
    const accepted = await confirm({
      title: "Xoá bài nhạc này?",
      description: "Bài nhạc sẽ bị xoá khỏi thư viện và không thể phục hồi.",
      highlights: [song.title],
      confirmLabel: "Xoá bài nhạc",
      variant: "danger",
    });

    if (!accepted) return;

    const response = await fetch(`/api/songs/${song.id}`, { method: "DELETE" });

    if (!response.ok && response.status !== 204) {
      toast.error("Không xoá được bài nhạc.");
      return;
    }

    setSongs((current) => current.filter((item) => item.id !== song.id));
    toast.success("Đã xoá bài nhạc.");
    router.refresh();
  }

  /** Xoá nhiều bài nhạc cùng lúc (chọn bằng checkbox hoặc xoá tất cả) */
  async function bulkDeleteSongs(ids: string[], title: string) {
    if (ids.length === 0) return;

    const selectedSongs = songs.filter((song) => ids.includes(song.id));
    const accepted = await confirm({
      title,
      description: `${selectedSongs.length} bài nhạc sẽ bị xoá khỏi thư viện. Hành động này không thể hoàn tác.`,
      highlights: selectedSongs.slice(0, 10).map((song) => song.title),
      confirmLabel: `Xoá ${selectedSongs.length} bài`,
      variant: "danger",
    });

    if (!accepted) return;

    const response = await fetch("/api/songs/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", ids }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(data?.error ?? "Không xoá được các bài nhạc đã chọn.");
      return;
    }

    const removed = new Set(ids);
    setSongs((current) => current.filter((song) => !removed.has(song.id)));
    selection.clear();
    toast.success(`Đã xoá ${data.affected ?? ids.length} bài nhạc.`);
    router.refresh();
  }

  /** Ẩn / phát hành nhiều bài nhạc cùng lúc */
  async function bulkSetPublished(ids: string[], isPublished: boolean) {
    if (ids.length === 0) return;

    const response = await fetch("/api/songs/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: isPublished ? "publish" : "unpublish", ids }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(data?.error ?? "Không cập nhật được các bài nhạc đã chọn.");
      return;
    }

    const changed = new Set(ids);
    setSongs((current) =>
      current.map((song) => (changed.has(song.id) ? { ...song, isPublished } : song)),
    );

    toast.success(
      isPublished
        ? `Đã phát hành ${data.affected ?? ids.length} bài nhạc.`
        : `Đã ẩn ${data.affected ?? ids.length} bài nhạc.`,
    );

    selection.clear();
    router.refresh();
  }

  async function saveSong(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const formData = new FormData(event.currentTarget);
    const payload = {
      title: String(formData.get("title") ?? ""),
      artist: String(formData.get("artist") ?? ""),
      album: String(formData.get("album") ?? ""),
      description: String(formData.get("description") ?? ""),
      thumbnailUrl: String(formData.get("thumbnailUrl") ?? ""),
      genreId: String(formData.get("genreId") ?? ""),
      tags: String(formData.get("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      isPublished: formData.get("isPublished") === "on",
      durationSeconds: Number(formData.get("durationSeconds") ?? 0),
    };

    setPending(true);

    try {
      const response = await fetch(`/api/songs/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data?.error ?? "Không lưu được thay đổi.");
        return;
      }

      setSongs((current) =>
        current.map((item) => (item.id === editing.id ? (data as SongDTO) : item)),
      );
      setEditing(null);
      toast.success("Đã cập nhật bài nhạc.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Tìm theo tên bài hoặc nghệ sĩ..."
            className="pl-9"
          />
        </div>

        <Select
          className="w-44"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          options={[
            { value: "", label: "Mọi nguồn" },
            ...(Object.keys(SOURCE_TYPES) as SourceType[]).map((type) => ({
              value: type,
              label: SOURCE_LABELS[type],
            })),
          ]}
        />

        <Badge variant="outline">
          Hiển thị {filtered.length}/{total} bài
        </Badge>

        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:border-destructive/40 hover:text-destructive"
          disabled={songs.length === 0}
          onClick={() => void bulkDeleteSongs(songs.map((song) => song.id), "Xoá toàn bộ thư viện nhạc?")}
        >
          <Trash2 /> Xoá tất cả ({songs.length})
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-surface/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2">
                <Checkbox
                  aria-label="Chọn tất cả bài nhạc đang hiển thị"
                  checked={selection.allSelected ? true : selection.someSelected ? "indeterminate" : false}
                  onCheckedChange={() => selection.toggleAll()}
                />
              </th>
              <th className="px-3 py-2 font-medium">Bài nhạc</th>
              <th className="px-3 py-2 font-medium">Nguồn</th>
              <th className="px-3 py-2 font-medium">Thể loại</th>
              <th className="px-3 py-2 font-medium">Thời lượng</th>
              <th className="px-3 py-2 font-medium">Lượt nghe</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filtered.map((song) => (
              <tr
                key={song.id}
                className={cn(
                  "hover:bg-surface-hover/60",
                  selection.selectedIds.includes(song.id) && "bg-primary/5",
                )}
              >
                <td className="px-3 py-2">
                  <Checkbox
                    aria-label={`Chọn bài ${song.title}`}
                    checked={selection.selectedIds.includes(song.id)}
                    onCheckedChange={() => selection.toggle(song.id)}
                  />
                </td>
                <td className="max-w-72 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {song.thumbnailUrl ? (
                       
                      <Artwork
                        src={song.thumbnailUrl}
                        alt=""
                        className="size-8 rounded object-cover"
                      />
                    ) : (
                      <span className="flex size-8 items-center justify-center rounded bg-surface text-xs">
                        ♪
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{song.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {song.artist || "Không rõ nghệ sĩ"}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">{SOURCE_LABELS[song.sourceType]}</td>
                <td className="px-3 py-2 text-xs">{song.genre?.name ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{formatDuration(song.durationSeconds)}</td>
                <td className="px-3 py-2 text-xs">{formatNumber(song.playCount)}</td>
                <td className="px-3 py-2">
                  <Badge variant={song.isPublished ? "success" : "warning"}>
                    {song.isPublished ? "Đang phát hành" : "Đã ẩn"}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void togglePublished(song)}
                      title={song.isPublished ? "Ẩn bài nhạc" : "Phát hành"}
                    >
                      {song.isPublished ? <EyeOff /> : <Eye />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing(song)}
                      title="Sửa thông tin"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hover:text-destructive"
                      onClick={() => void removeSong(song)}
                      title="Xoá bài nhạc"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Không có bài nhạc nào khớp bộ lọc.
          </p>
        ) : null}

        <BulkActionBar count={selection.count} onClear={selection.clear}>
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              void bulkDeleteSongs(selection.selectedIds, `Xoá ${selection.count} bài nhạc đã chọn?`)
            }
          >
            <Trash2 /> Xoá đã chọn
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void bulkSetPublished(selection.selectedIds, true)}
          >
            <Eye /> Phát hành
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void bulkSetPublished(selection.selectedIds, false)}
          >
            <EyeOff /> Ẩn
          </Button>
        </BulkActionBar>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa bài nhạc</DialogTitle>
            <DialogDescription>
              Cập nhật thông tin hiển thị. Nguồn phát và đường dẫn nhúng không thay đổi.
            </DialogDescription>
          </DialogHeader>

          {editing ? (
            <form onSubmit={saveSong} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-title">Tên bài nhạc</Label>
                  <Input id="edit-title" name="title" defaultValue={editing.title} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-artist">Nghệ sĩ</Label>
                  <Input id="edit-artist" name="artist" defaultValue={editing.artist ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-album">Album</Label>
                  <Input id="edit-album" name="album" defaultValue={editing.album ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-genre">Thể loại</Label>
                  <Select
                    id="edit-genre"
                    name="genreId"
                    defaultValue={editing.genreId ?? ""}
                    options={[
                      { value: "", label: "Chưa phân loại" },
                      ...genres.map((genre) => ({ value: genre.id, label: genre.name })),
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-duration">Thời lượng (giây)</Label>
                  <Input
                    id="edit-duration"
                    name="durationSeconds"
                    type="number"
                    min={0}
                    defaultValue={editing.durationSeconds}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-thumbnail">Ảnh bìa (đường dẫn)</Label>
                  <Input
                    id="edit-thumbnail"
                    name="thumbnailUrl"
                    defaultValue={editing.thumbnailUrl ?? ""}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-tags">Thẻ (phân cách bằng dấu phẩy)</Label>
                  <Input id="edit-tags" name="tags" defaultValue={editing.tags.join(", ")} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-description">Mô tả</Label>
                  <Textarea
                    id="edit-description"
                    name="description"
                    defaultValue={editing.description ?? ""}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                <div>
                  <p className="text-sm">Đang phát hành</p>
                  <p className="text-[11px] text-muted-foreground">
                    Nhân viên chỉ thấy các bài đã phát hành
                  </p>
                </div>
                <Switch name="isPublished" defaultChecked={editing.isPublished} />
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Huỷ
                </Button>
                <Button type="submit" variant="gradient" disabled={pending}>
                  {pending ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
