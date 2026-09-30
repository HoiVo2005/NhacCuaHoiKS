"use client";

import { useEffect, useState } from "react";

import { audioElement, watchAudioElement } from "@/components/player/audio-source";
import type { VisualizerMode } from "@/lib/visualizer";
import {
  simulatedLevels,
  smoothLevels,
  spectrumLevels,
  visualizerBars,
  VISUALIZER_ANALYSER_FFT_SIZE,
  VISUALIZER_BAR_COUNT,
  VISUALIZER_BEAT_MS,
} from "@/lib/visualizer";
import { usePlayerStore } from "@/store/player-store";

/**
 * Vòng lặp vẽ sóng nhạc (chạy bằng `requestAnimationFrame`).
 *
 * Ba nguyên tắc:
 *  1. **Không re-render React mỗi khung hình**: hook đọc trạng thái qua `usePlayerStore.getState()` và
 *     đẩy mức ra ngoài bằng `apply(levels)` để giao diện ghi thẳng vào DOM (`transform: scaleY`).
 *  2. **Phân tích thật khi có thể** (chỉ file nội bộ): xem `createSpectrumSource`.
 *  3. **Không phân tích được thì mô phỏng nhịp** theo vị trí bài hát (nguồn nhúng nằm trong `iframe`
 *     khác miền — không có cách nào lấy phổ âm thanh).
 */

/** Không nhận được tín hiệu bao nhiêu khung hình liên tiếp thì thôi phân tích, quay về nhịp mô phỏng */
const SILENT_FRAMES_LIMIT = 90;
/** Lệch quá bấy nhiêu giây so với dự kiến thì coi là người dùng vừa tua -> canh lại nhịp */
const SEEK_JUMP_SECONDS = 1.5;
/** Bước nhảy khung hình lớn nhất (ms) để nhịp không "vọt" khi tab bị treo rồi quay lại */
const MAX_FRAME_STEP_MS = 64;

/** Bộ đọc phổ âm thanh tuỳ chọn — chỉ dùng cho thẻ `<audio>` (file nội bộ) */
interface SpectrumSource {
  /** Đọc phổ vào `bins`; trả `false` khi chưa có dữ liệu (bộ xử lý đang bị treo) */
  read(bins: Uint8Array<ArrayBuffer>): boolean;
  suspend(): void;
  resume(): void;
  stop(): void;
}

/**
 * Tạo bộ đọc phổ từ thẻ media, KHÔNG làm thay đổi âm thanh người dùng đang nghe.
 *
 * - Dùng `HTMLMediaElement.captureStream()`: nó **sao chép** luồng ra của thẻ, ta chỉ nghe trộm bản sao
 *   đó. KHÔNG dùng `createMediaElementSource()` vì hàm đó **đổi đường ra** của thẻ (âm thanh bị đẩy qua
 *   Web Audio) và như vậy là mất khả năng nghe khi app ra nền trên iOS — đúng lỗi đã sửa ở
 *   `src/lib/volume.ts` (`needsWebAudioGraph`).
 * - Chỉ nối `analyser`, KHÔNG nối vào `context.destination` (nếu nối sẽ nghe 2 lần).
 * - Trình duyệt không hỗ trợ (Safari chưa có `captureStream`) -> trả `null` để dùng nhịp mô phỏng.
 */
function createSpectrumSource(element: HTMLAudioElement): SpectrumSource | null {
  if (typeof window === "undefined") return null;

  const media = element as HTMLAudioElement & { captureStream?: () => MediaStream };
  if (typeof media.captureStream !== "function") return null;

  const ContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!ContextClass) return null;

  try {
    const context = new ContextClass();
    const source = context.createMediaStreamSource(media.captureStream());
    const analyser = context.createAnalyser();

    analyser.fftSize = VISUALIZER_ANALYSER_FFT_SIZE;
    analyser.smoothingTimeConstant = 0.7;

    source.connect(analyser);

    return {
      read(bins: Uint8Array<ArrayBuffer>): boolean {
        if (context.state !== "running") return false;

        analyser.getByteFrequencyData(bins);
        return true;
      },
      suspend: () => {
        void context.suspend().catch(() => undefined);
      },
      resume: () => {
        void context.resume().catch(() => undefined);
      },
      stop: () => {
        try {
          source.disconnect();
        } catch {
          // bo qua loi khi go bo xu ly
        }
        void context.close().catch(() => undefined);
      },
    };
  } catch {
    /* Trinh duyet tu choi -> dung nhip mo phong */
    return null;
  }
}

export interface VisualizerFrameOptions {
  /** Số cột */
  count?: number;
  /** Chỉ chạy khi hiệu ứng THỰC SỰ hiển thị (desktop) và người dùng không bật "giảm chuyển động" */
  enabled?: boolean;
  /** Nhận mảng mức 0..1 mỗi khung hình (ghi thẳng vào DOM — không đưa qua state để khỏi re-render) */
  apply: (levels: number[]) => void;
}

/**
 * Chạy vòng lặp sóng nhạc và trả về chế độ đang dùng:
 *  - `spectrum`: đang đọc phổ âm thanh THẬT của file nội bộ;
 *  - `simulated`: đang dùng nhịp mô phỏng (nguồn nhúng, hoặc trình duyệt không hỗ trợ);
 *  - `idle`: nhạc đang tạm dừng / hiệu ứng đang tắt -> các cột nằm ở mức nghỉ.
 *
 * Vòng lặp tự dừng khi hook bị gỡ (unmount), khi `enabled` tắt, hoặc khi trang bị ẩn.
 */
