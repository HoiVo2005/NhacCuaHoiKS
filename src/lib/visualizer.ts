/**
 * Cấu hình + thuật toán cho hiệu ứng "sóng nhạc chạy theo nhạc" ở trình phát đầy đủ (CHỈ desktop).
 *   Kiểm chứng bằng `npm run check:visualizer`.
 *
 * Có HAI nguồn dữ liệu, cùng đổ về một mảng mức 0..1:
 *
 *  1. **Phân tích thật** (`spectrumLevels`) — chỉ làm được với **file nội bộ** (cùng origin): đọc phổ
 *     tần số qua `AnalyserNode` trên luồng lấy từ `HTMLMediaElement.captureStream()`.
 *     Vì sao KHÔNG dùng `createMediaElementSource()`: hàm đó **đổi đường ra** của thẻ <audio> (âm thanh
 *     bị đẩy qua Web Audio) — đúng thứ iOS chặn khi app ra nền (xem `needsWebAudioGraph` trong
 *     `src/lib/volume.ts`). `captureStream()` chỉ **sao chép** luồng, âm thanh vẫn đi thẳng ra loa nên
 *     không ảnh hưởng việc nghe nền. (Safari chưa hỗ trợ -> tự rơi về mô phỏng.)
 *  2. **Nhịp mô phỏng** (`simulatedLevels`) — cho nguồn nhúng (YouTube/SoundCloud/TikTok): âm thanh
 *     nằm trong `iframe` khác miền nên KHÔNG THỂ phân tích. Hàm này dựng nhịp theo từng "phách" dựa
 *     trên **vị trí bài hát** (giây) nên vẫn đổi hình theo bài và thẳng nhịp khi người dùng tua.
 *
 * Toàn bộ hàm ở đây THUẦN (không đụng DOM, không `Math.random`) nên chạy được trong Node để kiểm chứng
 * và không gây lệch hydration.
 */

/** Số cột sóng nhạc (đủ lấp bề ngang khung nội dung trên desktop) */
export const VISUALIZER_BAR_COUNT = 56;

/** Kích thước FFT: 256 -> 128 bin, đủ chi tiết cho 56 cột mà không tốn CPU */
export const VISUALIZER_ANALYSER_FFT_SIZE = 256;

/** Độ dài một "phách" khi mô phỏng (~125 BPM) — chỉ dùng cho nguồn không phân tích được âm thanh */
export const VISUALIZER_BEAT_MS = 480;

/** Cột vọt lên nhanh (attack) nhưng rơi xuống chậm (release) — giống equalizer thật */
export const VISUALIZER_ATTACK = 0.55;
export const VISUALIZER_RELEASE = 0.13;

/** Mức nhỏ nhất khi vẽ (không bao giờ bằng 0 -> luôn thấy "đáy" của dải sóng) */
export const VISUALIZER_MIN_SCALE = 0.06;

/** Mức nền của cột trầm (trái) và cột cao (phải) */
export const VISUALIZER_REST_BASS = 0.3;
export const VISUALIZER_REST_TREBLE = 0.12;

export type VisualizerMode = "spectrum" | "simulated" | "idle";

export interface VisualizerBar {
  /** Mức lúc nghỉ (0..1) — cột trầm cao hơn cột cao */
  restLevel: number;
  /** Độ đậm 0..1 — cột phía "cao" mờ hơn một chút */
  opacity: number;
}


function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Cấu hình từng cột: cột trầm (bên trái) có mức nền cao và đậm, càng về phía cao (bên phải) càng thấp
 * và mờ hơn. Nhờ vậy dải sóng vẫn có "hình" khi nhạc đang tạm dừng.
 */
export function visualizerBars(count = VISUALIZER_BAR_COUNT): VisualizerBar[] {
  const bars = Math.max(1, Math.floor(count));

  return Array.from({ length: bars }, (_, index) => {
    // 0 = trầm (trái) -> 1 = cao (phải)
    const band = bars === 1 ? 0 : index / (bars - 1);

    return {
      restLevel: round(
        VISUALIZER_REST_BASS + (VISUALIZER_REST_TREBLE - VISUALIZER_REST_BASS) * band,
      ),
      opacity: round(1 - band * 0.35, 2),
    };
  });
}

