"use client";

import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  ChevronDown,
  Loader2,
  MicVocal,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { useSessionUser } from "@/components/auth/session-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { findActiveLyricIndex, formatLyricTimestamp, LYRIC_MAX_OFFSET_MS, LYRIC_OFFSET_STEP_MS } from "@/lib/music/lyrics";
import { clampSeekTarget } from "@/lib/seek";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import type { LyricsResult } from "@/services/lyrics.service";

/** Sau khi người dùng tự cuộn, tạm dừng tự cuộn bấy nhiêu mili-giây (tránh "giành" thanh cuộn) */
const USER_SCROLL_PAUSE_MS = 4000;

/**
 * Lời bài hát trong trình phát đầy đủ: dòng đang hát được tô sáng và tự cuộn vào giữa,
 * bấm vào dòng để tua tới đúng chỗ. Quản trị viên có thể dán lời (LRC hoặc lời thường)
 * hoặc xoá cache để tra cứu lại.
 *
 * Lời được lưu trong CSDL (`song_lyrics`) nên mở lại bài là có ngay, không phải chờ mạng.
 */
export function LyricsPanel() {
  const open = usePlayerStore((state) => state.lyricsOpen);
  const current = usePlayerStore((state) => state.current);
  const progress = usePlayerStore((state) => state.progress);
  const duration = usePlayerStore((state) => state.duration);
  const { user } = useSessionUser();
  const isAdmin = user?.role === "ADMIN";

  /*
   * Trạng thái được gắn với MÃ BÀI (`songId`) để suy ra "đang tải / lỗi" mà KHÔNG cần gọi setState
   * đồng bộ trong effect (React khuyến nghị tránh — xem `react-hooks/set-state-in-effect`):
   * đổi bài thì dữ liệu cũ tự thành "chưa sẵn sàng" nên hiện khung đang tải.
   */
  const [data, setData] = useState<(LyricsResult & { songId: string }) | null>(null);
  const [failure, setFailure] = useState<{ songId: string; message: string } | null>(null);
  /** Chỉnh lệch khi lời chạy sớm/muộn so với nhạc (dương = lời hiện muộn hơn) */
  const [offset, setOffset] = useState<{ songId: string | null; ms: number }>({ songId: null, ms: 0 });
  const [reloadKey, setReloadKey] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastUserScrollAt = useRef(0);

  const songId = current?.id ?? null;

  /* Nạp lời khi mở bảng, khi đổi bài hoặc khi bấm "Tải lại" */
  useEffect(() => {
    if (!open || !songId) return;

    const controller = new AbortController();

    void (async () => {
      try {
        /* Quan tri vien bam "tai lai / van tra cuu" -> cho phep tra cuu ca bai dang bi bo qua */
        const force = isAdmin && reloadKey > 0;
        const response = await fetch(`/api/songs/${songId}/lyrics${force ? "?force=1" : ""}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as LyricsResult & { error?: string };

        if (!response.ok) throw new Error(payload.error ?? "Không tải được lời bài hát.");

        setData({ ...payload, songId });
        setFailure(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setFailure({
          songId,
          message: err instanceof Error ? err.message : "Không tải được lời bài hát.",
        });
      }
    })();

    return () => controller.abort();
  }, [open, songId, reloadKey, isAdmin]);

  const ready = Boolean(data && data.songId === songId);
  /*
   * Loi mang khi tra cuu cung hien nhu mot "loi co the thu lai" (khac voi "bai nay khong co loi"):
   * khoi loi se hien nut "Thu lai" thay vi noi sai rang khong co loi.
   */
  const failureMessage =
    failure && failure.songId === songId
      ? failure.message
      : ready && data?.unavailable
        ? "Tạm thời không kết nối được kho lời bài hát (LRCLIB). Bấm “Thử lại” để tải lại."
        : null;
  const loading = !ready && failureMessage === null;
  const offsetMs = offset.songId === songId ? offset.ms : 0;

  const lines = data?.lines ?? [];
  const positionMs = Math.max(0, Math.round(progress * 1000) - offsetMs);
  const activeIndex = findActiveLyricIndex(lines, positionMs);
  const totalDuration = duration > 0 ? duration : (current?.durationSeconds ?? 0);

  /* Tự cuộn dòng đang hát vào giữa khung (tạm dừng nếu người dùng vừa tự cuộn) */
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    if (Date.now() - lastUserScrollAt.current < USER_SCROLL_PAUSE_MS) return;

    const container = scrollRef.current;
    const line = lineRefs.current[activeIndex];
    if (!container || !line) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = line.offsetTop - container.clientHeight / 2 + line.clientHeight / 2;

    container.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
  }, [open, activeIndex]);

  if (!open || !current) return null;

  /** Bấm vào một dòng -> tua tới đúng mốc thời gian của dòng đó */
  function seekToLine(timeMs: number): void {
    usePlayerStore
      .getState()
      .requestSeekPosition(clampSeekTarget((timeMs + offsetMs) / 1000, totalDuration));
  }

  function nudge(deltaMs: number): void {
    if (!songId) return;

    const next = Math.min(Math.max(offsetMs + deltaMs, -LYRIC_MAX_OFFSET_MS), LYRIC_MAX_OFFSET_MS);
    setOffset({ songId, ms: next });
  }

  async function saveLyrics(): Promise<void> {
    if (!songId) return;
    setSaving(true);

    try {
      const response = await fetch(`/api/songs/${songId}/lyrics`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lyrics: draft }),
      });
      const payload = (await response.json().catch(() => ({}))) as LyricsResult & { error?: string };

      if (!response.ok) throw new Error(payload.error ?? "Không lưu được lời bài hát.");

      setData({ ...payload, songId });
      setFailure(null);
      setEditorOpen(false);
      toast.success(payload.synced ? "Đã lưu lời có mốc thời gian (karaoke)." : "Đã lưu lời bài hát.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không lưu được lời bài hát.");
    } finally {
      setSaving(false);
    }
  }

  /** Xoá cache rồi nạp lại: dùng khi lần trước chưa có lời hoặc lời bị sai */
  async function reloadLyrics(): Promise<void> {
    if (!songId) return;

    try {
      await fetch(`/api/songs/${songId}/lyrics`, { method: "DELETE" });
    } catch {
      /* Xoá cache lỗi cũng không sao: bước dưới vẫn gọi lại API để tra cứu */
    }

    setFailure(null);
    setReloadKey((value) => value + 1);
  }

  /** Mở trình soạn: điền sẵn lời hiện có (dạng LRC nếu đang có mốc thời gian) */
  function openEditor(): void {
    const synced = data?.synced
      ? lines.map((line) => `[${formatLyricTimestamp(line.timeMs)}]${line.text}`).join("\n")
      : "";

    setDraft(synced || data?.plain || "");
    setEditorOpen(true);
  }

  return (
    <>
      <section className="w-full rounded-2xl border border-border/70 bg-surface/50 p-3 sm:p-4">
        <header className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2.5">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <MicVocal className="size-4 text-primary" /> Lời bài hát
          </span>

          {ready && data ? (
            <Badge variant={data.synced ? "neon" : "secondary"}>
              {data.synced ? "Karaoke theo nhạc" : "Lời thường"}
            </Badge>
          ) : null}
          {ready && data?.confidence === "manual" ? (
            <Badge variant="outline">Quản trị viên dán</Badge>
          ) : null}
          {ready && data?.confidence === "exact" ? (
            <Badge variant="success">
              <BadgeCheck className="size-3" /> Đúng bài
            </Badge>
          ) : null}
          {ready && data?.confidence === "likely" ? (
            <Badge variant="warning">
              <TriangleAlert className="size-3" /> Khớp gần đúng
            </Badge>
          ) : null}
          {ready && data && (data.lines.length > 0 || data.plain) && data.matched.track ? (
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">
              Bản ghi khớp: {data.matched.track}
              {data.matched.artist ? ` — ${data.matched.artist}` : ""}
            </span>
          ) : null}

          <div className="ml-auto flex items-center gap-1">
            {/* Chỉnh lệch để lời khớp nhạc (một số bản thu chạy sớm/muộn hơn bản gốc) */}
            {ready && data?.synced ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => nudge(-LYRIC_OFFSET_STEP_MS)}
                  title={`Lời hiện sớm hơn ${LYRIC_OFFSET_STEP_MS / 1000} giây`}
                >
                  <Minus />
                </Button>
                <span
                  className="w-12 text-center text-[11px] tabular-nums text-muted-foreground"
                  title="Độ lệch giữa lời và nhạc"
                >
                  {offsetMs === 0 ? "khớp" : `${offsetMs > 0 ? "+" : "−"}${Math.abs(offsetMs) / 1000}s`}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => nudge(LYRIC_OFFSET_STEP_MS)}
                  title={`Lời hiện muộn hơn ${LYRIC_OFFSET_STEP_MS / 1000} giây`}
                >
                  <Plus />
                </Button>
              </>
            ) : null}

            {isAdmin ? (
              <>
                <Button variant="ghost" size="icon-sm" onClick={openEditor} title="Dán hoặc sửa lời bài hát">
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void reloadLyrics()}
                  title="Xoá cache và tra cứu lại từ đầu"
                >
                  <RefreshCw />
                </Button>
              </>
            ) : null}

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => usePlayerStore.getState().setLyricsOpen(false)}
              title="Đóng lời bài hát (Y)"
            >
              <ChevronDown />
            </Button>
          </div>
        </header>
        {ready && data?.confidence === "likely" ? (
          <p className="mt-3 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 text-[11px] text-warning-soft-foreground">
            Lời này mới khớp theo <strong>tên bài</strong> (bản remix/cover hoặc tên kênh nên không xác nhận
            được nghệ sĩ). Nếu thấy chưa đúng bản bạn đang nghe, quản trị viên có thể dán lại lời chính xác.
          </p>
        ) : null}

        {loading ? (
          <div className="space-y-2 py-6" aria-hidden>
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                className={cn(
                  "animate-shimmer mx-auto h-4 rounded bg-[length:220%_100%] bg-[linear-gradient(90deg,var(--surface)_0%,var(--surface-hover)_45%,var(--surface)_90%)]",
                  row % 2 === 0 ? "w-2/3" : "w-1/2",
                )}
              />
            ))}
            <p className="pt-1 text-center text-[11px] text-muted-foreground">
              <Loader2 className="mr-1 inline size-3 animate-spin" /> Đang tìm lời bài hát…
            </p>
          </div>
        ) : failureMessage ? (
          <div className="space-y-2 py-6 text-center">
            <p className="text-sm text-destructive">{failureMessage}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFailure(null);
                setReloadKey((value) => value + 1);
              }}
            >
              <RefreshCw /> Thử lại
            </Button>
          </div>
        ) : lines.length > 0 ? (
          <>
            <div
              ref={scrollRef}
              onScroll={() => {
                lastUserScrollAt.current = Date.now();
              }}
              className="scrollbar-thin relative mt-3 max-h-[42vh] overflow-y-auto py-6"
            >
              <div className="space-y-1">
                {lines.map((line, index) => (
                  <button
                    key={`${line.timeMs}-${index}`}
                    type="button"
                    ref={(element) => {
                      lineRefs.current[index] = element;
                    }}
                    onClick={() => seekToLine(line.timeMs)}
                    aria-current={index === activeIndex ? "true" : undefined}
                    className={cn(
                      "block w-full rounded-xl px-3 py-1.5 text-center text-sm transition",
                      index === activeIndex
                        ? "bg-primary/12 text-lg font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                    )}
                  >
                    {line.text}
                  </button>
                ))}
              </div>
            </div>

            <p className="border-t border-border/60 pt-2 text-center text-[11px] text-muted-foreground">
              Bấm vào một dòng để tua tới đó · Bấm <kbd className="rounded border border-border/70 px-1">Y</kbd> để
              đóng
            </p>
          </>
        ) : data?.plain ? (
          <div className="scrollbar-thin mt-3 max-h-[42vh] overflow-y-auto py-2">
            <p className="mb-2 text-center text-[11px] text-muted-foreground">
              Lời này không có mốc thời gian nên không tự chạy theo nhạc
              {isAdmin ? " — bạn có thể dán bản LRC có mốc [mm:ss.xx] để thành karaoke." : "."}
            </p>
            <pre className="whitespace-pre-wrap text-center font-sans text-sm leading-relaxed text-foreground/90">
              {data.plain}
            </pre>
          </div>
        ) : (
          <div className="space-y-2 py-6 text-center">
            <ScrollText className="mx-auto size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {data?.skipReason ? "Hệ thống không tự tìm lời cho bài này" : "Chưa tìm thấy lời cho bài này."}
            </p>
            {data?.skipReason ? (
              <p className="mx-auto max-w-md text-[11px] text-muted-foreground">
                {data.skipReason} Với các bài dạng liên khúc/mix/tuyển tập, tra cứu tự động rất dễ ra lời sai nên
                hệ thống chỉ tự tìm lời cho <strong>bài hát đơn</strong>. Quản trị viên vẫn có thể dán lời thủ công.
              </p>
            ) : null}
            {data?.rejected ? (
              <p className="mx-auto max-w-md text-[11px] text-muted-foreground">
                Có bản gần giống trên LRCLIB nhưng <strong>không đủ chắc chắn</strong> nên đã bỏ qua:{" "}
                {data.rejected.track}
                {data.rejected.artist ? ` — ${data.rejected.artist}` : ""}.
              </p>
            ) : null}
            <div className="flex flex-wrap justify-center gap-2">
              {data?.skipReason ? null : (
                <Button variant="outline" size="sm" onClick={() => void reloadLyrics()}>
                  <RefreshCw /> Tra cứu lại
                </Button>
              )}
              {isAdmin && data?.skipReason ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    /* `reloadKey > 0` -> request kèm `force=1` để thử tra cứu dù bài bị bỏ qua */
                    setFailure(null);
                    setReloadKey((value) => value + 1);
                  }}
                >
                  <RefreshCw /> Vẫn tra cứu
                </Button>
              ) : null}
              {isAdmin ? (
                <Button variant="gradient" size="sm" onClick={openEditor}>
                  <Pencil /> Dán lời thủ công
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-primary" /> Dán / sửa lời bài hát
            </DialogTitle>
            <DialogDescription>
              Dán lời thường, hoặc bản LRC có mốc thời gian <code>[mm:ss.xx]</code> để hiện kiểu karaoke
              (dòng đang hát được tô sáng và tự cuộn). Lời do bạn dán luôn được ưu tiên và không bị ghi đè
              bởi tra cứu tự động.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={14}
            placeholder={"Ví dụ:\n[00:12.00]Đoạn đầu của bài hát\n[00:16.50]Đoạn tiếp theo…"}
            className="min-h-[40vh] font-mono text-xs"
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              Huỷ
            </Button>
            <Button variant="gradient" disabled={saving} onClick={() => void saveLyrics()}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Lưu lời
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
