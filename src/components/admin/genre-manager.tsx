"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_GENRE_COLOR } from "@/lib/constants";
import type { GenreDTO } from "@/types";

export function GenreManager({ initialGenres }: { initialGenres: GenreDTO[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [genres, setGenres] = useState(initialGenres);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GenreDTO | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_GENRE_COLOR);
  const [pending, setPending] = useState(false);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setColor(DEFAULT_GENRE_COLOR);
    setOpen(true);
  }

  function openEdit(genre: GenreDTO) {
    setEditing(genre);
    setName(genre.name);
    setDescription(genre.description ?? "");
    setColor(genre.color ?? DEFAULT_GENRE_COLOR);
    setOpen(true);
  }

  async function save() {
    if (name.trim().length === 0) {
      toast.error("Vui lòng nhập tên thể loại.");
      return;
    }

    setPending(true);

    try {
      const response = await fetch(editing ? `/api/genres/${editing.id}` : "/api/genres", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description, color }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data?.error ?? "Không lưu được thể loại.");
        return;
      }

      const saved = data as GenreDTO;
      setGenres((current) =>
        editing
          ? current.map((item) => (item.id === saved.id ? { ...item, ...saved } : item))
          : [...current, saved].sort((a, b) => a.name.localeCompare(b.name)),
      );

      setOpen(false);
      toast.success(editing ? "Đã cập nhật thể loại." : "Đã thêm thể loại mới.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function remove(genre: GenreDTO) {
    const accepted = await confirm({
      title: "Xoá thể loại này?",
      description: "Các bài nhạc đang thuộc thể loại này sẽ chuyển thành “Chưa phân loại”.",
      highlights: [genre.name],
      confirmLabel: "Xoá thể loại",
      variant: "danger",
    });

    if (!accepted) return;

    const response = await fetch(`/api/genres/${genre.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok && response.status !== 204) {
      toast.error(data?.error ?? "Không xoá được thể loại.");
      return;
    }

    setGenres((current) => current.filter((item) => item.id !== genre.id));
    toast.success("Đã xoá thể loại.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tags className="size-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Thể loại nhạc</h1>
            <p className="text-sm text-muted-foreground">
              {genres.length} thể loại · dùng để phân loại và thống kê thư viện
            </p>
          </div>
        </div>

        <Button size="sm" variant="gradient" onClick={openCreate}>
          <Plus /> Thêm thể loại
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {genres.map((genre) => (
          <Card key={genre.id}>
            <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: genre.color ?? DEFAULT_GENRE_COLOR }}
                />
                {genre.name}
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(genre)}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:text-destructive"
                  onClick={() => void remove(genre)}
                >
                  <Trash2 />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              <p>{genre.description || "Chưa có mô tả."}</p>
              <p className="mt-2">
                <span className="text-foreground">{genre.songCount ?? 0}</span> bài nhạc · slug:{" "}
                {genre.slug}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa thể loại" : "Thêm thể loại"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="genre-name">Tên thể loại</Label>
              <Input
                id="genre-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ví dụ: Nhạc Việt"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="genre-description">Mô tả</Label>
              <Textarea
                id="genre-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="genre-color">Màu hiển thị</Label>
              <div className="flex items-center gap-3">
                <input
                  id="genre-color"
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-10 w-16 cursor-pointer rounded border border-input bg-transparent"
                />
                <Input value={color} onChange={(event) => setColor(event.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button variant="gradient" onClick={save} disabled={pending}>
              {pending ? "Đang lưu..." : "Lưu thể loại"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
