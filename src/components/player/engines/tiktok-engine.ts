import type { SongDTO } from "@/types";
import { DEFAULT_VOLUME, EMBED_MAX_VOLUME } from "@/lib/volume";

import type { PlayerAdapterCallbacks, PlayerEngine } from "./types";

interface TikTokMessage {
  "x-tiktok-player"?: boolean;
  type?: string;
  value?: unknown;
}

/** Duoi muc nay coi nhu tat tieng (TikTok khong nhan muc am luong chi tiet) */
const SILENT_VOLUME = 0.05;

/** Gioi han muc am luong cua nen tang (TikTok toi da 100%) */
function clampEmbedVolume(volume: number): number {
  if (!Number.isFinite(volume)) return DEFAULT_VOLUME;
  return Math.min(Math.max(volume, 0), EMBED_MAX_VOLUME);
}

/**
 * Phat video TikTok bang TikTok Embed Player chinh thuc.
 * Dieu khien qua postMessage (play / pause / seekTo / mute / unMute).
 *
 * Han che that cua nen tang:
 *  - Khong ho tro chinh am luong theo muc (chi mute/unMute) - API chinh thuc khong co
 *    lenh `volume`, nen thanh truot am luong chi co tac dung o muc 0% (tat tieng).
 *  - Khong co API lay thoi luong truoc khi phat (se cap nhat qua onCurrentTime)
 */
export class TikTokEngine implements PlayerEngine {
  readonly type = "TIKTOK";

  private iframe: HTMLIFrameElement | null = null;
  private container: HTMLElement;
  private callbacks: PlayerAdapterCallbacks;
  private listener: ((event: MessageEvent) => void) | null = null;
  private durationSeconds = 0;
  private lastVolume = DEFAULT_VOLUME;
  private muted = false;

  constructor(container: HTMLElement, callbacks: PlayerAdapterCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  private post(type: string, value?: unknown): void {
    this.iframe?.contentWindow?.postMessage(
      { "x-tiktok-player": true, type, value },
      "*",
    );
  }

  /**
   * TikTok chi biet tat/bat tieng, nen muc am luong va trang thai mute phai duoc gop lai
   * truoc khi gui lenh. Neu khong, `setVolume(0)` (tat tieng) se bi `setMuted(false)`
   * (bat tieng) ngay sau do ghi de -> keo am luong ve 0 ma video van co tieng.
   */
  private applyMuteState(): void {
    const silent = this.muted || this.lastVolume <= SILENT_VOLUME;
    this.post(silent ? "mute" : "unMute");
  }

  private handleMessage = (event: MessageEvent): void => {
    const data = event.data as TikTokMessage | undefined;
    if (!data || typeof data !== "object" || !data["x-tiktok-player"]) return;

    const payload = (data.value ?? {}) as {
      currentTime?: number;
      duration?: number;
    };

    switch (data.type) {
      case "onPlayerReady":
        this.callbacks.onReady?.();
        break;
      case "onStateChange": {
        const state = Number(data.value);
        if (state === 1) {
          this.callbacks.onPlay?.();
          this.callbacks.onBuffering?.(false);
        } else if (state === 2) {
          this.callbacks.onPause?.();
        } else if (state === 0) {
          this.callbacks.onEnded?.();
        } else if (state === 3) {
          this.callbacks.onBuffering?.(true);
        }
        break;
      }
      case "onCurrentTime": {
        const currentTime = Number(payload.currentTime ?? 0);
        const duration = Number(payload.duration ?? 0);
        if (duration > 0 && duration !== this.durationSeconds) {
          this.durationSeconds = duration;
          this.callbacks.onDuration?.(duration);
        }
        this.callbacks.onTimeUpdate?.(currentTime, this.durationSeconds);
        break;
      }
      case "onPlayerError":
        this.callbacks.onError?.(
          "Không phát được video TikTok (video có thể bị giới hạn hoặc đã bị xoá).",
        );
        break;
      default:
        break;
    }
  };

  private async ensureIframe(embedUrl: string): Promise<void> {
    if (this.iframe && this.iframe.src !== embedUrl) {
      this.iframe.remove();
      this.iframe = null;
    }

    if (this.iframe) return;

    await new Promise<void>((resolve) => {
      const iframe = document.createElement("iframe");
      // autoplay=1 de TikTok bat dau phat ngay sau thao tac bam phat cua nguoi dung
      iframe.src = embedUrl.replace("autoplay=0", "autoplay=1");
      iframe.allow = "autoplay; encrypted-media; fullscreen";
      iframe.setAttribute("allowfullscreen", "true");
      iframe.width = "100%";
      iframe.height = "100%";
      iframe.title = "TikTok player";

      iframe.addEventListener("load", () => {
        window.setTimeout(() => {
          this.callbacks.onReady?.();
          resolve();
        }, 500);
      });

      this.container.appendChild(iframe);
      this.iframe = iframe;
    });
  }

  async load(song: SongDTO, startAt = 0): Promise<void> {
    if (!song.embedUrl) {
      this.callbacks.onError?.("Bài nhạc thiếu đường dẫn nhúng TikTok.");
      return;
    }

    this.callbacks.onBuffering?.(true);
    this.durationSeconds = 0;

    if (!this.listener) {
      this.listener = this.handleMessage;
      window.addEventListener("message", this.listener);
    }

    await this.ensureIframe(song.embedUrl);

    if (startAt > 0) {
      window.setTimeout(() => this.post("seekTo", startAt), 800);
    }

    this.callbacks.onBuffering?.(false);
  }

  async play(): Promise<void> {
    this.post("play");
    // Ap dung lai trang thai tieng da chon (truoc day luon unMute -> mat trang thai tat tieng)
    this.applyMuteState();
  }

  async pause(): Promise<void> {
    this.post("pause");
  }

  seek(seconds: number): void {
    this.post("seekTo", Math.max(0, Math.round(seconds)));
  }

  /**
   * TikTok khong co lenh dat am luong theo muc: chi ghi nho muc nguoi dung chon de
   * quyet dinh tat/bat tieng (0% = tat tieng), cac muc khac giu nguyen am luong goc.
   */
  setVolume(volume: number): void {
    this.lastVolume = clampEmbedVolume(volume);
    this.applyMuteState();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMuteState();
  }

  destroy(): void {
    if (this.listener) {
      window.removeEventListener("message", this.listener);
      this.listener = null;
    }

    this.iframe?.remove();
    this.iframe = null;
  }
}
