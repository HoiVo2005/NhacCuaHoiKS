/**
 * Cấu hình hiệu ứng "sóng nhạc" ở trình phát đầy đủ (CHỈ desktop) — `npm run check:visualizer`.
 *
 * Vì sao tách thành hàm THUẦN:
 *  - **Không dùng `Math.random()`**: máy chủ và trình duyệt phải vẽ ra y hệt nhau, nếu không sẽ **lệch
 *    hydration** (React cảnh báo và hiệu ứng giật khi mở trình phát lần đầu);
 *  - Kiểm chứng được số cột / độ trễ / biên độ mà không cần trình duyệt.
 *
 * LƯU Ý KỸ THUẬT — hiệu ứng **KHÔNG** phân tích âm thanh thật. Muốn phân tích phải dùng
 * `AnalyserNode`, kéo theo `createMediaElementSource` (đẩy âm thanh qua Web Audio) — đúng thứ mà iOS
 * chặn khi app ra nền (xem `needsWebAudioGraph` trong `src/lib/volume.ts`). Vì vậy hiệu ứng chỉ **mô
 * phỏng bằng CSS**, không đụng tới luồng âm thanh.
 */

/** Số cột sóng nhạc (đủ lấp bề ngang khung nội dung trên desktop) */
export const VISUALIZER_BAR_COUNT = 56;
/** Chu kỳ nhún ngắn nhất / dài nhất (ms) — lệch nhau nên nhìn như sóng thật */
export const VISUALIZER_MIN_DURATION_MS = 760;
export const VISUALIZER_MAX_DURATION_MS = 1_320;
/** Độ trễ lớn nhất (ms) giữa các cột */
export const VISUALIZER_MAX_DELAY_MS = 620;

export interface VisualizerBar {
  /** Độ trễ (ms) */
  delayMs: number;
  /** Chu kỳ nhún (ms) */
  durationMs: number;
  /** Chiều cao lúc "nghỉ" (%) — cột giữa cao hơn, hai bên thấp dần */
  minHeightPercent: number;
  /** Độ đậm 0..1 — cột hai bên mờ dần */
  opacity: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Sinh cấu hình cho `count` cột: biên độ giảm dần từ giữa ra hai bên, độ trễ/chu kỳ lệch nhau theo hàm
 * sin nên nhìn "như sóng" mà không cần đo âm thanh thật.
 *
 * Tính đối xứng có chủ đích: hai cột cách đều tâm có cùng chiều cao, nhìn cân hơn và cũng dễ kiểm chứng.
 */
export function visualizerBars(count = VISUALIZER_BAR_COUNT): VisualizerBar[] {
  const safeCount = Math.max(1, Math.floor(count));
  const center = (safeCount - 1) / 2;

  return Array.from({ length: safeCount }, (_, index) => {
    // 0 ở giữa -> 1 ở mép
    const distance = center === 0 ? 0 : Math.abs(index - center) / center;
    const sway = (Math.sin(index * 1.7) + 1) / 2; // 0..1

    return {
      delayMs: Math.round(sway * VISUALIZER_MAX_DELAY_MS),
      durationMs: Math.round(
        VISUALIZER_MIN_DURATION_MS +
          sway * (VISUALIZER_MAX_DURATION_MS - VISUALIZER_MIN_DURATION_MS),
      ),
      minHeightPercent: round(16 + (1 - distance) ** 1.6 * 46, 1),
      opacity: round(clamp(1 - distance * 0.62, 0.25, 1), 2),
    };
  });
}