export function useVisualizerFrame({
  count = VISUALIZER_BAR_COUNT,
  enabled = false,
  apply,
}: VisualizerFrameOptions): VisualizerMode {
  const [mode, setMode] = useState<VisualizerMode>("idle");

  useEffect(() => {
    if (!enabled) {
      setMode("idle");
      return;
    }

    const restLevels = visualizerBars(count).map((bar) => bar.restLevel);
    const bins = new Uint8Array(VISUALIZER_ANALYSER_FFT_SIZE / 2);

    let levels = restLevels.slice();
    let spectrum: SpectrumSource | null = null;
    let spectrumElement: HTMLAudioElement | null = null;
    let allowSpectrum = true;
    let silentFrames = 0;

    /** Pha trong "phách" (ms): đếm bằng đồng hồ thật cho mượt 60fps, canh lại theo vị trí bài hát */
    let beatMs = 0;
    let expectedSeconds = 0;
    let lastTimestamp = 0;
    let currentMode: VisualizerMode = "idle";

    // Trạng thái nghỉ ngay khi bật (không phải chờ khung hình đầu)
    apply(levels);

    const publishMode = (next: VisualizerMode): void => {
      if (next === currentMode) return;

      currentMode = next;
      setMode(next);
    };

    const ensureSpectrum = (): void => {
      const element = audioElement();
      if (!allowSpectrum || !element || element === spectrumElement) return;

      spectrum?.stop();
      spectrumElement = element;
      spectrum = createSpectrumSource(element);

      // Không lấy được phổ (Safari, hoặc luồng bị chặn) -> dùng nhịp mô phỏng cho cả phiên
      if (!spectrum) allowSpectrum = false;
    };

    const onVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") {
        /*
         * Trang bị ẩn: không cần đọc phổ nữa (tiết kiệm pin). Bộ xử lý phổ KHÔNG nằm trên đường phát
         * nhạc nên tạm dừng nó không ảnh hưởng tiếng đang nghe.
         */
        spectrum?.suspend();
        return;
      }

      spectrum?.resume();
      lastTimestamp = 0; // tránh nhảy một bước lớn sau khi quay lại
      expectedSeconds = usePlayerStore.getState().progress;
      beatMs = (expectedSeconds * 1000) % VISUALIZER_BEAT_MS;
    };

    const unwatch = watchAudioElement(ensureSpectrum);
    ensureSpectrum();

    document.addEventListener("visibilitychange", onVisibilityChange);

    let frame = window.requestAnimationFrame(function tick(timestamp: number): void {
      frame = window.requestAnimationFrame(tick);

      // Tab bị ẩn: trình duyệt đã hạn chế khung hình, ở đây bỏ luôn cho chắc
      if (document.visibilityState === "hidden") return;

      const delta = lastTimestamp === 0 ? 16.7 : clampFrameStep(timestamp - lastTimestamp);
      lastTimestamp = timestamp;

      const state = usePlayerStore.getState();
      const seconds = Number.isFinite(state.progress) ? state.progress : 0;

      // Người dùng tua -> canh lại pha của nhịp mô phỏng theo vị trí mới của bài
      if (Math.abs(seconds - expectedSeconds) > SEEK_JUMP_SECONDS) {
        beatMs = (seconds * 1000) % VISUALIZER_BEAT_MS;
      }

      expectedSeconds = seconds + delta / 1000;
      beatMs = (beatMs + delta) % VISUALIZER_BEAT_MS;

      if (!state.isPlaying) {
        levels = smoothLevels(levels, restLevels); // cột "ngồi xuống" mượt rồi đứng yên
        apply(levels);
        publishMode("idle");
        return;
      }

      if (allowSpectrum && spectrum && state.current?.sourceType === "UPLOADED") {
        if (spectrum.read(bins)) {
          let peak = 0;
          for (let index = 0; index < bins.length; index += 1) {
            if (bins[index] > peak) peak = bins[index];
          }

          silentFrames = peak > 4 ? 0 : silentFrames + 1;

          if (silentFrames <= SILENT_FRAMES_LIMIT) {
            levels = smoothLevels(levels, spectrumLevels(bins, count));
            apply(levels);
            publishMode("spectrum");
            return;
          }

          // Im lặng bất thường (luồng bị chặn, âm thanh đi ra thiết bị khác...) -> thôi phân tích
          allowSpectrum = false;
        }
      }

      levels = smoothLevels(levels, simulatedLevels(beatMs / 1000, count));
      apply(levels);
      publishMode("simulated");
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      unwatch();
      spectrum?.stop();
      spectrum = null;
      spectrumElement = null;
    };
  }, [count, enabled, apply]);

  return mode;
}

/** Bước nhảy khung hình đã giới hạn (không âm, không quá lớn khi tab bị treo rồi quay lại) */
function clampFrameStep(delta: number): number {
  if (!Number.isFinite(delta)) return 16.7;

  return Math.min(Math.max(delta, 0), MAX_FRAME_STEP_MS);
}
