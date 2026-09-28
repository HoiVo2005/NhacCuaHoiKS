"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Timer, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem, DropdownLabel } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import {
  describeSleepTimer,
  formatSleepRemaining,
  formatSleepTracks,
  normalizeSleepMinutes,
  normalizeSleepTracks,
  sleepDeadlineFromClock,
  sleepRemaining,
  SLEEP_TIMER_MAX_MINUTES,
  SLEEP_TIMER_MAX_TRACKS,
  SLEEP_TIMER_MIN_TRACKS,
  SLEEP_TIMER_MINUTES,
  SLEEP_TIMER_TRACKS,
} from "@/lib/sleep-timer";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";

/**
 * Nút hẹn giờ tắt nhạc trên thanh phát.
 *
 * - Chọn nhanh các mốc phút, hoặc **tự chọn**: số phút bất kỳ (1–720) hay mốc giờ đồng hồ (`23:30`).
 * - Chọn nhanh **số bài** (1 / 2 / 3 / 5 / 10) hoặc tự chọn số bài bất kỳ (1–99): phát hết chừng đó bài
 *   (tính cả bài đang phát) rồi dừng, không tự chuyển bài. `1 bài` = “hết bài này thì tắt”.
 * - Đếm ngược: đồng hồ 1 giây/lần để nhãn chạy, nhưng hạn chót còn được kiểm tra ở MỖI lần
 *   store thay đổi (động cơ báo tiến độ ~4 lần/giây). Trình duyệt bóp `setInterval` khi tab
 *   ở chế độ nền, nhờ vậy nhạc vẫn tắt đúng lúc dù người dùng đã chuyển tab.
 * - “Hết bài này thì tắt”: động cơ gọi `handleTrackEnded()` khi hết bài rồi dừng hẳn.
 */
