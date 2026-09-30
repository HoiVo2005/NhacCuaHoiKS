"use client";

import { bpmToBeatMs, clampBpm, phaseOffsetFor, VISUALIZER_DEFAULT_BPM } from "@/lib/visualizer";

/**
 * Nhịp dùng cho phần **mô phỏng** sóng nhạc (nguồn nhúng: YouTube/SoundCloud/TikTok).
 *
 * Vì sao cần: âm thanh của nguồn nhúng nằm trong `iframe` khác miền nên web **không thể** phân tích phổ để
 * biết nhịp thật. Cách duy nhất để sóng khớp nhạc là để **người dùng chỉnh/gõ nhịp** — tai người căn chính
 * xác hơn mọi con số mặc định. Nhịp được nhớ trong `localStorage` và đọc rẻ để vòng lặp vẽ dùng mỗi khung
 * hình.
 *
 * File nội bộ (UPLOADED) KHÔNG dùng nhịp này: âm thanh được phân tích thật (xem `use-visualizer-levels`).
 */
export interface VisualizerBeat {
  bpm: number;
  /** Canh pha (ms) để phách rơi đúng vào nhịp bài hát */
  offsetMs: number;
}

/** Khoá localStorage nhớ nhịp người dùng đã chỉnh / gõ */
export const VISUALIZER_BEAT_STORAGE_KEY = "nhaccuahoiks-visualizer-beat";

export const DEFAULT_VISUALIZER_BEAT: VisualizerBeat = {
  bpm: VISUALIZER_DEFAULT_BPM,
  offsetMs: 0,
};

let current: VisualizerBeat = DEFAULT_VISUALIZER_BEAT;
let loaded = false;

const listeners = new Set<() => void>();

/** Dữ liệu trong localStorage là của người dùng -> luôn kiểm tra lại trước khi dùng */
function sanitize(value: { bpm?: unknown; offsetMs?: unknown }): VisualizerBeat {
  const bpm = clampBpm(Number(value.bpm));
  const offsetMs = Number(value.offsetMs);

  return {
    bpm,
    offsetMs: Number.isFinite(offsetMs) ? ((offsetMs % 60_000) + 60_000) % 60_000 : 0,
  };
}

function load(): void {
  loaded = true;

  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(VISUALIZER_BEAT_STORAGE_KEY);
    if (!raw) return;

    current = sanitize(JSON.parse(raw) as { bpm?: unknown; offsetMs?: unknown });
  } catch {
    /* Dữ liệu hỏng -> dùng nhịp mặc định */
  }
}

/** Nhịp hiện tại (đọc rất rẻ — vòng lặp vẽ gọi mỗi khung hình) */
export function visualizerBeat(): VisualizerBeat {
  if (!loaded) load();

  return current;
}

/** Người dùng chưa chỉnh gì (đang dùng nhịp mặc định)? */
export function isDefaultVisualizerBeat(): boolean {
  const beat = visualizerBeat();

  return beat.bpm === DEFAULT_VISUALIZER_BEAT.bpm && beat.offsetMs === DEFAULT_VISUALIZER_BEAT.offsetMs;
}

/** Ghi nhịp mới (nhớ qua localStorage) và báo cho mọi nơi đang theo dõi */
export function setVisualizerBeat(next: Partial<VisualizerBeat>): void {
  current = sanitize({ ...visualizerBeat(), ...next });

  try {
    window.localStorage.setItem(VISUALIZER_BEAT_STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* Trình duyệt chặn localStorage -> chỉ nhớ trong phiên này */
  }

  for (const listener of listeners) listener();
}

/** Về nhịp mặc định (bỏ cả canh pha) */
export function resetVisualizerBeat(): void {
  current = DEFAULT_VISUALIZER_BEAT;

  try {
    window.localStorage.removeItem(VISUALIZER_BEAT_STORAGE_KEY);
  } catch {
    /* bỏ qua */
  }

  for (const listener of listeners) listener();
}

/**
 * Căn pha sau khi người dùng **gõ nhịp**: lần gõ vừa rồi nằm ở `songMs` của bài, các lần gõ cách nhau
 * `intervalMs` -> phách kế tiếp sẽ rơi vào `songMs + intervalMs`, canh pha để mô phỏng đập đúng lúc đó.
 */
export function alignVisualizerBeatTo(songMs: number, bpm: number, intervalMs: number): void {
  const beatMs = bpmToBeatMs(bpm);

  setVisualizerBeat({ bpm, offsetMs: phaseOffsetFor(songMs + intervalMs, beatMs) });
}

/** Theo dõi thay đổi nhịp (dùng cho `useSyncExternalStore`) */
export function subscribeVisualizerBeat(listener: () => void): () => void {
  listeners.add(listener);

  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => listeners.delete(listener);
  }

  const onStorage = (event: StorageEvent): void => {
    if (event.key !== null && event.key !== VISUALIZER_BEAT_STORAGE_KEY) return;

    loaded = false;
    visualizerBeat();
    listener();
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
