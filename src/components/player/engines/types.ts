import type { SongDTO } from "@/types";

export interface PlayerAdapterCallbacks {
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onDuration?: (duration: number) => void;
  onBuffering?: (buffering: boolean) => void;
  onError?: (message: string) => void;
}

/**
 * Interface chung cho cac "dong co phat nhac" (YouTube/SoundCloud/TikTok/Audio).
 * Moi adapter chi dung API/SDK chinh thuc cua nen tang.
 */
export interface PlayerEngine {
  readonly type: string;
  load(song: SongDTO, startAt?: number): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(seconds: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  destroy(): void;
  /**
   * "Ham nong": chuan bi san nen tang truoc khi nguoi dung bam phat.
   *
   * Ly do: API cua cac nen tang (YouTube iframe API ~300KB, SoundCloud Widget API) truoc day
   * chi duoc tai khi nguoi dung bam phat lan dau, nen bai dau tien phai cho:
   * tai script -> tao iframe player -> cho `onReady` -> moi nap duoc bai (vai giay, lau hon
   * nhieu so voi thao tac bam). Goi `prewarm()` luc trang dang ranh de lo phan cho do.
   *
   * Khong bat buoc: engine nao khong co gi de chuan bi thi bo qua.
   */
  prewarm?: () => void;
}
