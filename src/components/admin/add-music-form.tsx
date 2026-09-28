"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Music2, Save, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { readAudioDuration } from "@/lib/audio";
import { SOURCE_LABELS, SOURCE_TYPES } from "@/lib/constants";
import { formatFileSize } from "@/lib/format";
import { fetchSoundCloudTrackInfo } from "@/lib/music/soundcloud-widget-client";
import type { GenreDTO, ResolvedMetadata, SourceType } from "@/types";

interface AddMusicFormProps {
  genres: GenreDTO[];
}

interface FormState {
  title: string;
  artist: string;
  album: string;
  description: string;
  durationSeconds: number;
  thumbnailUrl: string;
  sourceType: SourceType;
  sourceId: string;
  sourceUrl: string;
  streamUrl: string;
  embedUrl: string;
  playbackType: "EMBED" | "DIRECT";
  genreId: string;
  tags: string;
  isPublished: boolean;
  mimeType: string;
  fileSizeBytes: number | null;
  storageKey: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  artist: "",
  album: "",
  description: "",
  durationSeconds: 0,
  thumbnailUrl: "",
  sourceType: "YOUTUBE",
  sourceId: "",
  sourceUrl: "",
  streamUrl: "",
  embedUrl: "",
  playbackType: "EMBED",
  genreId: "",
  tags: "",
  isPublished: true,
  mimeType: "",
  fileSizeBytes: null,
  storageKey: "",
};

/** Tim the loai trong he thong khop voi ten the loai cua nen tang */
function matchGenreId(genreName: string | null | undefined, genres: GenreDTO[]): string | null {
  if (!genreName) return null;

  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  const target = normalize(genreName);
  if (!target) return null;

  const found = genres.find((genre) => {
    const name = normalize(genre.name);
    const slug = normalize(genre.slug);
    return name === target || slug === target || name.includes(target) || target.includes(name);
  });

  return found?.id ?? null;
}

