import type { SongDTO } from "@/types";

import {
  loadSoundCloudWidgetApi,
  widgetEventName,
  type SoundCloudWidget,
} from "@/lib/music/soundcloud-widget-client";
import { DEFAULT_VOLUME, EMBED_MAX_VOLUME, MAX_VOLUME } from "@/lib/volume";

import type { PlayerAdapterCallbacks, PlayerEngine } from "./types";

/** Chu ky lay tien do du phong khi widget khong ban su kien playProgress (ms) */
const PROGRESS_POLL_MS = 1000;
/** So lan toi da hoi thoi luong tu widget */
const MAX_DURATION_ATTEMPTS = 8;

/**
 * Nguon nhung khong khuech dai duoc: muc 200% cua giao dien duoc quy ve 100%
 * am luong thuc te cua widget.
 */
function clampEmbedVolume(volume: number): number {
  if (!Number.isFinite(volume)) return DEFAULT_VOLUME;
  return Math.min(Math.max(volume, 0), EMBED_MAX_VOLUME, MAX_VOLUME);
}

/**
 * Phat nhac SoundCloud bang Widget API chinh thuc (w.soundcloud.com/player).
 * SoundCloud khong cho phep tai file truc tiep nen he thong chi nhung widget.
 */
export class SoundCloudEngine implements PlayerEngine {
  readonly type = "SOUNDCLOUD";

  private iframe: HTMLIFrameElement | null = null;
  private widget: SoundCloudWidget | null = null;
  private container: HTMLElement;
  private callbacks: PlayerAdapterCallbacks;
  private ready = false;
  private pendingPlay = false;
  /**
   * Widget dang PHAT theo su kien PLAY/PAUSE/FINISH moi nhat (dung cho `reportsPlaying` -
   * xem ly do trong phuong thuc).
   */
  private playing = false;
  private durationSeconds = 0;
  private durationAttempts = 0;
  private progressTimer: number | null = null;
  private boundEvents: string[] = [];
  /** Am luong nguoi dung da chon (0..1) - khoi phuc lai sau khi tao widget moi */
  private lastVolume = DEFAULT_VOLUME;
  private muted = false;

