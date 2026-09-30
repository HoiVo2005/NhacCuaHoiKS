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
   * Trinh phat dang THAT SU phat? (khong khai bao = khong biet)
   *
   * Dung khi quay lai tien canh: trinh duyet co the da tu tam dung dong co trong luc trang bi an ma
   * KHONG bao gi - phai hoi thang de biet co can goi `play()` lan nua khong
   * (xem `shouldRetryResumePlayback` trong `src/lib/background-playback.ts`).
   */
  reportsPlaying?: () => boolean;
  /**
   * Am luong duoi 100% tren thiet bi nay do HE THONG quan ly? (trinh duyet bo qua `audio.volume`)
   *
   * Co = giao dien nen noi ro cho nguoi dung biet vi sao keo thanh am luong khong doi duoc gi
   * (xem `needsWebAudioGraph` trong `src/lib/volume.ts` va `AudioEngine.usesWebAudio`).
   */
  readonly volumeNeedsSystemControl?: boolean;
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
