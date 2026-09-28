/**
 * "Media Session" - thong tin bai nhac hien tren MAN HINH KHOA / thanh thong bao / tai nghe
 * (logic thuan, kiem chung bang `npm run check:media`).
 *
 * Vi sao tach ra lib thuan:
 *  - `navigator.mediaSession.setPositionState()` NEM LOI khi gia tri khong hop le (duration <= 0,
 *    position > duration, playbackRate <= 0). Loi nay xay ra ngay khi bai vua nap (duration = 0)
 *    nen phai kiem tra truoc khi goi API.
 *  - Anh bia phai la ban NET NHAT (`src/lib/music/thumbnails.ts`) - man hinh khoa hien anh rat lon.
 *  - Chi dang ky nhung hanh dong ma nguon phat thuc su ho tro (`PLAYER_CAPABILITIES`).
 */

import { APP_NAME, PLAYER_CAPABILITIES } from "@/lib/constants";
import { thumbnailFallbackUrls } from "@/lib/music/thumbnails";
import type { SongDTO, SourceType } from "@/types";

/** Moi lan bam nut tua tren man hinh khoa */
export const MEDIA_SESSION_SEEK_STEP_SECONDS = 10;

/**
 * Khi dang phat: 5 giay cap nhat vi tri mot lan la du - trinh duyet tu noi suy vi tri giua hai
 * lan cap nhat, con cap nhat qua day thi chi ton CPU (man hinh khoa khong hien muot hon).
 */
export const MEDIA_SESSION_POSITION_REFRESH_MS = 5_000;

export type MediaSessionAction =
  | "play"
  | "pause"
  | "previoustrack"
  | "nexttrack"
  | "seekbackward"
  | "seekforward"
  | "seekto"
  | "stop";

export const MEDIA_SESSION_ACTIONS: MediaSessionAction[] = [
  "play",
  "pause",
  "previoustrack",
  "nexttrack",
  "seekbackward",
  "seekforward",
  "seekto",
  "stop",
];

/** Cac hanh dong can dang ky cho nguon dang phat (nguon khong tua duoc thi khong dang ky tua) */
export function mediaSessionActionsFor(sourceType: SourceType | null | undefined): MediaSessionAction[] {
  const base: MediaSessionAction[] = ["play", "pause", "previoustrack", "nexttrack", "stop"];
  if (!sourceType || !PLAYER_CAPABILITIES[sourceType]?.canSeek) return base;

  return [...base, "seekbackward", "seekforward", "seekto"];
}

export interface MediaArtwork {
  src: string;
  sizes?: string;
  type?: string;
}

/** Kich thuoc that cua ban bia net nhat theo tung nguon (khai bao sai se lam man hinh khoa chon nham) */
function artworkSizesFor(sourceType: SourceType): string | undefined {
  if (sourceType === "YOUTUBE") return "1280x720";
  if (sourceType === "SOUNDCLOUD") return "500x500";
  return undefined;
}

function imageTypeOf(url: string): string | undefined {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  return undefined;
}

/** Anh bia cho man hinh khoa - dung ban net nhat, bo qua khi bai khong co bia */
export function mediaArtworkFor(song: SongDTO): MediaArtwork[] {
  const [sharp] = thumbnailFallbackUrls(song.thumbnailUrl);
  if (!sharp) return [];

  const sizes = artworkSizesFor(song.sourceType);
  const type = imageTypeOf(sharp);

  return [{ src: sharp, ...(sizes ? { sizes } : {}), ...(type ? { type } : {}) }];
}

export interface MediaSessionInfo {
  title: string;
  artist: string;
  album: string;
  artwork: MediaArtwork[];
}

/** Thong tin hien tren man hinh khoa (album trong thi lay ten he thong lam nhan nhan dien) */
export function mediaSessionInfoFor(song: SongDTO): MediaSessionInfo {
  return {
    title: song.title,
    artist: song.artist?.trim() || "Không rõ nghệ sĩ",
    album: song.album?.trim() || APP_NAME,
    artwork: mediaArtworkFor(song),
  };
}

export interface MediaPositionState {
  duration: number;
  position: number;
  playbackRate: number;
}

/**
 * Trang thai vi tri cho thanh keo tren man hinh khoa.
 * Tra ve `null` khi khong hop le (chua biet thoi luong...) - luc do KHONG duoc goi API.
 */
export function mediaPositionStateFor(input: {
  durationSeconds: number;
  positionSeconds: number;
  playbackRate?: number;
}): MediaPositionState | null {
  const rate = input.playbackRate ?? 1;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) return null;

  const rawPosition = Number.isFinite(input.positionSeconds) ? input.positionSeconds : 0;

  return {
    duration: input.durationSeconds,
    position: Math.min(Math.max(rawPosition, 0), input.durationSeconds),
    playbackRate: rate,
  };
}

/**
 * Co can cap nhat vi tri len man hinh khoa luc nay khong?
 *  - Vi tri khong doi -> khong can.
 *  - Dang phat -> toi da `MEDIA_SESSION_POSITION_REFRESH_MS` mot lan (tiet kiem CPU).
 *  - Dang tam dung / vua tua -> cap nhat ngay de man hinh khoa hien dung.
 */
export function shouldRefreshMediaPosition(input: {
  isPlaying: boolean;
  positionSeconds: number;
  lastSeconds: number;
  lastAt: number;
  now: number;
}): boolean {
  const moved = Math.abs(input.positionSeconds - input.lastSeconds) >= 1;
  if (!moved) return false;
  if (!input.isPlaying) return true;

  return input.now - input.lastAt >= MEDIA_SESSION_POSITION_REFRESH_MS;
}
