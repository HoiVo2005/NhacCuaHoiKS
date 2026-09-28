"use client";

/**
 * Bo tro metadata SoundCloud bang Widget API chinh thuc ngay tren trinh duyet.
 *
 * Ly do: API/oEmbed cua SoundCloud khong con tra ve thoi luong cho server,
 * nhung widget chinh thuc (w.soundcloud.com/player) co the bao cao day du
 * ten, nghe si, anh bia, the loai va thoi luong qua getCurrentSound().
 */

export type SoundCloudWidget = {
  bind: (event: string, listener: (data?: unknown) => void) => void;
  unbind: (event: string) => void;
  play: () => void;
  pause: () => void;
  seekTo: (milliseconds: number) => void;
  setVolume: (volume: number) => void;
  getDuration: (callback: (duration: number) => void) => void;
  getPosition: (callback: (position: number) => void) => void;
  isPaused: (callback: (paused: boolean) => void) => void;
  getCurrentSound: (callback: (sound: SoundCloudSound | null) => void) => void;
};

export type SoundCloudSound = {
  title?: string;
  duration?: number;
  genre?: string;
  artwork_url?: string | null;
  user?: { username?: string };
};

export type SoundCloudWidgetEvents = {
  READY: string;
  PLAY: string;
  PAUSE: string;
  FINISH: string;
  PLAY_PROGRESS: string;
  LOAD_PROGRESS: string;
  SEEK: string;
  ERROR: string;
};

/** Widget API chinh thuc: SC.Widget(element) va SC.Widget.Events.* */
export type SoundCloudWidgetFactory = {
  (element: HTMLIFrameElement): SoundCloudWidget;
  Events?: Partial<SoundCloudWidgetEvents>;
};

export type SoundCloudNamespace = {
  Widget: SoundCloudWidgetFactory;
  /** Chi de tuong thich voi cac ban build cu (khong phai API chuan) */
  WidgetEvents?: Partial<SoundCloudWidgetEvents>;
};

declare global {
  interface Window {
    SC?: SoundCloudNamespace;
  }
}

/**
 * Ten su kien cua SoundCloud Widget API.
 *
 * Luu y: API chinh thuc nam o `SC.Widget.Events` (KHONG phai `SC.WidgetEvents`).
 * Neu lay sai cho, viec bind su kien se nem loi va trinh phat khong nhan duoc
 * `playProgress`/`finish`/`duration` (nhac van chay nhung thanh thoi gian dung yen).
 * Do do ham nay luon co gia tri du phong theo ten su kien chuan cua SoundCloud.
 */
const SOUNDCLOUD_EVENT_FALLBACK: SoundCloudWidgetEvents = {
  READY: "ready",
  PLAY: "play",
  PAUSE: "pause",
  FINISH: "finish",
  PLAY_PROGRESS: "playProgress",
  LOAD_PROGRESS: "loadProgress",
  SEEK: "seek",
  ERROR: "error",
};

export function widgetEventName(name: keyof SoundCloudWidgetEvents): string {
  if (typeof window === "undefined") return SOUNDCLOUD_EVENT_FALLBACK[name];

  const events = window.SC?.Widget?.Events ?? window.SC?.WidgetEvents;
  return events?.[name] ?? SOUNDCLOUD_EVENT_FALLBACK[name];
}

export interface SoundCloudWidgetInfo {
  title: string | null;
  artist: string | null;
  artworkUrl: string | null;
  durationSeconds: number;
  genre: string | null;
}

let apiPromise: Promise<void> | null = null;

export function loadSoundCloudWidgetApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.SC?.Widget) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://w.soundcloud.com/player/api.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

  return apiPromise;
}

/**
 * Tai mot widget an de doc thong tin bai nhac.
 * Tra ve null neu khong doc duoc (widget loi, bai nhac bi han che...).
 */
export async function fetchSoundCloudTrackInfo(
  trackUrl: string,
  timeoutMs = 12000,
): Promise<SoundCloudWidgetInfo | null> {
  await loadSoundCloudWidgetApi();
  if (!window.SC?.Widget) return null;

  const namespace = window.SC;

  return new Promise<SoundCloudWidgetInfo | null>((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=false&show_teaser=false&visual=false`;
    iframe.width = "1";
    iframe.height = "1";
    iframe.allow = "autoplay";
    iframe.title = "SoundCloud metadata";
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";

    let resolved = false;
    let attempts = 0;

    const finish = (value: SoundCloudWidgetInfo | null) => {
      if (resolved) return;
      resolved = true;
      window.clearTimeout(timer);
      iframe.remove();
      resolve(value);
    };

    const timer = window.setTimeout(() => finish(null), timeoutMs);

    const readSound = (widget: SoundCloudWidget) => {
      attempts += 1;

      widget.getCurrentSound((sound) => {
        if (sound?.title || sound?.duration) {
          finish({
            title: sound.title ?? null,
            artist: sound.user?.username ?? null,
            artworkUrl: sound.artwork_url ?? null,
            durationSeconds: sound.duration ? Math.round(sound.duration / 1000) : 0,
            genre: sound.genre ?? null,
          });
          return;
        }

        if (attempts < 4) {
          window.setTimeout(() => readSound(widget), 1500);
          return;
        }

        // Thu cach cuoi: hoi truc tiep thoi luong
        widget.getDuration((duration) => {
          finish(
            duration > 0
              ? {
                  title: null,
                  artist: null,
                  artworkUrl: null,
                  durationSeconds: Math.round(duration / 1000),
                  genre: null,
                }
              : null,
          );
        });
      });
    };

    iframe.addEventListener("load", () => {
      try {
        const widget = namespace.Widget(iframe);
        widget.bind(widgetEventName("READY"), () => readSound(widget));
      } catch {
        finish(null);
      }
    });

    document.body.appendChild(iframe);
  });
}