/**
 * Đọc phổ tần số (`maxBinValue` là giá trị lớn nhất, ví dụ 255) thành `count` mức 0..1 cho các cột.
 *
 * - Bỏ bin 0 (thành phần một chiều, luôn lớn bất thường).
 * - Chia theo thang **log** (mũ 1.8) vì tai người nghe không tuyến tính — nửa phổ phía trầm dồn vào nửa
 *   số cột đầu, đúng cách các equalizer thật vẽ.
 * - Lấy **trung bình** trong mỗi nhóm rồi nâng nhẹ (mũ 1.1) để phần nhạc nhỏ vẫn nhìn thấy.
 */
export function spectrumLevels(
  bins: ArrayLike<number>,
  count = VISUALIZER_BAR_COUNT,
  maxBinValue = 255,
): number[] {
  const bars = Math.max(1, Math.floor(count));
  const total = bins.length;

  if (total <= 1 || maxBinValue <= 0) return new Array(bars).fill(0);

  const edge = (index: number): number => 1 + Math.floor(Math.pow(index / bars, 1.8) * (total - 1));

  return Array.from({ length: bars }, (_, index) => {
    const from = edge(index);
    const to = Math.max(from + 1, edge(index + 1));

    let sum = 0;
    let counted = 0;

    for (let bin = from; bin < to && bin < total; bin += 1) {
      sum += bins[bin];
      counted += 1;
    }

    if (counted === 0) return 0;

    return clamp(round(Math.pow(sum / counted / maxBinValue, 1.1)), 0, 1);
  });
}

/**
 * Nhịp MÔ PHỎNG cho nguồn không phân tích được âm thanh (YouTube/SoundCloud/TikTok).
 *
 * `seconds` là vị trí đang phát của bài (giây, có thể lẻ) — nhờ vậy hình đổi theo bài và thẳng lại đúng
 * nhịp sau khi người dùng tua. Mỗi phách có một xung mạnh (cột trầm nhún nhiều nhất), cộng thêm nhịp
 * phụ nhanh gấp đôi và dao động riêng của từng cột để dải sóng không "đều như máy".
 */
export function simulatedLevels(
  seconds: number,
  count = VISUALIZER_BAR_COUNT,
  beatMs = VISUALIZER_BEAT_MS,
): number[] {
  const bars = Math.max(1, Math.floor(count));
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const period = beatMs > 0 ? beatMs : VISUALIZER_BEAT_MS;

  const beatPhase = ((safeSeconds * 1000) % period) / period;
  const kick = Math.pow(1 - beatPhase, 3);

  const halfPhase = ((safeSeconds * 1000) % (period / 2)) / (period / 2);
  const hat = Math.pow(1 - halfPhase, 6);

  return Array.from({ length: bars }, (_, index) => {
    const band = bars === 1 ? 0 : index / (bars - 1); // 0 = trầm -> 1 = cao
    const bassWeight = Math.pow(1 - band, 2);
    const trebleWeight = Math.pow(band, 1.5);
    const sway = (Math.sin(safeSeconds * (2.2 + band * 7.5) * Math.PI * 2) + 1) / 2;

    return clamp(
      round(
        0.12 +
          kick * (0.55 * bassWeight + 0.18 * trebleWeight) +
          hat * 0.22 * trebleWeight +
          sway * (0.18 + 0.25 * band),
      ),
      0,
      1,
    );
  });
}

/**
 * Làm mượt mức của từng cột về phía mức đích: **lên nhanh, xuống chậm**.
 * Nhờ vậy cột bám phổ thật nhưng không giật theo từng khung hình.
 */
export function smoothLevels(
  previous: number[],
  target: number[],
  attack = VISUALIZER_ATTACK,
  release = VISUALIZER_RELEASE,
): number[] {
  const length = Math.min(previous.length, target.length);

  return Array.from({ length }, (_, index) => {
    const from = previous[index];
    const to = target[index];
    const factor = to > from ? attack : release;

    return clamp(from + (to - from) * factor, 0, 1);
  });
}

/** Mức 0..1 -> hệ số `scaleY` ghi vào DOM (luôn giữ lại một đoạn đáy cột) */
export function levelToScale(level: number): number {
  if (!Number.isFinite(level)) return VISUALIZER_MIN_SCALE;

  return round(clamp(level, VISUALIZER_MIN_SCALE, 1), 3);
}

