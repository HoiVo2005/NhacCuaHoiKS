"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

import { useIsDesktop, usePrefersReducedMotion } from "@/hooks/use-media-query";
import { useVisualizerFrame } from "@/hooks/use-visualizer-levels";
import {
  levelToScale,
  visualizerBars,
  VISUALIZER_BAR_COUNT,
  type VisualizerMode,
} from "@/lib/visualizer";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";

/**
 * Dải sóng nhạc cho phần "chi tiết bài hát" ở trình phát đầy đủ.
 *
 * - **CHỈ hiện trên desktop** (`hidden lg:block`, mốc 1024px như phần còn lại của giao diện); trên điện
 *   thoại **không chạy** vòng lặp vẽ (ẩn bằng CSS thì vẫn tốn CPU/pin).
 * - **Chạy theo nhạc**: file nội bộ được **phân tích phổ thật** (`captureStream` + `AnalyserNode`, không
 *   reroute âm thanh); nguồn nhúng (YouTube/SoundCloud/TikTok) dùng **nhịp mô phỏng** theo vị trí bài hát
 *   — xem `src/hooks/use-visualizer-levels.ts`.
 * - **Giảm chuyển động** (`prefers-reduced-motion`): tôn trọng cài đặt của máy nên mặc định **không chạy**,
 *   nhưng có nút **“Bật hiệu ứng”** cho ai vẫn muốn xem (lựa chọn được nhớ trong `localStorage`), và nhãn
 *   dưới dải sóng nói rõ lý do để không ai tưởng tính năng bị hỏng.
 * - **Lưới an toàn**: nếu vòng lặp JS không cho ra mức nào mà nhạc vẫn đang chạy, cột vẫn nhún bằng
 *   keyframe `equalize` có sẵn trong `globals.css` (`cssFallback`) — dải sóng không bao giờ "đứng chết".
 * - **Tạm dừng** thì các cột "ngồi xuống" mức nghỉ rồi đứng yên, quầng sáng tắt.
 */
const BARS = visualizerBars(VISUALIZER_BAR_COUNT);

/** Nhãn cho biết sóng đang bám vào đâu (người dùng khỏi tưởng hiệu ứng bị "giả") */
const MODE_LABELS: Record<VisualizerMode, string> = {
  spectrum: "Sóng theo nhạc",
  simulated: "Nhịp theo bài hát",
  idle: "Nhạc đang tạm dừng",
};

/** Khoá localStorage nhớ việc người dùng tự bật hiệu ứng dù máy đang bật "giảm chuyển động" */
const MOTION_STORAGE_KEY = "nhaccuahoiks-visualizer-motion";

/** Nhớ trong phiên khi trình duyệt chặn localStorage */
let motionMemory = false;

const motionListeners = new Set<() => void>();

/**
 * Lựa chọn của người dùng có đang được đọc qua `useSyncExternalStore` (không phải `useState` + effect):
 * cách này tránh "setState trong effect" (gây render dây chuyền) và vẫn an toàn khi SSR (máy chủ luôn
 * trả `false` — xem `getMotionServerSnapshot`).
 */
function readMotionOverride(): boolean {
  try {
    return window.localStorage.getItem(MOTION_STORAGE_KEY) === "on";
  } catch {
    /* Trình duyệt chặn localStorage -> dùng giá trị nhớ trong phiên */
    return motionMemory;
  }
}

function getMotionServerSnapshot(): boolean {
  return false;
}

function setMotionOverride(on: boolean): void {
  motionMemory = on;

  try {
    if (on) window.localStorage.setItem(MOTION_STORAGE_KEY, "on");
    else window.localStorage.removeItem(MOTION_STORAGE_KEY);
  } catch {
    /* Trình duyệt chặn localStorage -> chỉ nhớ trong phiên này */
  }

  for (const listener of motionListeners) listener();
}

function subscribeMotionOverride(onChange: () => void): () => void {
  motionListeners.add(onChange);

  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => motionListeners.delete(onChange);
  }

  // Đổi ở tab khác thì tab này cũng cập nhật
  window.addEventListener("storage", onChange);

  return () => {
    motionListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}


