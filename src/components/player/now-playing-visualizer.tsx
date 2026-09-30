"use client";

import { visualizerBars } from "@/lib/visualizer";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";

/**
 * Minh hoạ cột sóng nhạc cho phần "chi tiết bài nhạc" ở trình phát đầy đủ.
 *
 * Quy ước:
 *  - **CHỈ hiện trên desktop** (`hidden lg:block`, mốc 1024px như phần còn lại của giao diện). Trên
 *    điện thoại khung chi tiết đã chật, thêm 56 cột chạy animation liên tục chỉ tốn pin vô ích.
 *  - Đang phát: các cột nhún bằng keyframe `equalize` có sẵn trong `globals.css` (đã nằm trong danh
 *    sách tắt khi người dùng bật "giảm chuyển động" — xem `prefers-reduced-motion`), kèm quầng sáng
 *    gradient mờ dần hiện lên (`animate-pulse-glow`).
 *  - Tạm dừng: bỏ hẳn class animation nên các cột đứng yên ở chiều cao thấp, quầng sáng tắt.
 *  - Chỉ là trang trí -> `aria-hidden`; trạng thái phát/tạm dừng đã được thanh phát thông báo.
 *
 * Không phân tích âm thanh thật: xem ghi chú trong `src/lib/visualizer.ts` (Web Audio sẽ làm mất khả
 * năng nghe khi app ra nền trên iOS).
 */
const BARS = visualizerBars();

export function NowPlayingVisualizer({ className }: { className?: string }) {
  const isPlaying = usePlayerStore((state) => state.isPlaying);

  return (
    <div
      aria-hidden="true"
      data-slot="now-playing-visualizer"
      data-playing={isPlaying ? "true" : "false"}
      className={cn("relative hidden w-full select-none lg:block", className)}
    >
      {/* Quầng sáng gradient phía sau: chỉ sáng khi nhạc đang chạy */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-10 -top-4 h-20 rounded-full bg-gradient-brand opacity-0 blur-3xl transition-opacity duration-700",
          isPlaying && "animate-pulse-glow opacity-25",
        )}
      />

      <div className="relative flex h-16 items-end justify-center gap-[3px] px-2">
        {BARS.map((bar, index) => (
          <span
            key={index}
            className={cn(
              "w-[3px] shrink-0 rounded-full bg-gradient-brand",
              isPlaying && "animate-equalize",
            )}
            style={{
              height: `${bar.minHeightPercent}%`,
              // Tạm dừng: cột thấp và mờ hơn nhưng vẫn thấy "khung sóng" (không nhảy về 0)
              opacity: isPlaying ? bar.opacity : Math.round(bar.opacity * 45) / 100,
              animationDelay: `${bar.delayMs}ms`,
              animationDuration: `${bar.durationMs}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
