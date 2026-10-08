import type { SongDTO } from "@/types";

import type { PlayerAdapterCallbacks, PlayerEngine } from "./types";

type YouTubePlayer = {
  loadVideoById: (options: { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

type YouTubeNamespace = {
  Player: new (element: HTMLElement | string, options: Record<string, unknown>) => YouTubePlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number };
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Cho YouTube toi da 15s de san sang (tranh treo vo han khi mang chan iframe) */
const READY_TIMEOUT_MS = 15_000;
const API_LOAD_TIMEOUT_MS = 15_000;

let apiPromise: Promise<void> | null = null;

export function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    const previousHandler = window.onYouTubeIframeAPIReady;
    let settled = false;

    const done = () => {
      if (settled) return;
      settled = true;
      previousHandler?.();
      resolve();
    };

    window.onYouTubeIframeAPIReady = () => done();

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);

    window.setTimeout(() => {
      if (window.YT?.Player) {
        done();
        return;
      }
      // Khong tai duoc API: cho phep thu lai o lan sau
      settled = true;
      apiPromise = null;
      resolve();
    }, API_LOAD_TIMEOUT_MS);
  });

  return apiPromise;
}

/**
 * Phat nhac YouTube bang IFrame Player API chinh thuc.
 * Khong boc DRM, khong tai video - moi hoat dong phat deu do YouTube thuc hien.
 */
export class YouTubeEngine implements PlayerEngine {
  readonly type = "YOUTUBE";

  private player: YouTubePlayer | null = null;
  private container: HTMLElement;
  private callbacks: PlayerAdapterCallbacks;
  private progressTimer: number | null = null;

  /** Promise dung chung cho moi lan init -> nhieu lenh play/load dong thoi khong tao player trung */
  private readyPromise: Promise<void> | null = null;
  private ready = false;

  /** Tang len moi khi destroy() de bo qua ket qua cua player cu (tranh ro ri khi remount) */
  private generation = 0;

  /** Sau destroy() thi doi tuong nay khong duoc tai su dung nua */
  private destroyed = false;

  /** Trang thai phat hien tai - tranh gui lenh play/pause trung lap len iframe */
  private currentlyPlaying = false;

  private pendingSong: SongDTO | null = null;
  private pendingStartAt = 0;
  private loadedSongId: string | null = null;
  private pendingSeconds: number | null = null;
  private pendingVolume: number | null = null;
  private pendingMuted: boolean | null = null;

  constructor(container: HTMLElement, callbacks: PlayerAdapterCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  /**
   * YouTube thay the the duoc truyen vao bang <iframe> cua no.
   * Vi vay ta tao mot the div rieng ben trong container (the do React quan ly)
   * de khong pha vo DOM/class cua React khi YT doi iframe.
   */
  private createMountNode(): HTMLElement {
    const mount = document.createElement("div");
    mount.style.width = "100%";
    mount.style.height = "100%";
    mount.setAttribute("data-yt-mount", "1");
    this.container.appendChild(mount);
    return mount;
  }

  /** Player chi dung duoc sau khi onReady (truoc do object khong co method) */
  private isPlayerUsable(): boolean {
    return Boolean(this.player && typeof this.player.playVideo === "function");
  }

  /** Cho player san sang; cac lan goi trung se dung chung mot promise */
  private ensureReady(): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    if (this.ready && this.isPlayerUsable()) return Promise.resolve();

    if (!this.readyPromise) {
      this.readyPromise = this.init();
    }

    return this.readyPromise;
  }

  private async init(): Promise<void> {
    if (this.destroyed) return;

    await loadYouTubeIframeApi();

    if (this.destroyed) return;
    if (this.ready && this.isPlayerUsable()) return;

    if (!window.YT?.Player) {
      this.readyPromise = null;
      this.callbacks.onError?.(
        "Không tải được YouTube IFrame API. Vui lòng kiểm tra kết nối mạng rồi thử lại.",
      );
      return;
    }

    const generation = this.generation;

    const ready = await new Promise<boolean>((resolve) => {
      const mount = this.createMountNode();
      let settled = false;

      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      };

      const timer = window.setTimeout(() => finish(false), READY_TIMEOUT_MS);

      const instance = new window.YT!.Player(mount, {
        width: "100%",
        height: "100%",
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event?: { target?: YouTubePlayer }) => {
            if (generation !== this.generation) {
              // Player cu: da bi destroy trong luc cho onReady
              try {
                (event?.target ?? instance)?.destroy?.();
              } catch {
                // bo qua
              }
              finish(false);
              return;
            }

            // event.target la doi tuong player day du chuc nang (object tra ve tu
            // constructor co the chua co method nao truoc onReady)
            this.player = event?.target ?? instance;
            this.ready = true;
            this.applyPendingSettings();
            this.callbacks.onReady?.();
            finish(true);
          },
          onStateChange: (event: { data: number }) => {
            if (generation === this.generation) this.handleStateChange(event.data);
          },
          onError: (event: { data: number }) => {
            if (generation === this.generation) this.handleError(event.data);
          },
        },
      });

