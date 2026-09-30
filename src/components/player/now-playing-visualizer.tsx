"use client";

import { useCallback, useRef } from "react";

import { useIsDesktop, usePrefersReducedMotion } from "@/hooks/use-media-query";
import { useVisualizerFrame } from "@/hooks/use-visualizer-levels";
import {
  levelToScale,
  visualizerBars,
  VISUALIZER_BAR_COUNT,
  type VisualizerMode,
} from "@/lib/visualizer";
import { cn } from "@/lib/utils";

/**
 * Dải sóng nhạc cho phần "chi tiết bài hát" ở trình phát đầy đủ.
 *
 * - **CHỈ hiện trên desktop** (`hidden lg:block`, mốc 1024px như phần còn lại của giao diện). Điện thoại
 *   không những không hiện mà **không chạy** vòng lặp vẽ: `useVisualizerFrame` chỉ bật khi `useIsDesktop()`
 *   — ẩn bằng CSS thì vẫn tốn CPU/pin.
 * - **Chạy theo nhạc**: file nội bộ được **phân tích phổ thật** (`captureStream` + `AnalyserNode`, không
 *   reroute âm thanh); nguồn nhúng (YouTube/SoundCloud/TikTok) dùng **nhịp mô phỏng** theo vị trí bài hát
 *   vì âm thanh nằm trong `iframe` khác miền — xem `src/hooks/use-visualizer-levels.ts`.
 * - **Tạm dừng** thì các cột "ngồi xuống" mức nghỉ rồi đứng yên, quầng sáng tắt.
 * - **Giảm chuyển động** (`prefers-reduced-motion`): tắt hẳn hiệu ứng, các cột đứng yên ở mức nghỉ.
 * - Trang trí -> `aria-hidden`; trạng thái phát/tạm dừng đã được thanh phát thông báo.
 */
const BARS = visualizerBars(VISUALIZER_BAR_COUNT);

/** Nhãn cho biết sóng đang bám vào đâu (người dùng khỏi tưởng hiệu ứng bị "giả") */
const MODE_LABELS: Record<VisualizerMode, string> = {
  spectrum: "Sóng theo nhạc",
  simulated: "Nhịp theo bài hát",
  idle: "Nhạc đang tạm dừng",
};


export function NowPlayingVisualizer({ className }: { className?: string }) {
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const isDesktop = useIsDesktop();
  const reduceMotion = usePrefersReducedMotion();

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

  const mode = useVisualizerFrame({
    count: BARS.length,
    enabled: isDesktop && !reduceMotion,
    apply,
  });

  const label = reduceMotion ? "Đã tắt hiệu ứng (giảm chuyển động)" : MODE_LABELS[mode];

  return (
    <div
      aria-hidden="true"
      data-slot="now-playing-visualizer"
      data-mode={reduceMotion ? "off" : mode}
      data-playing={mode === "idle" ? "false" : "true"}
      className={cn("relative hidden w-full select-none lg:block", className)}
    >
      {/* Quầng sáng gradient phía sau: chỉ sáng khi nhạc đang chạy */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-10 -top-4 h-20 rounded-full bg-gradient-brand opacity-0 blur-3xl transition-opacity duration-700",
          mode !== "idle" && "animate-pulse-glow opacity-25",
        )}
      />

      <div className="relative flex h-16 items-end justify-center gap-[3px] px-2">
        {BARS.map((bar, index) => (
          <span
            key={index}
            ref={(node) => {
              barRefs.current[index] = node;
            }}
            className="h-full w-[3px] shrink-0 origin-bottom rounded-full bg-gradient-brand"
            style={{
              opacity: bar.opacity,
              // Mức nghỉ: dùng ngay từ lần vẽ đầu (SSR) nên không lệch hydration; hook sẽ ghi đè sau
              transform: `scaleY(${levelToScale(bar.restLevel)})`,
            }}
          />
        ))}
      </div>

      <p className="mt-2 text-right text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
