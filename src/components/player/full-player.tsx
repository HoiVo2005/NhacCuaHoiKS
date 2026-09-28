"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ListMusic,
  ListPlus,
  MicVocal,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

import { AddToPlaylistDialog } from "@/components/music/add-to-playlist-dialog";
import { FavoriteButton } from "@/components/music/favorite-button";
import { LyricsPanel } from "@/components/player/lyrics-panel";
import { MixButton } from "@/components/player/mix-button";
import { RangeInput } from "@/components/player/range-input";
import { registerVideoSlot } from "@/components/player/video-stage";
import { Artwork } from "@/components/ui/artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLAYER_CAPABILITIES, SOURCE_LABELS } from "@/lib/constants";
import { formatDuration, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  canBoostVolume,
  clampVolumeFor,
  formatVolumePercent,
  isBoosted,
  maxVolumeFor,
  VOLUME_MARKER_PERCENT,
  VOLUME_STEP,
} from "@/lib/volume";
import { usePlayerStore } from "@/store/player-store";

export function FullPlayer() {
  const open = usePlayerStore((state) => state.fullPlayerOpen);
  const current = usePlayerStore((state) => state.current);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const progress = usePlayerStore((state) => state.progress);
  const duration = usePlayerStore((state) => state.duration);
  const volume = usePlayerStore((state) => state.volume);
  const muted = usePlayerStore((state) => state.muted);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const repeat = usePlayerStore((state) => state.repeat);
  const videoMode = usePlayerStore((state) => state.videoMode);
  const lyricsOpen = usePlayerStore((state) => state.lyricsOpen);

  // Trong luc keo, thanh thoi gian lay gia tri nguoi dung dang keo; hai state duoc dat
  // cung luc (mot batch) nen khong bi nhay ve vi tri cu khi dong co bao tien do xen vao.
  const [seekValue, setSeekValue] = useState(progress);
  const [isSeeking, setIsSeeking] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const videoSlotRef = useRef<HTMLDivElement | null>(null);

  const hasVideo = current ? current.sourceType !== "UPLOADED" : false;
  const showVideo = hasVideo && videoMode === "full";

  // Khi dong trinh phat day du: cho phep dong bang phim Esc
  useEffect(() => {
    if (!open) return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") usePlayerStore.getState().toggleFullPlayer();
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [open]);

  /**
   * Dang ky "o cho video" de khung video that (position: fixed - xem `video-stage.ts`)
   * bam theo va cuon len/xuong cung noi dung. Phai dang ky trong effect vi o cho nam
   * trong vung cuon: ref cua con chay truoc ref cua cha nen vung cuon chua san sang.
   */
  useEffect(() => {
    if (!open || !showVideo) return;

    registerVideoSlot(videoSlotRef.current, scrollAreaRef.current);
    return () => registerVideoSlot(null, null);
  }, [open, showVideo]);

  if (!open || !current) return null;

  const capabilities = PLAYER_CAPABILITIES[current.sourceType];
  const totalDuration = duration > 0 ? duration : current.durationSeconds;
  const seekBarValue = isSeeking ? seekValue : progress;

  /**
   * Am luong hien thi/keo: chi toi muc toi da THUC TE cua nguon dang phat.
   * Nguon nhung (YouTube/SoundCloud/TikTok) bi nen tang chan o 100%, nen thanh truot
   * khong con dai 0..200% (doan 100%..200% truoc day keo ma khong to hon -> tuong loi).
   */
  const volumeMax = maxVolumeFor(current.sourceType);
  const canBoost = canBoostVolume(current.sourceType);
  const displayVolume = clampVolumeFor(current.sourceType, volume);

  function handleSeekChange(value: number): void {
    setIsSeeking(true);
    setSeekValue(value);
  }

  /** Tha thanh truot -> ghi y dinh tua vao store; dong co phat thuc hien */
  function handleSeekCommit(value: number): void {
    setIsSeeking(false);
    usePlayerStore.getState().requestSeekPosition(value);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl">
      <header className="safe-top flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="text-gradient shrink-0 text-sm font-semibold">Đang phát</span>
          <span className="shrink-0">·</span>
          <span className="truncate">
            {current.genre?.name ?? SOURCE_LABELS[current.sourceType]}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-9 shrink-0"
          onClick={() => usePlayerStore.getState().toggleFullPlayer()}
          title="Đóng trình phát (Esc)"
        >
          <ChevronDown />
        </Button>
      </header>

      {/*
        Vung cuon cua trinh phat day du. `scrollAreaRef` duoc dang ky cung "o cho video"
        de khung video bi cat bot khi cuon ra ngoai vung nay (khong de len header).
      */}
      <div
        ref={scrollAreaRef}
        className="scrollbar-thin safe-bottom flex-1 overflow-y-auto px-4 pb-44"
      >
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 sm:gap-6">
          {/*
            "O cho video": khung aspect-video trong suot nam trong luong trang. Khung video
            that (iframe/widget o goc trang) bam theo o cho nay nen cuon len/xuong cung noi
            dung thay vi dung yen tren man hinh - xem `video-stage.ts`.
          */}
          <div
            ref={videoSlotRef}
            className={cn(
              "flex w-full items-center justify-center overflow-hidden rounded-2xl border border-border-strong bg-surface",
              showVideo
                ? "aspect-video opacity-0"
                : "aspect-square max-h-[46vh] sm:aspect-video sm:max-h-none",
            )}
          >
            {current.thumbnailUrl ? (
               
              <Artwork
                src={current.thumbnailUrl}
                alt={current.title}
                className="size-full object-cover"
              />
            ) : (
              <span className="text-6xl text-muted-foreground">♪</span>
            )}
          </div>

          <div className="w-full space-y-2 px-1 text-center">
            <h2 className="text-balance text-xl font-semibold leading-tight sm:text-2xl">
              {current.title}
            </h2>
            <p className="truncate text-sm text-muted-foreground">
              {current.artist || "Không rõ nghệ sĩ"}
              {current.album ? ` · ${current.album}` : ""}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge variant="secondary">{SOURCE_LABELS[current.sourceType]}</Badge>
              {current.genre ? <Badge variant="outline">{current.genre.name}</Badge> : null}
              {current.playCount > 0 ? (
                <Badge variant="outline">{formatNumber(current.playCount)} lượt nghe</Badge>
              ) : null}
            </div>
          </div>

          <div className="w-full space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                {formatDuration(seekBarValue)}
              </span>
              <div className="flex-1">
                <RangeInput
                  value={seekBarValue}
                  max={totalDuration}
                  disabled={totalDuration <= 0 || !capabilities.canSeek}
                  onChange={handleSeekChange}
                  onCommit={handleSeekCommit}
                />
              </div>
              <span className="w-12 text-xs tabular-nums text-muted-foreground">
                {formatDuration(totalDuration)}
              </span>
            </div>

            {!capabilities.canSeek || !capabilities.canSetVolume ? (
              <p className="text-center text-[11px] text-warning">{capabilities.note}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => usePlayerStore.getState().toggleShuffle()}
              className={cn(shuffle && "text-primary")}
              title="Phát ngẫu nhiên"
            >
              <Shuffle />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => usePlayerStore.getState().previous()}
              title="Bài trước"
            >
              <SkipBack />
            </Button>
            <Button
              size="icon-lg"
              className="rounded-full"
              onClick={() => usePlayerStore.getState().togglePlay()}
              title={isPlaying ? "Tạm dừng" : "Phát"}
            >
              {isPlaying ? <Pause className="size-6" /> : <Play className="size-6" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => usePlayerStore.getState().next()}
              title="Bài tiếp theo"
            >
              <SkipForward />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => usePlayerStore.getState().cycleRepeat()}
              className={cn(repeat !== "off" && "text-primary")}
              title="Chế độ lặp lại"
            >
              {repeat === "one" ? <Repeat1 /> : <Repeat />}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <FavoriteButton songId={current.id} initialFavorite={current.isFavorite} size="icon" />
            <AddToPlaylistDialog songId={current.id}>
              <Button variant="outline" size="sm">
                <ListPlus /> Thêm vào playlist
              </Button>
            </AddToPlaylistDialog>
            <Button
              variant="outline"
              size="sm"
              onClick={() => usePlayerStore.getState().addToQueue(current, true)}
            >
              Phát tiếp theo
            </Button>
            <MixButton variant="labeled" />
            {current.sourceType !== "UPLOADED" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  usePlayerStore
                    .getState()
                    .setVideoMode(videoMode === "full" ? "hidden" : "full")
                }
              >
                {videoMode === "full" ? "Ẩn video" : "Hiện video"}
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => usePlayerStore.getState().toggleQueue()}
            >
              <ListMusic /> Hàng chờ
            </Button>
            <Button
              variant={lyricsOpen ? "gradient" : "outline"}
              size="sm"
              onClick={() => {
                const store = usePlayerStore.getState();
                if (store.lyricsOpen) store.setLyricsOpen(false);
                else store.showLyrics();
              }}
              title="Lời bài hát (Y)"
            >
              <MicVocal /> Lời bài hát
            </Button>
            <LyricsPanel />

            <div className="flex w-44 items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => usePlayerStore.getState().toggleMute()}
                title={muted ? "Bật tiếng" : "Tắt tiếng"}
              >
                {muted || displayVolume === 0 ? <VolumeX /> : <Volume2 />}
              </Button>
              {/*
                Thanh am luong LUON keo duoc (khong con bi khoa voi nguon chi ho tro
                tat/bat tieng) va chi dai toi muc toi da thuc te cua nguon dang phat.
              */}
              <RangeInput
                value={muted ? 0 : displayVolume}
                max={volumeMax}
                step={VOLUME_STEP}
                markerPercent={canBoost ? VOLUME_MARKER_PERCENT : undefined}
                boostFromPercent={canBoost ? VOLUME_MARKER_PERCENT : undefined}
                title={`Âm lượng ${formatVolumePercent(muted ? 0 : displayVolume)} (tối đa ${formatVolumePercent(volumeMax)})`}
                onChange={(value) => usePlayerStore.getState().setVolume(value)}
              />
              <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                {formatVolumePercent(muted ? 0 : displayVolume)}
              </span>
            </div>
          </div>

          {isBoosted(displayVolume) ? (
            <div className="flex w-full flex-wrap items-center justify-center gap-2 text-[10px] text-muted-foreground">
              <span className="rounded-full bg-brand-alt/15 px-2 py-0.5 font-medium text-brand-alt">
                Đang khuếch đại trên 100%
              </span>
              <span>
                Tăng quá cao có thể bị méo tiếng — limiter đã bật để giảm vỡ tiếng.
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-2 text-[10px]"
                onClick={() => usePlayerStore.getState().setVolume(1)}
              >
                Về 100%
              </Button>
            </div>
          ) : null}

          {canBoost ? null : (
            <p className="max-w-2xl text-center text-[11px] text-muted-foreground">
              Nguồn nhúng (YouTube/SoundCloud/TikTok) tối đa 100% — chỉ file tải lên mới khuếch đại quá 100%.
            </p>
          )}

          {capabilities.canSetVolume ? null : (
            <p className="max-w-2xl text-center text-[11px] text-warning">
              Nguồn TikTok: thanh trượt chỉ bật/tắt tiếng (0% = tắt tiếng) — bấm nút loa trong khung video để chỉnh mức nhỏ/lớn.
            </p>
          )}

          {current.description ? (
            <p className="max-w-2xl text-center text-xs text-muted-foreground">
              {current.description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}