      if (generation !== this.generation) {
        try {
          instance?.destroy?.();
        } catch {
          // bo qua
        }
        finish(false);
        return;
      }

      this.player = instance;
    });

    if (!ready) {
      // Cho qua lau: bao loi va cho phep thu lai khi nguoi dung bam phat lai
      this.readyPromise = null;
      this.ready = false;
      if (this.generation === generation) {
        this.callbacks.onError?.("YouTube chưa sẵn sàng. Vui lòng thử phát lại bài nhạc.");
      }
      return;
    }

    // onReady da ap dung am luong/tat tieng va bao cho trinh phat biet
    this.ready = true;
  }

  /**
   * Ham nong: tao san iframe player truoc khi nguoi dung bam phat.
   *
   * Truoc day player chi duoc tao khi bam bai YouTube dau tien, nen phai cho: tai iframe_api
   * (~300KB) -> tao iframe -> `onReady` -> moi `loadVideoById`. Goi ham nay luc trang ranh
   * (xem `player-engine.tsx`) giup bai dau tien phat gan nhu ngay.
   */
  prewarm(): void {
    void this.ensureReady();
  }

  /** Ap dung am luong / tat tieng duoc dat truoc khi player san sang */
  private applyPendingSettings(): void {
    if (!this.isPlayerUsable()) return;

    const player = this.player!;

    if (this.pendingVolume !== null) {
      player.setVolume(Math.round(this.pendingVolume * 100));
    }

    if (this.pendingMuted !== null) {
      if (this.pendingMuted) player.mute();
      else player.unMute();
    }

    if (this.pendingSeconds !== null && this.loadedSongId) {
      player.seekTo(Math.max(0, this.pendingSeconds), true);
      this.pendingSeconds = null;
    }
  }

  private handleStateChange(state: number): void {
    const YT = window.YT;
    if (!YT) return;

    if (state === YT.PlayerState.PLAYING) {
      this.currentlyPlaying = true;
      this.callbacks.onPlay?.();
      this.callbacks.onBuffering?.(false);
      this.startProgressTimer();
    } else if (state === YT.PlayerState.PAUSED) {
      this.currentlyPlaying = false;
      this.callbacks.onPause?.();
      this.stopProgressTimer();
    } else if (state === YT.PlayerState.ENDED) {
      this.currentlyPlaying = false;
      this.stopProgressTimer();
      this.callbacks.onEnded?.();
    } else if (state === YT.PlayerState.BUFFERING) {
      this.callbacks.onBuffering?.(true);
    } else if (state === YT.PlayerState.CUED) {
      this.callbacks.onBuffering?.(false);
      this.reportDuration();
    }
  }

  private handleError(code: number): void {
    const messages: Record<number, string> = {
      2: "Đường dẫn video YouTube không hợp lệ.",
      5: "Video này không phát được trong trình phát nhúng HTML5.",
      100: "Video không tồn tại hoặc đã bị xoá.",
      101: "Chủ sở hữu video không cho phép phát nhúng.",
      150: "Chủ sở hữu video không cho phép phát nhúng.",
    };

    this.callbacks.onError?.(messages[code] ?? `Lỗi phát YouTube (mã ${code}).`);
  }

  private startProgressTimer(): void {
    this.stopProgressTimer();
    this.progressTimer = window.setInterval(() => {
      if (!this.player) return;
      const currentTime = this.player.getCurrentTime?.() ?? 0;
      const duration = this.player.getDuration?.() ?? 0;
      this.callbacks.onTimeUpdate?.(currentTime, duration);
    }, 500);
  }

  private stopProgressTimer(): void {
    if (this.progressTimer !== null) {
      window.clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  private reportDuration(): void {
    const duration = this.player?.getDuration?.() ?? 0;
    if (duration > 0) this.callbacks.onDuration?.(duration);
  }

  async load(song: SongDTO, startAt = 0): Promise<void> {
    if (!song.sourceId) {
      this.callbacks.onError?.("Bài nhạc thiếu mã video YouTube.");
      return;
    }

    this.pendingSong = song;
    this.pendingStartAt = startAt;

    // Neu player chua san sang thi cho (nhieu lenh load/play dong thoi dung chung 1 promise)
    if (!this.ready || !this.isPlayerUsable()) {
      await this.ensureReady();
    }

    if (!this.isPlayerUsable()) return;

    const target = this.pendingSong;
    if (!target?.sourceId) return;

    if (this.loadedSongId === target.sourceId && startAt === 0) {
      this.callbacks.onBuffering?.(false);
      return;
    }

    this.pendingSong = null;
    this.loadedSongId = target.sourceId;
    this.currentlyPlaying = false;
    this.callbacks.onBuffering?.(true);
    this.player!.loadVideoById({
      videoId: target.sourceId,
      startSeconds: Math.max(0, this.pendingStartAt),
    });

    // Nguoi dung da tua truoc khi bai duoc nap xong
    if (this.pendingSeconds !== null) {
      this.player!.seekTo(Math.max(0, this.pendingSeconds), true);
      this.pendingSeconds = null;
    }
  }

  async play(): Promise<void> {
    /*
     * Không gửi lệnh trùng khi đang phát THẬT SỰ - và "thật sự" phải HỎI thẳng trình phát
     * (`playerReportsPlaying`), KHÔNG được tin cờ `currentlyPlaying`: sau khi app ra nền trình duyệt
     * có thể tự tạm dừng iframe mà KHÔNG bắn `onStateChange` (hoặc sự kiện tới muộn) -> cờ còn true
     * trong khi trình phát đang dừng. Chặn theo cờ từng làm mọi lệnh "phát tiếp" (keep-alive lúc ở
     * nền, đạp khi quay lại tiền cảnh - xem `player-engine.tsx`) bị bỏ qua -> nhạc nằm im.
     */
    if (this.currentlyPlaying && this.playerReportsPlaying()) return;

    // Cho onReady truoc khi goi: object player chua co method nao truoc onReady
    if (!this.ready || !this.isPlayerUsable()) {
      await this.ensureReady();
    }

    if (!this.isPlayerUsable()) return;

    /*
     * Hỏi lại SAU khi chờ onReady: nhiều lệnh `play()` chạy song song (ví dụ gọi `play` khi player
     * chưa sẵn sàng) - lệnh nào thấy trình phát đã phát thì thôi; lệnh nào thấy cờ còn true nhưng
     * trình phát CHƯA phát (tạm dừng âm thầm khi ở nền) thì VẪN phải gửi, không được bỏ qua.
     */
    if (this.currentlyPlaying && this.playerReportsPlaying()) return;

    this.currentlyPlaying = true;
    this.player!.playVideo();
  }

  /**
   * Trình phát YouTube đang THẬT SỰ phát?
   *
   * Cờ `currentlyPlaying` có thể lệch thực tế: iframe bị trình duyệt treo/tạm dừng khi trang ở nền mà
   * không bắn `onStateChange`, hoặc sự kiện đó tới muộn.
   */
  private playerReportsPlaying(): boolean {
    const YT = window.YT;
    const player = this.player;

    if (!YT || !player) return false;

    try {
      return player.getPlayerState() === YT.PlayerState.PLAYING;
    } catch {
      // Không hỏi được trạng thái -> tin vào cờ nội bộ (không gửi lệnh trùng)
      return this.currentlyPlaying;
    }
  }

  async pause(): Promise<void> {
    if (!this.isPlayerUsable()) return;
    this.currentlyPlaying = false;
    this.player!.pauseVideo();
  }

  /** Trinh phat dang THAT SU phat? (dung khi quay lai tien canh - xem `PlayerEngine.reportsPlaying`) */
  reportsPlaying(): boolean {
    return this.playerReportsPlaying();
  }

  seek(seconds: number): void {
    const target = Math.max(0, seconds);

    if (!this.isPlayerUsable()) {
      this.pendingSeconds = target;
      return;
    }

    this.player!.seekTo(target, true);
  }

  setVolume(volume: number): void {
    const normalized = Math.min(Math.max(volume, 0), 1);
    this.pendingVolume = normalized;

    if (!this.isPlayerUsable()) return;
    this.player!.setVolume(Math.round(normalized * 100));
  }

  setMuted(muted: boolean): void {
    this.pendingMuted = muted;

    if (!this.isPlayerUsable()) return;
    if (muted) this.player!.mute();
    else this.player!.unMute();
  }

  destroy(): void {
    // Vo hieu hoa moi ket qua den muon cua player cu (onReady/timeout dang cho)
    this.destroyed = true;
    this.generation += 1;
    this.stopProgressTimer();

    const player = this.player;
    this.player = null;
    this.ready = false;
    this.readyPromise = null;
    this.pendingSong = null;
    this.loadedSongId = null;
    this.pendingSeconds = null;
    this.currentlyPlaying = false;

    try {
      player?.destroy();
    } catch {
      // bo qua loi khi huy player
    }

    // Don cac the ma YouTube tao ra (iframe) hoac mount node con sot lai
    for (const node of Array.from(this.container.querySelectorAll("[data-yt-mount], iframe"))) {
      node.remove();
    }
  }
}