export function AddMusicForm({ genres }: AddMusicFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [url, setUrl] = useState("");
  const [resolving, setResolving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function resolveMetadata() {
    if (!url.trim()) {
      toast.error("Vui lòng dán đường dẫn bài nhạc.");
      return;
    }

    setResolving(true);
    setWarnings([]);

    try {
      const response = await fetch("/api/metadata", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data?.error ?? "Không lấy được thông tin bài nhạc.");
        return;
      }

      const metadata = data as ResolvedMetadata;
      setWarnings(metadata.warnings ?? []);

      setForm((current) => ({
        ...current,
        title: metadata.title ?? current.title,
        artist: metadata.artist ?? "",
        album: metadata.album ?? "",
        description: current.description || metadata.description || "",
        durationSeconds: metadata.durationSeconds ?? 0,
        thumbnailUrl: metadata.thumbnailUrl ?? "",
        sourceType: metadata.sourceType,
        sourceId: metadata.sourceId ?? "",
        sourceUrl: metadata.sourceUrl,
        streamUrl: metadata.streamUrl ?? "",
        embedUrl: metadata.embedUrl,
        playbackType: metadata.playbackType,
        tags: current.tags || (metadata.tags?.join(", ") ?? ""),
        genreId: current.genreId || matchGenreId(metadata.genre, genres) || "",
      }));

      toast.success(`Đã lấy thông tin từ ${metadata.provider}.`);

      // SoundCloud: bo sung thoi luong va thong tin con thieu qua Widget API chinh thuc
      if (metadata.sourceType === "SOUNDCLOUD") {
        await enrichFromSoundCloudWidget(metadata.sourceUrl);
      }
    } finally {
      setResolving(false);
    }
  }

  /**
   * Doc them thong tin bai nhac SoundCloud bang Widget API chinh thuc
   * (chay ngay trong trinh duyet quan tri vien).
   */
  async function enrichFromSoundCloudWidget(trackUrl: string) {
    if (!trackUrl) return;

    setEnriching(true);

    try {
      const info = await fetchSoundCloudTrackInfo(trackUrl);

      if (!info || (!info.title && info.durationSeconds <= 0)) {
        setWarnings((current) => [
          ...current,
          "Không đọc được thêm thông tin từ SoundCloud Widget API. Bạn có thể nhập tay thời lượng — hệ thống cũng sẽ tự cập nhật khi bài nhạc được phát lần đầu.",
        ]);
        return;
      }

      setForm((current) => ({
        ...current,
        title: current.title || info.title || "",
        artist: current.artist || info.artist || "",
        thumbnailUrl: current.thumbnailUrl || info.artworkUrl || "",
        durationSeconds: info.durationSeconds > 0 ? info.durationSeconds : current.durationSeconds,
        genreId: current.genreId || matchGenreId(info.genre, genres) || "",
      }));

      toast.success("Đã bổ sung đầy đủ thông tin từ SoundCloud (bao gồm thời lượng).");
    } finally {
      setEnriching(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", "audio");

      const response = await fetch("/api/upload", { method: "POST", body });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data?.error ?? "Tải file thất bại.");
        return;
      }

      const duration = await readAudioDuration(file);

      setForm((current) => ({
        ...current,
        sourceType: "UPLOADED",
        playbackType: "DIRECT",
        title: current.title || file.name.replace(/\.[^.]+$/, ""),
        streamUrl: data.url,
        storageKey: data.key,
        mimeType: data.contentType,
        fileSizeBytes: data.size,
        embedUrl: "",
        sourceId: "",
        sourceUrl: "",
        durationSeconds: duration ?? current.durationSeconds,
      }));

      toast.success("Đã tải file nhạc lên hệ thống.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...form,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };

      const response = await fetch("/api/songs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const details = data?.details as Record<string, string> | undefined;
        toast.error(
          details ? Object.values(details)[0] : (data?.error ?? "Không thêm được bài nhạc."),
        );
        return;
      }

      toast.success("Đã thêm bài nhạc vào thư viện.");
      setForm(EMPTY_FORM);
      setUrl("");
      setWarnings([]);
      router.push("/admin/music");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Link2 className="size-4 text-primary" /> Lấy thông tin từ nền tảng
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Dán link YouTube / SoundCloud / TikTok..."
              />
              <Button
                type="button"
                variant="gradient"
                onClick={resolveMetadata}
                disabled={resolving}
              >
                {resolving ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Lấy thông tin
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Hệ thống dùng oEmbed/API chính thức của nền tảng (SoundCloud đọc thông tin công khai
              + Widget API). Không bóc tách DRM, không tải file trái phép.
            </p>

            {enriching ? (
              <p className="flex items-center gap-2 text-[11px] text-primary">
                <Loader2 className="size-3 animate-spin" /> Đang đọc thêm thông tin (thời lượng,
                ảnh bìa, thể loại) từ SoundCloud Widget API...
              </p>
            ) : null}

            {form.sourceType === "SOUNDCLOUD" && form.sourceUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={enriching}
                onClick={() => void enrichFromSoundCloudWidget(form.sourceUrl)}
              >
                {enriching ? <Loader2 className="animate-spin" /> : <Music2 />}
                Bổ sung thông tin từ SoundCloud
              </Button>
            ) : null}

            {warnings.length > 0 ? (
              <ul className="space-y-1 rounded-lg border border-warning/30 bg-warning-soft p-3 text-[11px] text-warning-soft-foreground">
                {warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Upload className="size-4 text-brand-sky" /> Hoặc tải file nhạc lên
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <Input
              type="file"
              accept="audio/*"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Hỗ trợ MP3, M4A, WAV, OGG, FLAC... Giới hạn dung lượng cấu hình qua biến
              UPLOAD_MAX_BYTES trong file .env.
            </p>
            {form.storageKey ? (
              <div className="rounded-lg border border-border/70 bg-surface/60 p-3 text-[11px]">
                <p className="truncate">File: {form.storageKey}</p>
                <p className="text-muted-foreground">
                  {formatFileSize(form.fileSizeBytes)} · {form.mimeType}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Thông tin bài nhạc</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="title">Tên bài nhạc *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="artist">Nghệ sĩ</Label>
              <Input
                id="artist"
                value={form.artist}
                onChange={(event) => update("artist", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="album">Album</Label>
              <Input
                id="album"
                value={form.album}
                onChange={(event) => update("album", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="genre">Thể loại</Label>
              <Select
                id="genre"
                value={form.genreId}
                onChange={(event) => update("genreId", event.target.value)}
                options={[
                  { value: "", label: "Chưa phân loại" },
                  ...genres.map((genre) => ({ value: genre.id, label: genre.name })),
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Thời lượng (giây)</Label>
              <Input
                id="duration"
                type="number"
                min={0}
                value={form.durationSeconds}
                onChange={(event) => update("durationSeconds", Number(event.target.value))}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="thumbnail">Ảnh bìa (đường dẫn)</Label>
              <Input
                id="thumbnail"
                value={form.thumbnailUrl}
                onChange={(event) => update("thumbnailUrl", event.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="tags">Thẻ (phân cách bằng dấu phẩy)</Label>
              <Input
                id="tags"
                value={form.tags}
                onChange={(event) => update("tags", event.target.value)}
                placeholder="chill, làm việc, 2026"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Nguồn phát</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{SOURCE_LABELS[form.sourceType]}</Badge>
              <Badge variant="outline">{form.playbackType}</Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-type">Loại nguồn</Label>
              <Select
                id="source-type"
                value={form.sourceType}
                onChange={(event) => {
                  const value = event.target.value as SourceType;
                  update("sourceType", value);
                  update("playbackType", value === "UPLOADED" ? "DIRECT" : "EMBED");
                }}
                options={(Object.keys(SOURCE_TYPES) as SourceType[]).map((type) => ({
                  value: type,
                  label: SOURCE_LABELS[type],
                }))}
              />
            </div>

            {form.embedUrl ? (
              <div className="space-y-1">
                <p className="text-muted-foreground">Đường dẫn nhúng</p>
                <p className="break-all rounded bg-surface/70 p-2 text-[10px]">{form.embedUrl}</p>
              </div>
            ) : null}

            {form.sourceUrl ? (
              <div className="space-y-1">
                <p className="text-muted-foreground">Đường dẫn gốc</p>
                <p className="break-all rounded bg-surface/70 p-2 text-[10px]">{form.sourceUrl}</p>
              </div>
            ) : null}

            {form.streamUrl ? (
              <div className="space-y-1">
                <p className="text-muted-foreground">Đường dẫn phát</p>
                <p className="break-all rounded bg-surface/70 p-2 text-[10px]">{form.streamUrl}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Xuất bản</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
              <div>
                <p className="text-sm">Phát hành ngay</p>
                <p className="text-[11px] text-muted-foreground">Nhân viên có thể nghe bài này</p>
              </div>
              <Switch
                checked={form.isPublished}
                onCheckedChange={(checked) => update("isPublished", checked)}
              />
            </div>

            <Button type="submit" variant="gradient" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {saving ? "Đang lưu..." : "Thêm vào thư viện"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