export function SleepTimerButton() {
  const sleepMode = usePlayerStore((state) => state.sleepMode);
  const sleepEndsAt = usePlayerStore((state) => state.sleepEndsAt);
  const sleepTracksLeft = usePlayerStore((state) => state.sleepTracksLeft);
  const sleepTracksTotal = usePlayerStore((state) => state.sleepTracksTotal);
  const [remaining, setRemaining] = useState(() => sleepRemaining(sleepEndsAt));
  const [open, setOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [customTracks, setCustomTracks] = useState("");
  const [customClock, setCustomClock] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isOn = sleepMode !== "off";

  // Nhãn đếm ngược: cập nhật mỗi giây khi đang hẹn giờ
  useEffect(() => {
    if (sleepMode !== "countdown" || sleepEndsAt === null) return;

    const update = () => setRemaining(sleepRemaining(sleepEndsAt));
    update();

    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [sleepMode, sleepEndsAt]);

  // Kiểm tra hạn chót ở mọi thay đổi của store (không phụ thuộc nhịp `setInterval`)
  useEffect(() => {
    if (sleepMode !== "countdown") return;

    return usePlayerStore.subscribe(() => {
      usePlayerStore.getState().tickSleepTimer();
    });
  }, [sleepMode]);

  /** Đóng menu và xoá thông báo lỗi (ô nhập được xoá riêng khi hẹn thành công) */
  const closeMenu = () => {
    setOpen(false);
    setError(null);
  };

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    setError(null);
  }, []);

  /** Tự chọn số phút bất kỳ (1–720): gõ số rồi Enter hoặc bấm “Hẹn” */
  const armCustomMinutes = () => {
    const minutes = normalizeSleepMinutes(Number(customMinutes.replace(",", ".")));
    if (minutes === null) {
      setError(`Nhập số phút từ 1 đến ${SLEEP_TIMER_MAX_MINUTES}`);
      return;
    }

    usePlayerStore.getState().setSleepTimer(minutes);
    setCustomMinutes("");
    closeMenu();
  };

  /** Tự chọn mốc giờ đồng hồ (ví dụ 23:30); giờ đã qua trong ngày được hiểu là ngày mai */
  const armCustomClock = () => {
    const deadline = sleepDeadlineFromClock(customClock);
    if (deadline === null) {
      setError("Chọn giờ hợp lệ, ví dụ 23:30");
      return;
    }

    usePlayerStore.getState().setSleepTimerAt(deadline);
    setCustomClock("");
    closeMenu();
  };

  /** Tự chọn số bài (1–99): gõ số rồi Enter hoặc bấm “Hẹn bài” */
  const armCustomTracks = () => {
    const tracks = normalizeSleepTracks(Number(customTracks.replace(",", ".")));
    if (tracks === null) {
      setError(`Nhập số bài từ ${SLEEP_TIMER_MIN_TRACKS} đến ${SLEEP_TIMER_MAX_TRACKS}`);
      return;
    }

    usePlayerStore.getState().setSleepAfterTracks(tracks);
    setCustomTracks("");
    closeMenu();
  };

  /** Nhãn ngắn cạnh nút: thời gian còn lại (đếm ngược) hoặc số bài còn lại */
  const badge = (() => {
    if (sleepMode === "countdown") return formatSleepRemaining(remaining);
    if (sleepMode === "tracks") return sleepTracksLeft <= 1 ? "Hết bài" : formatSleepTracks(sleepTracksLeft);
    return null;
  })();
  /*
   * Mô tả cho tooltip/aria-label: kiểu đếm ngược cần “bây giờ” để tính thời gian còn lại (lấy mặc định trong
   * `describeSleepTimer`), còn kiểu đếm theo số bài thì không phụ thuộc thời gian nên truyền mốc 0 — không gọi
   * `Date.now()` ngay trong lúc render.
   */
  const description =
    sleepMode === "countdown"
      ? describeSleepTimer(sleepMode, sleepEndsAt)
      : describeSleepTimer(sleepMode, null, 0, sleepTracksLeft);

  return (
    <Dropdown
      side="top"
      className="min-w-64 max-h-[70vh]"
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <span className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("size-9 sm:size-8", isOn && "text-primary")}
            title={description}
            aria-label={description}
          >
            <Clock />
          </Button>
          {badge ? (
            <span className="hidden text-[11px] font-semibold tabular-nums text-primary sm:inline">
              {badge}
            </span>
          ) : null}
        </span>
      }
    >
      <DropdownLabel>{isOn ? description : "Hẹn giờ tắt nhạc"}</DropdownLabel>

      {SLEEP_TIMER_MINUTES.map((minutes) => (
        <DropdownItem key={minutes} onSelect={() => usePlayerStore.getState().setSleepTimer(minutes)}>
          <Timer className="size-4 text-muted-foreground" />
          {minutes} phút
        </DropdownItem>
      ))}

      {/* Tự chọn: số phút bất kỳ hoặc mốc giờ đồng hồ */}
      <div className="mx-1 my-1 rounded-lg border border-border/70 bg-surface/50 p-2">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Tự chọn · 1–{SLEEP_TIMER_MAX_MINUTES} phút
        </p>

        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={SLEEP_TIMER_MAX_MINUTES}
            value={customMinutes}
            onChange={(event) => {
              setCustomMinutes(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                armCustomMinutes();
              }
            }}
            placeholder="Số phút"
            aria-label="Số phút tự chọn"
            className="h-8 px-2 text-xs"
          />
          {/*
            Menu tự đóng khi hẹn xong; `data-dropdown-keep-open` để menu còn mở khi nhập sai
            (nếu không panel đóng ngay và người dùng không kịp thấy thông báo lỗi).
          */}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            data-dropdown-keep-open
            onClick={armCustomMinutes}
          >
            Hẹn
          </Button>
        </div>

        <div className="mt-1.5 flex items-center gap-1.5">
          {/* Ô giờ/icon của trình duyệt phải đổi màu theo giao diện sáng/tối */}
          <Input
            type="time"
            value={customClock}
            onChange={(event) => {
              setCustomClock(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                armCustomClock();
              }
            }}
            aria-label="Tắt lúc mấy giờ"
            className="h-8 px-2 text-xs [color-scheme:light] dark:[color-scheme:dark]"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            data-dropdown-keep-open
            onClick={armCustomClock}
            className="whitespace-nowrap"
          >
            Tắt lúc
          </Button>
        </div>

        {error ? <p className="mt-1.5 text-[11px] text-destructive">{error}</p> : null}
      </div>

      {/* Tắt sau N bài: mốc nhanh + tự chọn (1 bài = “hết bài này thì tắt”) */}
      <div className="mx-1 my-1 rounded-lg border border-border/70 bg-surface/50 p-2">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Tắt sau · bài hát (kể cả bài đang phát)
        </p>

        <div className="flex flex-wrap gap-1">
          {SLEEP_TIMER_TRACKS.map((tracks) => (
            <Button
              key={tracks}
              type="button"
              size="sm"
              variant={sleepMode === "tracks" && sleepTracksTotal === tracks ? "default" : "secondary"}
              onClick={() => usePlayerStore.getState().setSleepAfterTracks(tracks)}
              className="h-7 px-2.5 text-xs"
            >
              {tracks === 1 ? "Hết bài này" : `${tracks} bài`}
            </Button>
          ))}
        </div>

        <div className="mt-1.5 flex items-center gap-1.5">
          <Input
            type="number"
            inputMode="numeric"
            min={SLEEP_TIMER_MIN_TRACKS}
            max={SLEEP_TIMER_MAX_TRACKS}
            value={customTracks}
            onChange={(event) => {
              setCustomTracks(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                armCustomTracks();
              }
            }}
            placeholder="Số bài"
            aria-label="Số bài tự chọn"
            className="h-8 px-2 text-xs"
          />
          {/* `data-dropdown-keep-open` để menu còn mở khi nhập sai (xem `dropdown.tsx`) */}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            data-dropdown-keep-open
            onClick={armCustomTracks}
            className="whitespace-nowrap"
          >
            Hẹn bài
          </Button>
        </div>
      </div>

      {isOn ? (
        <DropdownItem destructive onSelect={() => usePlayerStore.getState().clearSleepTimer()}>
          <X className="size-4" />
          Tắt hẹn giờ
        </DropdownItem>
      ) : null}
    </Dropdown>
  );
}
