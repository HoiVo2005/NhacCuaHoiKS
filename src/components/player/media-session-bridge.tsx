"use client";

import { useEffect, useMemo, useRef } from "react";

import {
  MEDIA_SESSION_ACTIONS,
  MEDIA_SESSION_SEEK_STEP_SECONDS,
  mediaPositionStateFor,
  mediaSessionActionsFor,
  mediaSessionInfoFor,
  shouldRefreshMediaPosition,
  type MediaArtwork,
} from "@/lib/media-session";
import { usePlayerStore } from "@/store/player-store";

/**
 * API man hinh khoa - khai bao dang "co the khong ton tai":
 * trinh duyet cu / trang chay qua HTTP thuong se khong co `navigator.mediaSession`.
 */
interface MediaSessionLike {
  metadata: unknown;
  playbackState: "none" | "paused" | "playing";
  setActionHandler: (
    action: string,
    handler: ((details: { seekTime?: number }) => void) | null,
  ) => void;
  setPositionState?: (state?: { duration: number; position: number; playbackRate: number }) => void;
}

type MediaMetadataCtor = new (init: {
  title: string;
  artist: string;
  album: string;
  artwork: MediaArtwork[];
}) => unknown;

function mediaSessionApi(): MediaSessionLike | null {
  if (typeof navigator === "undefined") return null;

  const session = (navigator as Navigator & { mediaSession?: MediaSessionLike }).mediaSession;
  return session ?? null;
}

function mediaMetadataConstructor(): MediaMetadataCtor | null {
  const candidate = (globalThis as { MediaMetadata?: unknown }).MediaMetadata;
  return typeof candidate === "function" ? (candidate as MediaMetadataCtor) : null;
}

/**
 * Cau noi giua trinh phat va MAN HINH KHOA / thanh thong bao / nut tren tai nghe.
 *
 * Nho vay tren dien thoai (hoac khi dang lam viec o cua so khac): tieu de, nghe si, anh bia, thanh
 * keo thoi gian va cac nut Phat / Tam dung / Tua / Bai truoc / Bai sau deu dung duoc ngay tren man
 * hinh khoa va tai nghe Bluetooth - khong phai mo lai trang.
 *
 * Anh bia dung ban NET NHAT (`src/lib/music/thumbnails.ts`) vi man hinh khoa hien anh rat lon.
 * Moi loi goi API deu duoc bao ve: trinh duyet khong ho tro (Safari khong co `seekto`...) thi bo qua.
 */
export function MediaSessionBridge() {
  const current = usePlayerStore((state) => state.current);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const duration = usePlayerStore((state) => state.duration);
  const progress = usePlayerStore((state) => state.progress);

  /* Nguồn đang phát: quyết định nút nào được đăng ký với màn hình khoá */
  const sourceType = current?.sourceType;
  const hasCurrent = current !== null;

  /** Vi tri da hien len man hinh khoa lan cuoi (de khong cap nhat lai y nguyen) */
  const lastPositionRef = useRef({ seconds: -1, at: 0 });

  /**
   * Thông tin bài nhạc hiện trên màn hình khoá, tính sẵn thành một đối tượng.
   * Nhờ vậy effect bên dưới chỉ phụ thuộc ĐÚNG dữ liệu này (không phụ thuộc cả object `current`,
   * vốn cũng đổi khi bật/tắt yêu thích hay đồng bộ thời lượng).
   */
  const mediaInfo = useMemo(() => (current ? mediaSessionInfoFor(current) : null), [current]);

  // 1. Thong tin bai nhac (tieu de, nghe si, album, anh bia)
  useEffect(() => {
    const session = mediaSessionApi();
    const Metadata = mediaMetadataConstructor();
    if (!session || !Metadata) return;

    if (!mediaInfo) {
      session.metadata = null;
      return;
    }

    session.metadata = new Metadata(mediaInfo);
  }, [mediaInfo]);

  // 2. Nut dieu khien tren man hinh khoa / tai nghe (chi dang ky cho toi da cac hanh dong ho tro)
  useEffect(() => {
    const session = mediaSessionApi();
    if (!session) return;

    /** Tua tuong doi theo buoc 10 giay, gioi han trong [0, thoi luong] nhu khi keo thanh thoi gian */
    const seekBy = (delta: number): void => {
      const store = usePlayerStore.getState();
      store.requestSeekPosition(store.progress + delta);
    };

    const handlers: Record<string, (details: { seekTime?: number }) => void> = {
      play: () => usePlayerStore.getState().setPlaying(true),
      pause: () => usePlayerStore.getState().setPlaying(false),
      previoustrack: () => usePlayerStore.getState().previous(),
      nexttrack: () => usePlayerStore.getState().next(),
      seekbackward: () => seekBy(-MEDIA_SESSION_SEEK_STEP_SECONDS),
      seekforward: () => seekBy(MEDIA_SESSION_SEEK_STEP_SECONDS),
      seekto: (details) => {
        if (typeof details.seekTime === "number") {
          usePlayerStore.getState().requestSeekPosition(details.seekTime);
        }
      },
      stop: () => usePlayerStore.getState().setPlaying(false),
    };

    const supported = new Set<string>(mediaSessionActionsFor(sourceType));

    for (const action of MEDIA_SESSION_ACTIONS) {
      try {
        // Nguon khong tua duoc -> go handler (truyen null) de man hinh khoa khong hien nut vo tac dung
        session.setActionHandler(action, supported.has(action) ? handlers[action] : null);
      } catch {
        // Trinh duyet khong ho tro hanh dong nay (vi du Safari: seekto / stop) -> bo qua
      }
    }

    return () => {
      for (const action of MEDIA_SESSION_ACTIONS) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // khong ho tro -> khong co gi de go
        }
      }
    };
  }, [sourceType]);

  // 3. Dang phat hay tam dung (bieu tuong play/pause tren man hinh khoa)
  useEffect(() => {
    const session = mediaSessionApi();
    if (!session) return;

    session.playbackState = hasCurrent ? (isPlaying ? "playing" : "paused") : "none";
  }, [isPlaying, hasCurrent]);

  // 4. Thanh keo thoi gian tren man hinh khoa
  useEffect(() => {
    const session = mediaSessionApi();
    if (!session?.setPositionState) return;

    const now = Date.now();
    const last = lastPositionRef.current;

    if (
      !shouldRefreshMediaPosition({
        isPlaying,
        positionSeconds: progress,
        lastSeconds: last.seconds,
        lastAt: last.at,
        now,
      })
    ) {
      return;
    }

    const state = mediaPositionStateFor({ durationSeconds: duration, positionSeconds: progress });
    if (!state) return;

    try {
      session.setPositionState(state);
      lastPositionRef.current = { seconds: progress, at: now };
    } catch {
      // Gia tri chua hop le (vi du thoi luong vua doi) -> se cap nhat lai o lan bao tien do sau
    }
  }, [progress, duration, isPlaying]);

  return null;
}
