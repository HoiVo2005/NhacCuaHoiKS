"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Keyboard,
  ListMusic,
  Maximize2,
  MicVocal,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Video,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";

import { MixButton } from "@/components/player/mix-button";
import { SleepTimerButton } from "@/components/player/sleep-timer-button";
import { VerticalVolumeSlider } from "@/components/player/vertical-volume-slider";
import { RangeInput } from "@/components/player/range-input";
import { FavoriteButton } from "@/components/music/favorite-button";
import { Artwork } from "@/components/ui/artwork";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { SOURCE_LABELS } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  canBoostVolume,
  clampVolumeFor,
  formatVolumePercent,
  maxVolumeFor,
  VOLUME_MARKER_PERCENT,
  VOLUME_STEP,
} from "@/lib/volume";
import { usePlayerStore } from "@/store/player-store";

export function PlayerBar() {
  const current = usePlayerStore((state) => state.current);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const progress = usePlayerStore((state) => state.progress);
  const duration = usePlayerStore((state) => state.duration);
  const volume = usePlayerStore((state) => state.volume);
  const muted = usePlayerStore((state) => state.muted);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const repeat = usePlayerStore((state) => state.repeat);
  const queueOpen = usePlayerStore((state) => state.queueOpen);
  const videoMode = usePlayerStore((state) => state.videoMode);
  const errorMessage = usePlayerStore((state) => state.errorMessage);
  const shortcutsOpen = usePlayerStore((state) => state.shortcutsOpen);
  const lyricsOpen = usePlayerStore((state) => state.lyricsOpen);

  // Chi luu gia tri khi nguoi dung dang keo thanh tien trinh.
  // Hai state nay LUON duoc dat cung luc trong mot lan render (React gop chung batch)
  // nen thanh truot khong bi nhay ve vi tri cu khi dong co bao tien do xen vao.
  const [seekValue, setSeekValue] = useState(progress);
  const [isSeeking, setIsSeeking] = useState(false);

  if (!current) {
    return (
      <div className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/70">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-3 px-4">
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            Chưa có bài nhạc nào đang phát — chọn một bài trong thư viện để bắt đầu.
          </p>
          <Button asChild size="sm" variant="gradient" className="shrink-0">
            <Link href="/music">Mở thư viện</Link>
          </Button>
        </div>
      </div>
    );
  }

  const totalDuration = duration > 0 ? duration : current.durationSeconds;

  /**
   * Am luong thuc te cua nguon dang phat: nguon nhung (YouTube/SoundCloud/TikTok) bi nen
   * tang chan o 100% nen thanh truot chi dai toi do - khong con "vung chet" 100..200%
   * (keo ma am thanh khong to hon, nguoi dung tuong thanh am luong bi hong).
   */
  const volumeMax = maxVolumeFor(current.sourceType);
  const canBoost = canBoostVolume(current.sourceType);
  const displayVolume = clampVolumeFor(current.sourceType, volume);
  const VolumeIcon = displayVolume === 0 || muted ? VolumeX : displayVolume < 0.5 ? Volume1 : Volume2;

  const seekBarValue = isSeeking ? seekValue : progress;

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
    <div className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/70">
      {errorMessage ? (
        <div className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-xs text-warning-soft-foreground">
          {errorMessage}
        </div>
      ) : null}

      <div className="mx-auto flex max-w-screen-2xl flex-col gap-1.5 px-3 py-1.5 sm:gap-2 sm:px-4 sm:py-2">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:w-72 sm:flex-none">
            <button
              type="button"
              onClick={() => usePlayerStore.getState().toggleFullPlayer()}
              className="group relative size-10 shrink-0 overflow-hidden rounded-lg border border-border-strong bg-surface sm:size-12"
              title="Mở trình phát đầy đủ"
            >
              {current.thumbnailUrl ? (
                 
                <Artwork
                  src={current.thumbnailUrl}
                  alt={current.title}
                  className="size-full object-cover transition group-hover:scale-105"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
                  ♪
                </span>
              )}
            </button>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{current.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {current.artist || "Không rõ nghệ sĩ"} · {SOURCE_LABELS[current.sourceType]}
              </p>
            </div>

            <span className="hidden sm:block">
              <FavoriteButton songId={current.id} initialFavorite={current.isFavorite} />
            </span>
          </div>

          <div className="flex flex-1 flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 sm:gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn("hidden size-8 sm:inline-flex", shuffle && "text-primary")}
                onClick={() => usePlayerStore.getState().toggleShuffle()}
                title="Phát ngẫu nhiên"
              >
                <Shuffle />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-9 sm:size-8"
                onClick={() => usePlayerStore.getState().previous()}
                title="Bài trước"
              >
                <SkipBack />
              </Button>
              <Button
                size="icon"
                className="rounded-full shadow-lg"
                onClick={() => usePlayerStore.getState().togglePlay()}
                title={isPlaying ? "Tạm dừng" : "Phát"}
              >
                {isPlaying ? <Pause /> : <Play />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-9 sm:size-8"
                onClick={() => usePlayerStore.getState().next()}
                title="Bài tiếp theo"
              >
                <SkipForward />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn("hidden size-8 sm:inline-flex", repeat !== "off" && "text-primary")}
                onClick={() => usePlayerStore.getState().cycleRepeat()}
                title={
                  repeat === "one"
                    ? "Lặp lại một bài"
                    : repeat === "all"
                      ? "Lặp lại danh sách phát"
                      : "Không lặp lại"
                }
              >
                {repeat === "one" ? <Repeat1 /> : <Repeat />}
              </Button>
            </div>

            <div className="hidden w-full max-w-xl items-center gap-2 sm:flex">
              <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">
                {formatDuration(seekBarValue)}
              </span>
              <div className="flex-1">
                <RangeInput
                  value={seekBarValue}
                  max={totalDuration}
                  disabled={totalDuration <= 0}
                  onChange={handleSeekChange}
                  onCommit={handleSeekCommit}
                />
              </div>
              <span className="w-10 text-[11px] tabular-nums text-muted-foreground">
                {formatDuration(totalDuration)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            {current.sourceType !== "UPLOADED" ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  usePlayerStore
                    .getState()
                    .setVideoMode(videoMode === "floating" ? "hidden" : "floating")
                }
                className={cn(
                  "hidden size-8 sm:inline-flex",
                  videoMode === "floating" && "text-primary",
                )}
                title="Hiện/ẩn khung video"
              >
                <Video />
              </Button>
            ) : null}
            {/* Hẹn giờ tắt nhạc: đếm ngược theo phút hoặc “hết bài này thì tắt” */}
            <SleepTimerButton />
            {/* Mix quanh bài đang phát: tạo hàng chờ mới gồm các bài tương đồng */}
            <MixButton />
            {/* Lời bài hát: bảng lời nằm trong trình phát đầy đủ nên mở luôn trình phát đó */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                const store = usePlayerStore.getState();
                if (store.lyricsOpen) store.setLyricsOpen(false);
                else store.showLyrics();
              }}
              className={cn("size-9 sm:size-8", lyricsOpen && "text-primary")}
              title="Lời bài hát (Y)"
            >
              <MicVocal />
            </Button>
            {/* Bảng phím tắt: trên điện thoại ẩn bớt cho gọn (không có bàn phím thật) */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => usePlayerStore.getState().toggleShortcuts()}
              className={cn("hidden size-8 sm:inline-flex", shortcutsOpen && "text-primary")}
              title="Phím tắt (?)"
            >
              <Keyboard />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => usePlayerStore.getState().toggleQueue()}
              className={cn("size-9 sm:size-8", queueOpen && "text-primary")}
              title="Danh sách phát"
            >
              <ListMusic />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => usePlayerStore.getState().toggleMute()}
              className="hidden size-8 sm:inline-flex"
              title="Tắt/bật tiếng"
            >
              <VolumeIcon />
            </Button>
            <div className="hidden w-24 sm:block">
              <RangeInput
                value={muted ? 0 : displayVolume}
                max={volumeMax}
                step={VOLUME_STEP}
                markerPercent={canBoost ? VOLUME_MARKER_PERCENT : undefined}
                boostFromPercent={canBoost ? VOLUME_MARKER_PERCENT : undefined}
                title={`Âm lượng ${formatVolumePercent(muted ? 0 : displayVolume)} (tối đa ${formatVolumePercent(volumeMax)})`}
                onChange={(value) => usePlayerStore.getState().setVolume(value)}
              />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => usePlayerStore.getState().toggleFullPlayer()}
              className="size-9 sm:size-8"
              title="Trình phát đầy đủ"
            >
              <Maximize2 />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {formatDuration(seekBarValue)}
          </span>
          <div className="flex-1">
            <RangeInput
              value={seekBarValue}
              max={totalDuration}
              disabled={totalDuration <= 0}
              onChange={handleSeekChange}
              onCommit={handleSeekCommit}
            />
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {formatDuration(totalDuration)}
          </span>
        </div>

        {/*
          Am luong tren dien thoai: truoc day nut tat tieng + thanh am luong bi an
          (`hidden sm:*`) nen dien thoai khong chinh duoc am luong.
        */}
        <div className="flex items-center gap-2 sm:hidden" data-mobile-volume>
          {/*
            Âm lượng trên điện thoại: icon loa mở panel có THANH TRƯỢT DỌC (kéo LÊN = to hơn,
            kéo xuống = nhỏ hơn). Trước đây là thanh trượt ngang: vừa chiếm chỗ trên màn hình nhỏ,
            vừa khó kéo chính xác bằng ngón tay. Panel mở lên trên nút và không tự đóng khi đang
            kéo (xem `KEEP_OPEN_SELECTOR` trong `dropdown.tsx`).
          */}
          <Dropdown
            side="top"
            /*
             * Nút loa nằm ở ĐẦU hàng (bên trái) nên panel phải mở sang PHẢI; nếu căn về phía phải
             * (mặc định của Dropdown) thì panel bị đẩy ra ngoài mép trái màn hình, chỉ thấy một dải cắt.
             * Bề rộng chốt theo màn hình (`82vw`, tối đa 300px) để luôn nằm trong tầm nhìn.
             */
            align="left"
            className="w-[min(82vw,300px)] p-3"
            trigger={
              <button
                type="button"
                aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
                title={`Âm lượng ${formatVolumePercent(muted ? 0 : displayVolume)} (tối đa ${formatVolumePercent(volumeMax)}) — kéo lên/xuống để chỉnh`}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full transition",
                  muted ? "text-primary" : "text-muted-foreground",
                )}
              >
                <VolumeIcon className="size-4" />
              </button>
            }
          >
            <div className="flex items-stretch gap-3">
              <VerticalVolumeSlider
                value={muted ? 0 : displayVolume}
                max={volumeMax}
                step={VOLUME_STEP}
                markerPercent={canBoost ? VOLUME_MARKER_PERCENT : undefined}
                onChange={(value) => usePlayerStore.getState().setVolume(value)}
              />

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {formatVolumePercent(muted ? 0 : displayVolume)}
                </span>
                <span className="break-words text-[10px] leading-snug text-muted-foreground">
                  Kéo lên để to hơn, kéo xuống để nhỏ hơn · tối đa{" "}
                  {formatVolumePercent(volumeMax)}
                </span>

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 w-full justify-center gap-1.5 px-2.5 text-xs"
                  onClick={() => usePlayerStore.getState().toggleMute()}
                >
                  {muted ? "Bật tiếng" : "Tắt tiếng"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 w-full justify-center gap-1.5 px-2.5 text-xs"
                  title="Đặt mức tối đa của nguồn đang phát"
                  onClick={() => usePlayerStore.getState().setVolume(volumeMax)}
                >
                  Tối đa
                </Button>
              </div>
            </div>
          </Dropdown>

          <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
            {formatVolumePercent(muted ? 0 : displayVolume)}
          </span>
        </div>
      </div>
    </div>
  );
}