export function NowPlayingVisualizer({ className }: { className?: string }) {
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const isDesktop = useIsDesktop();
  const reduceMotion = usePrefersReducedMotion();
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  /**
   * Người dùng đã tự bật hiệu ứng dù máy đang bật "giảm chuyển động"?
   *
   * Đọc qua `useSyncExternalStore` (không phải `useState` + `useEffect`) để tránh setState trong effect;
   * máy chủ luôn trả `false` nên không lệch hydration.
   */
  const forceMotion = useSyncExternalStore(
    subscribeMotionOverride,
    readMotionOverride,
    getMotionServerSnapshot,
  );

  /** Máy đang chặn chuyển động và người dùng chưa tự bật -> hiệu ứng không chạy */
  const motionBlocked = reduceMotion && !forceMotion;
  const motionAllowed = isDesktop && !motionBlocked;

  /**
   * Ghi mức vào DOM bằng `transform: scaleY` (thuộc tính chạy trên GPU) thay vì đưa qua state React:
   * 56 cột × 60 khung hình/giây mà re-render thì vừa nặng vừa giật. Gốc biến đổi là đáy cột
   * (`origin-bottom`) nên cột "vọt lên" từ dưới như equalizer thật.
   */
  const apply = useCallback((levels: number[]) => {
    for (let index = 0; index < levels.length; index += 1) {
      const bar = barRefs.current[index];
      if (bar) bar.style.transform = `scaleY(${levelToScale(levels[index])})`;
    }
  }, []);

  const mode = useVisualizerFrame({ count: BARS.length, enabled: motionAllowed, apply });

  /*
   * LƯỚI AN TOÀN: nếu vòng lặp JS không cho ra mức nào (mode vẫn `idle` dù nhạc đang chạy) thì để
   * keyframe `equalize` có sẵn trong `globals.css` nhún cột — dải sóng không bao giờ "đứng chết".
   */
  const cssFallback = isPlaying && motionAllowed && mode === "idle";

  const label = motionBlocked
    ? "Máy đang bật “giảm chuyển động” — hiệu ứng tạm tắt"
    : cssFallback
      ? "Sóng nhạc đang bắt nhịp…"
      : MODE_LABELS[mode];

  return (
    <div
      data-slot="now-playing-visualizer"
      data-mode={motionBlocked ? "off" : mode}
      data-playing={isPlaying ? "true" : "false"}
      data-css-fallback={cssFallback ? "true" : "false"}
      className={cn("relative hidden w-full select-none lg:block", className)}
    >
      {/* Dải cột: chỉ là trang trí nên `aria-hidden` (trạng thái phát đã có thanh phát thông báo) */}
      <div aria-hidden="true" data-slot="now-playing-bars">
        <div
          className={cn(
            "pointer-events-none absolute inset-x-10 -top-4 h-24 rounded-full bg-gradient-brand opacity-0 blur-3xl transition-opacity duration-700",
            isPlaying && motionAllowed && "animate-pulse-glow opacity-25",
          )}
        />

        <div className="relative flex h-20 items-end justify-center gap-[3px] px-2">
          {BARS.map((bar, index) => (
            <span
              key={index}
              ref={(node) => {
                barRefs.current[index] = node;
              }}
              className={cn(
                "h-full w-1 shrink-0 origin-bottom rounded-full bg-gradient-brand",
                cssFallback && "animate-equalize",
              )}
              style={{
                opacity: bar.opacity,
                // Mức nghỉ: dùng ngay từ lần vẽ đầu (SSR) nên không lệch hydration; hook sẽ ghi đè sau
                transform: cssFallback ? "none" : `scaleY(${levelToScale(bar.restLevel)})`,
              }}
            />
          ))}
        </div>
      </div>

      {/*
        Hàng nhãn nằm NGOÀI vùng `aria-hidden` vì có nút bấm được (không thể để nút bên trong aria-hidden).
        Nhãn nói rõ vì sao dải sóng đứng yên -> người dùng không tưởng tính năng bị hỏng.
      */}
      <div
        data-slot="now-playing-visualizer-status"
        className="mt-2 flex flex-wrap items-center justify-end gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
      >
        <span>{label}</span>
        {motionBlocked ? (
          <button
            type="button"
            onClick={() => setMotionOverride(true)}
            className="rounded-full border border-border-strong px-2 py-0.5 text-[10px] normal-case tracking-normal text-foreground transition hover:border-primary/50 hover:text-primary"
          >
            Bật hiệu ứng
          </button>
        ) : null}
      </div>
    </div>
  );
}
