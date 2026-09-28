"use client";

import { useCallback, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Thanh trượt âm lượng DỌC cho điện thoại.
 *
 * Vì sao không dùng `<input type="range">` xoay `-90deg` như bản trước:
 *  - Vùng chạm của nó chỉ rộng ~22px: đặt ngón tay lệch một chút là **không kéo được** (người dùng
 *    tưởng tính năng hỏng), lại còn bị hiểu là "bấm ra ngoài panel" nên panel tự đóng luôn.
 *  - Ngón tay luôn to hơn 22px, mà thanh trượt lại nằm ngay mép panel nên rất chật.
 *
 * Nay dùng pointer events + `setPointerCapture`:
 *  - Cả khung **44px × 160px** đều kéo được (chạm vào đâu cũng nhảy tới mức đó rồi kéo tiếp).
 *  - Kéo lệch ra ngoài khung vẫn tính tiếp cho tới khi nhấc tay (pointer capture).
 *  - `data-dropdown-keep-open` + `touch-none`: panel không tự đóng và không bị cuộn trang khi kéo.
 *  - Dùng được cả bàn phím (↑/↓/Home/End) và đọc được bằng trình đọc màn hình (`role="slider"`).
 */

/** Vị trí ngón tay -> tỉ lệ 0..1 (0 = đáy, 1 = đỉnh). Hàm thuần nên kiểm chứng được. */
export function ratioFromPointer(input: { clientY: number; top: number; height: number }): number {
  if (!Number.isFinite(input.height) || input.height <= 0) return 0;

  const ratio = 1 - (input.clientY - input.top) / input.height;
  return Math.min(Math.max(ratio, 0), 1);
}

/** Tỉ lệ 0..1 -> giá trị âm lượng (làm tròn theo `step`, không vượt quá `max`). */
export function volumeFromRatio(ratio: number, max: number, step: number): number {
  if (!Number.isFinite(max) || max <= 0) return 0;

  const safeRatio = Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0), 1) : 0;
  const safeStep = Number.isFinite(step) && step > 0 ? step : 0.01;
  const rounded = Math.round((safeRatio * max) / safeStep) * safeStep;

  return Math.min(Math.max(rounded, 0), max);
}

interface VerticalVolumeSliderProps {
  value: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Vị trí (%) vẽ vạch mốc 100% khi nguồn cho phép khuếch đại */
  markerPercent?: number;
  className?: string;
}

export function VerticalVolumeSlider({
  value,
  max,
  step,
  onChange,
  markerPercent,
  className,
}: VerticalVolumeSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const percent = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0;
  const normalPercent = markerPercent === undefined ? percent : Math.min(percent, markerPercent);
  const boostPercent = markerPercent === undefined ? 0 : Math.max(percent - markerPercent, 0);

  const updateFromPointer = useCallback(
    (clientY: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;

      onChange(
        volumeFromRatio(ratioFromPointer({ clientY, top: rect.top, height: rect.height }), max, step),
      );
    },
    [max, onChange, step],
  );

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const stepValue = Number.isFinite(step) && step > 0 ? step : 0.01;

    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      onChange(Math.min(value + stepValue, max));
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      onChange(Math.max(value - stepValue, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(max);
    }
  }

  return (
    <div
      ref={trackRef}
      data-dropdown-keep-open
      role="slider"
      aria-orientation="vertical"
      aria-label="Âm lượng"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      aria-valuetext={`${Math.round(percent)}%`}
      tabIndex={0}
      className={cn(
        "relative h-40 w-11 shrink-0 cursor-pointer touch-none select-none rounded-2xl bg-surface/70 outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary/60",
        className,
      )}
      onPointerDown={(event) => {
        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromPointer(event.clientY);
      }}
      onPointerMove={(event) => {
        if (draggingRef.current) updateFromPointer(event.clientY);
      }}
      onPointerUp={(event) => {
        draggingRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Rãnh trượt (hết chiều cao khung để tỉ lệ % khớp đúng vị trí ngón tay) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-foreground/15"
      />

      {/* Phần đã kéo: mọc từ ĐÁY lên (kéo lên = to hơn) */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-[var(--brand)]"
        style={{ height: `${normalPercent}%` }}
      />

      {/* Vùng khuếch đại (>100%) tô màu khác, giống thanh trượt ngang */}
      {boostPercent > 0 && markerPercent !== undefined ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-[var(--brand-alt)]"
          style={{ bottom: `${markerPercent}%`, height: `${boostPercent}%` }}
        />
      ) : null}

      {/* Vạch mốc 100% */}
      {markerPercent === undefined ? null : (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 h-px w-7 -translate-x-1/2 bg-foreground/40"
          style={{ bottom: `${markerPercent}%` }}
        />
      )}

      {/* Núm kéo: to (20px) cho ngón tay, không nuốt sự kiện chạm */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 size-5 -translate-x-1/2 translate-y-1/2 rounded-full border border-foreground/20 bg-white shadow"
        style={{ bottom: `${percent}%` }}
      />
    </div>
  );
}