  constructor(container: HTMLElement, callbacks: PlayerAdapterCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  private async ensureWidget(embedUrl: string): Promise<void> {
    await loadSoundCloudWidgetApi();

    if (this.iframe && this.iframe.src !== embedUrl) {
      this.destroyWidget();
    }

    if (this.iframe) return;

    await new Promise<void>((resolve) => {
      const iframe = document.createElement("iframe");
      iframe.src = embedUrl;
      iframe.allow = "autoplay";
      iframe.width = "100%";
      iframe.height = "100%";
      iframe.frameBorder = "0";
      iframe.title = "SoundCloud player";

      iframe.addEventListener("load", () => {
        const namespace = window.SC;

        if (!namespace?.Widget) {
          this.callbacks.onError?.(
            "Không tải được trình phát SoundCloud. Vui lòng kiểm tra kết nối mạng.",
          );
          resolve();
          return;
        }

        try {
          this.widget = namespace.Widget(iframe);
          this.bindWidgetEvents();
          // Widget moi luon bat dau o am luong mac dinh cua SoundCloud (100%)
          // -> ap dung lai muc nguoi dung da chon (doi bai khong lam mat am luong)
          this.applyVolume();
          this.ready = true;
        } catch {
          this.widget = null;
          this.callbacks.onError?.("Không kết nối được trình phát SoundCloud.");
        }

        resolve();
      });

      this.container.appendChild(iframe);
      this.iframe = iframe;
    });
  }

  /**
   * Ham nong: tai truoc Widget API cua SoundCloud.
   *
   * Widget that chi tao duoc khi biet bai nhac (can `embedUrl`), nhung script API thi khong:
   * tai truoc de lan bam phat dau tien khong phai cho tai script roi moi tao iframe.
   */
  prewarm(): void {
    void loadSoundCloudWidgetApi();
  }

  /**
   * Dang ky cac su kien cua widget.
   * widgetEventName() luon tra ve ten su kien chuan (co gia tri du phong) nen
   * viec bind khong bao gio nem loi - truoc day lay sai `SC.WidgetEvents` khien
   * khong su kien nao duoc dang ky (nhac chay nhung thoi gian dung yen).
   */
  private bindWidgetEvents(): void {
    const widget = this.widget;
    if (!widget) return;

    const bind = (name: string, handler: (data?: unknown) => void) => {
      widget.bind(name, handler);
      this.boundEvents.push(name);
    };

    bind(widgetEventName("READY"), () => {
      this.playing = false;
      this.callbacks.onReady?.();
      this.refreshDuration();

      if (this.pendingPlay) {
        this.pendingPlay = false;
        widget.play();
        this.startProgressPolling();
      }
    });

    bind(widgetEventName("PLAY"), () => {
      this.playing = true;
      this.callbacks.onPlay?.();
      this.startProgressPolling();
      this.refreshDuration();
    });

    bind(widgetEventName("PAUSE"), () => {
      this.playing = false;
      this.stopProgressPolling();
      this.callbacks.onPause?.();
    });

    bind(widgetEventName("FINISH"), () => {
      this.playing = false;
      this.stopProgressPolling();
      this.callbacks.onEnded?.();
    });

    bind(widgetEventName("PLAY_PROGRESS"), (data?: unknown) => {
      const payload = data as { currentPosition?: number } | undefined;
      this.reportProgress((payload?.currentPosition ?? 0) / 1000);
    });

    bind(widgetEventName("LOAD_PROGRESS"), () => this.refreshDuration());

    bind(widgetEventName("ERROR"), () => {
      this.playing = false;
      this.stopProgressPolling();
      this.callbacks.onError?.("Không phát được bài nhạc này trên SoundCloud.");
    });
  }

  /**
   * Dong ho du phong: moi giay hoi truc tiep vi tri phat qua getPosition().
   * Nho vay thanh thoi gian luon chay ke ca khi widget khong ban su kien playProgress.
   */
  private startProgressPolling(): void {
    this.stopProgressPolling();

    this.progressTimer = window.setInterval(() => {
      const widget = this.widget;
      if (!widget) return;

      widget.getPosition((milliseconds) => {
        this.reportProgress((milliseconds ?? 0) / 1000);
      });

      if (this.durationSeconds <= 0) this.refreshDuration();
    }, PROGRESS_POLL_MS);
  }

  private stopProgressPolling(): void {
    if (this.progressTimer !== null) {
      window.clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  private reportProgress(currentTime: number): void {
    const safeTime = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
    this.callbacks.onTimeUpdate?.(safeTime, this.durationSeconds);
  }

  private refreshDuration(): void {
    const widget = this.widget;
    if (!widget || this.durationAttempts >= MAX_DURATION_ATTEMPTS) return;

    this.durationAttempts += 1;

    widget.getDuration((milliseconds) => {
      if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
      this.durationSeconds = milliseconds / 1000;
      this.callbacks.onDuration?.(this.durationSeconds);
    });
  }

  async load(song: SongDTO, startAt = 0): Promise<void> {
    if (!song.embedUrl) {
      this.callbacks.onError?.("Bài nhạc thiếu đường dẫn nhúng SoundCloud.");
      return;
    }

    this.callbacks.onBuffering?.(true);

    // Bai moi chua bao gio phat -> khong duoc bao "dang phat" cho den khi widget ban su kien PLAY
    this.playing = false;

    // Dung thoi luong da co trong CSDL truoc de thanh thoi gian co tong ngay
    this.durationSeconds = song.durationSeconds > 0 ? song.durationSeconds : 0;
    this.durationAttempts = 0;

    if (this.durationSeconds > 0) {
      this.callbacks.onDuration?.(this.durationSeconds);
    }

    await this.ensureWidget(song.embedUrl);

    if (startAt > 0) {
      this.widget?.seekTo(Math.max(0, startAt) * 1000);
    }

    this.refreshDuration();
    this.callbacks.onBuffering?.(false);
  }

  async play(): Promise<void> {
    if (!this.widget) {
      this.pendingPlay = true;
      return;
    }

    this.widget.play();
    // Widget co the khong ban su kien PLAY -> chu dong dem thoi gian
    this.startProgressPolling();
  }

  async pause(): Promise<void> {
    this.stopProgressPolling();
    this.widget?.pause();
  }

  /**
   * Trinh phat dang THAT SU phat? (xem `PlayerEngine.reportsPlaying`)
   *
   * Doc tu su kien PLAY/PAUSE/FINISH moi nhat cua widget. Dung khi quay lai tien canh: trinh duyet
   * co the da tu tam dung widget luc o nen ma khong ai bao, va cac lenh "dap lai" noi day
   * (`shouldKickForegroundResume`, `shouldRetryResumePlayback`) chi chay khi dong co xac nhan CHUA
   * phat - truoc day SoundCloud khong tra loi nen bi bo qua khoang dap nay.
   */
  reportsPlaying(): boolean {
    return this.playing;
  }

  seek(seconds: number): void {
    this.widget?.seekTo(Math.max(0, seconds) * 1000);
    this.reportProgress(seconds);
  }

  /**
   * Am luong 0..1 (nguon nhung bi nen tang gioi han 100%).
   *
   * LUU Y: player-engine.tsx luon goi setVolume() roi setMuted() lien nhau moi khi
   * nguoi dung keo thanh am luong. Vi vay setMuted(false) KHONG duoc tu dat mot muc
   * am luong tuy y (truoc day hardcode 70) - neu khong moi lan keo am luong se bi
   * ghi de ve 70% va nguoi dung thay nhu "khong chinh duoc am luong".
   * Thay vao do: ghi nho muc am luong nguoi dung da chon va khoi phuc dung muc do.
   */
  setVolume(volume: number): void {
    this.lastVolume = clampEmbedVolume(volume);
    this.applyVolume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
  }

  /** Ap dung am luong hien tai len widget (0 khi dang tat tieng) */
  private applyVolume(): void {
    if (!this.widget) return;
    this.widget.setVolume(this.muted ? 0 : Math.round(this.lastVolume * 100));
  }

  private destroyWidget(): void {
    this.stopProgressPolling();

    const widget = this.widget;
    if (widget) {
      for (const event of this.boundEvents) {
        try {
          widget.unbind(event);
        } catch {
          // bo qua loi khi huy widget
        }
      }
    }

    this.boundEvents = [];
    this.iframe?.remove();
    this.iframe = null;
    this.widget = null;
    this.ready = false;
    this.pendingPlay = false;
    this.playing = false;
    this.durationSeconds = 0;
    this.durationAttempts = 0;
  }

  destroy(): void {
    this.destroyWidget();
  }
}
