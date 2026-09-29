"use client";

import { useEffect, useMemo, useRef } from "react";

import { useSessionUser } from "@/components/auth/session-context";
import {
  applyBackgroundAudioSession,
  currentAudioSessionHost,
  isAudioSessionInterrupted,
  reapplyBackgroundAudioSession,
  watchAudioSessionState,
} from "@/lib/audio-session";
import { isSystemPause, shouldResumePlayback } from "@/lib/background-playback";
import { cn } from "@/lib/utils";
import { usePlayerStore, type VideoMode } from "@/store/player-store";
import type { SongDTO } from "@/types";

import { AudioEngine } from "./engines/audio-engine";
import { SoundCloudEngine } from "./engines/soundcloud-engine";
import { TikTokEngine } from "./engines/tiktok-engine";
import type { PlayerAdapterCallbacks, PlayerEngine } from "./engines/types";
import { shouldSyncDuration } from "@/lib/duration";
import {
  applyVideoStageStyles,
  clearVideoStageStyles,
  videoSlotElement,
  watchVideoSlot,
} from "./video-stage";
import {
  createHistoryTracker,
  HISTORY_TICK_MS,
  historyReportFlush,
  historyReportTick,
} from "./history-report";

import { YouTubeEngine } from "./engines/youtube-engine";
import { armSwitchGuard, releaseSwitchGuard, resolveAutoPlay } from "./switch-guard";

/** Khung video cua nguon dang phat (moi nguon co mot phan tu rieng o goc trang) */
function activeVideoContainer(
  sourceType: SongDTO["sourceType"] | undefined,
  containers: {
    youtube: HTMLDivElement | null;
    tiktok: HTMLDivElement | null;
    soundcloud: HTMLDivElement | null;
  },
): HTMLDivElement | null {
  switch (sourceType) {
    case "YOUTUBE":
      return containers.youtube;
    case "TIKTOK":
      return containers.tiktok;
    case "SOUNDCLOUD":
      return containers.soundcloud;
    default:
      return null;
  }
}

/**
 * Lop cho khung video cua dong co phat.
 *
 * `full`: khung video nam o goc trang (position: fixed) va duoc dat vi tri theo "o cho video"
 * trong trinh phat day du (xem `video-stage.ts`) -> cuon len/xuong cung noi dung thay vi dung yen.
 */
function containerClass(mode: VideoMode, active: boolean): string {
  if (!active || mode === "hidden") {
    return "pointer-events-none fixed bottom-0 left-0 z-0 size-[1px] opacity-0";
  }

  if (mode === "floating") {
    return "fixed bottom-36 right-4 z-40 aspect-video w-[300px] overflow-hidden rounded-xl border border-border-strong shadow-2xl sm:bottom-28";
  }

  return "fixed left-1/2 top-[10vh] z-[60] aspect-video w-[min(88vw,900px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-border-strong shadow-2xl";
}

export function PlayerEngine() {
  const session = useSessionUser();
  const isAuthenticated = session.isAuthenticated;
  const authenticatedRef = useRef(isAuthenticated);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubeRef = useRef<HTMLDivElement | null>(null);
  const soundcloudRef = useRef<HTMLDivElement | null>(null);
  const tiktokRef = useRef<HTMLDivElement | null>(null);

  const enginesRef = useRef<Record<string, PlayerEngine | null>>({});
  const loadedSongRef = useRef<string | null>(null);
  /** Da tai truoc API / tao san player cua nen tang chua (chi mot lan moi phien - xem effect "ham nong") */
  const warmedUpRef = useRef(false);
  const reportedDurationsRef = useRef<Set<string>>(new Set());
  const switchingRef = useRef(false);
  const switchingTimerRef = useRef<number | null>(null);
  /**
   * Thời điểm trang quay lại tiền cảnh (ms) - để nhận ra sự kiện `pause` đến MUỘN của lúc ở nền
   * (xem `INTERRUPTION_PAUSE_GRACE_MS` trong `src/lib/background-playback.ts`).
   */
  const visibleAtRef = useRef(0);

  /** Chan gui trung: chi mot request ghi lich su dang bay tai mot thoi diem */
  const historyInFlightRef = useRef(false);

  const current = usePlayerStore((state) => state.current);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const volume = usePlayerStore((state) => state.volume);
  const muted = usePlayerStore((state) => state.muted);
  const videoMode = usePlayerStore((state) => state.videoMode);
  const seekRequest = usePlayerStore((state) => state.seekRequest);

  const callbacks = useMemo<PlayerAdapterCallbacks>(
    () => ({
      onPlay: () => {
        // Bai moi da phat duoc -> ket thuc giai doan chuyen bai
        releaseSwitchGuard(switchingRef, switchingTimerRef);

        if (!usePlayerStore.getState().isPlaying) {
          usePlayerStore.setState({ isPlaying: true, isBuffering: false });
        }
      },
      onPause: () => {
        /*
         * Chỉ coi là "người dùng bấm tạm dừng" khi KHÔNG có dấu hiệu nào của hệ thống:
         *  - đang chuyển bài: thay `src` của thẻ <audio> hay tạm dừng động cơ khác cũng bắn `pause`;
         *  - trang đang ở nền, hoặc vừa mới quay lại tiền cảnh: trình duyệt tự tạm dừng khi ra nền,
         *    cuộc gọi đến, hoặc ứng dụng khác chiếm quyền phát.
         *
         * Nếu lật `isPlaying = false` ở đây thì "ý định đang nghe" bị mất và quay lại app là nhạc nằm
         * im - đúng lỗi "chuyển sang ứng dụng khác là hết nhạc" (xem `src/lib/background-playback.ts`).
         */
        if (
          isSystemPause({
            switching: switchingRef.current,
            documentHidden:
              typeof document !== "undefined" && document.visibilityState === "hidden",
            msSinceVisible: Date.now() - visibleAtRef.current,
          })
        ) {
          return;
        }

        if (usePlayerStore.getState().isPlaying) {
          usePlayerStore.setState({ isPlaying: false, isBuffering: false });
        }
      },
      onBuffering: (buffering) => usePlayerStore.setState({ isBuffering: buffering }),
      onTimeUpdate: (currentTime, duration) => {
        // Store quyet dinh co chap nhan vi tri nay khong (ngay sau khi nguoi dung tua,
        // dong co co the con bao vi tri cu -> bi bo qua de thanh thoi gian khong giat).
        usePlayerStore.getState().setProgress(currentTime, duration);
      },
      onDuration: (duration) => {
        const song = usePlayerStore.getState().current;
        if (!song || duration <= 0) return;

        usePlayerStore.setState({ duration });

        // Thoi luong that do chinh nen tang bao ve: luu khi CSDL chua biet hoac dang luu sai
        if (!shouldSyncDuration(song.durationSeconds ?? 0, duration)) return;
        if (reportedDurationsRef.current.has(song.id)) return;
        reportedDurationsRef.current.add(song.id);

        const rounded = Math.round(duration);

        void fetch(`/api/songs/${song.id}/duration`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ durationSeconds: rounded }),
        })
          .then(() => {
            usePlayerStore.setState((state) => ({
              queue: state.queue.map((item) =>
                item.id === song.id ? { ...item, durationSeconds: rounded } : item,
              ),
              current:
                state.current?.id === song.id
                  ? { ...state.current, durationSeconds: rounded }
                  : state.current,
            }));
          })
          .catch(() => undefined);
      },
      onEnded: () => {
        const state = usePlayerStore.getState();
        const song = state.current;
        if (!song) return;

        // Khach nghe nhac khong luu lich su (khong can dang nhap)
        if (authenticatedRef.current) {
          void fetch("/api/history", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              songId: song.id,
              msPlayed: Math.round((state.duration || song.durationSeconds || 0) * 1000),
              completed: true,
              source: "web-player",
            }),
          }).catch(() => undefined);
        }

        /*
         * Hẹn giờ theo số bài: còn trong hạn mức thì `handleTrackEnded` trả về `true` và nhạc chạy tiếp,
         * tới bài cuối cùng của hạn mức thì dừng hẳn, KHÔNG tự chuyển bài.
         * Store tự tắt hẹn giờ nên lần bấm Phát sau đó nhạc chạy bình thường.
         */
        if (!state.handleTrackEnded()) return;

        state.next(true);
      },
      onError: (message) => usePlayerStore.setState({ errorMessage: message, isPlaying: false }),
    }),
    [],
  );

  const ensureEngineForSource = (sourceType: SongDTO["sourceType"]): PlayerEngine | null => {
    const existing = enginesRef.current[sourceType];
    if (existing) return existing;

    let engine: PlayerEngine | null = null;

    if (sourceType === "YOUTUBE" && youtubeRef.current) {
      engine = new YouTubeEngine(youtubeRef.current, callbacks);
    } else if (sourceType === "SOUNDCLOUD" && soundcloudRef.current) {
      engine = new SoundCloudEngine(soundcloudRef.current, callbacks);
    } else if (sourceType === "TIKTOK" && tiktokRef.current) {
      engine = new TikTokEngine(tiktokRef.current, callbacks);
    } else if (sourceType === "UPLOADED" && audioRef.current) {
      engine = new AudioEngine(audioRef.current, callbacks);
    }

    enginesRef.current[sourceType] = engine;
    return engine;
  };

  /**
   * Ham nong trinh phat (chay MOT lan moi phien, khi trang da ranh).
   *
   * Truoc day API cua tung nen tang chi duoc tai khi nguoi dung bam phat bai dau tien, nen phai
   * cho: tai script (YouTube iframe API ~300KB, SoundCloud Widget API) -> tao iframe -> `onReady`
   * -> moi nap duoc bai. Tren mang cham, bai dau tien mat vai giay moi keu.
   *
   * Nay, sau khi trang hien xong, ta tai truoc API va tao san player cho cac nguon co the dung:
   * lan bam phat dau tien chi con `loadVideoById`/`play`.
   *  - Bo qua khi nguoi dung bat "tiet kiem du lieu" hoac mang 2G (khong lam cham trang).
   *  - Chi chay mot lan cho ca phien (ref) nen doi trang khong tai lai.
   */
  useEffect(() => {
    if (typeof window === "undefined" || warmedUpRef.current) return;

    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;

    if (connection?.saveData || connection?.effectiveType === "2g" || connection?.effectiveType === "slow-2g") {
      return;
    }

    let idleId: number | null = null;
    let timeoutId: number | null = null;

    const warm = () => {
      if (warmedUpRef.current) return;
      warmedUpRef.current = true;

      for (const sourceType of ["YOUTUBE", "SOUNDCLOUD"] as const) {
        ensureEngineForSource(sourceType)?.prewarm?.();
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(warm, { timeout: 3000 });
    } else {
      timeoutId = window.setTimeout(warm, 1500);
    }

    return () => {
      if (idleId !== null) window.cancelIdleCallback?.(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * iOS/Safari: khai báo audio của trang là "nghe nhạc" ngay khi mở app.
   *
   * Phải làm SỚM (trước khi đồ thị âm lượng `AudioContext` được tạo) vì iOS xếp Web Audio vào nhóm
   * "ambient" và chặn nó khi trang không còn ở tiền cảnh -> đang nghe mà thoát app ra là nhạc dừng.
   * Xem `src/lib/audio-session.ts` để biết giới hạn theo phiên bản iOS.
   */
  useEffect(() => {
    applyBackgroundAudioSession();
  }, []);

  /**
   * Nghe nhạc khi chuyển sang tab / ứng dụng khác ("ra nền") - xem `src/lib/background-playback.ts`.
   *
   * Trình duyệt coi trang đang ẩn là không còn hoạt động: loại phiên âm thanh có thể bị đưa về `"auto"`
   * (iOS lại xếp Web Audio vào nhóm âm thanh nền -> đang nghe mà mở app khác là nhạc dừng) và phiên
   * phát có thể bị tạm dừng. Vì vậy ở đây làm ba việc:
   *  1. Đặt lại loại phiên âm thanh NGAY lúc trang bị ẩn và mỗi lần quay lại tiền cảnh.
   *  2. Quay lại tiền cảnh: nếu người dùng vẫn đang nghe thì tự phát tiếp - trình duyệt tự tạm dừng lúc
   *     ở nền nhưng KHÔNG tự phát lại.
   *  3. Hệ thống hết ngắt quãng (cuộc gọi kết thúc / ứng dụng khác nhả quyền phát): cũng phát tiếp, vì
   *     thẻ <audio> có thể đã bị tạm dừng mà không tự chạy lại.
   */
  useEffect(() => {
    /** Phát tiếp nếu người dùng vẫn đang nghe mà phiên phát bị hệ thống tạm dừng */
    const resumeIfNeeded = (): void => {
      const state = usePlayerStore.getState();
      const song = state.current;
      if (!song) return;

      const shouldResume = shouldResumePlayback({
        wantsPlaying: state.isPlaying,
        documentHidden: document.visibilityState === "hidden",
        audioSessionInterrupted: isAudioSessionInterrupted(currentAudioSessionHost()),
      });
      if (!shouldResume) return;

      const engine = enginesRef.current[song.sourceType];
      if (!engine) return;

      /*
       * `play()` chứ không `load()`: động cơ đang có sẵn bài trong bộ nhớ, chỉ cần phát tiếp. Với file
       * tải lên, `AudioEngine.play()` còn đánh thức lại `AudioContext` mà trình duyệt treo lúc ở nền.
       */
      void engine.play();
    };

    const onVisibilityChange = (): void => {
      // Đặt lại loại phiên âm thanh ngay (lúc trang bị ẩn, trình duyệt thường xoá thiết lập này)
      reapplyBackgroundAudioSession();

      if (document.visibilityState === "hidden") return;

      visibleAtRef.current = Date.now();
      resumeIfNeeded();
    };

    /** Quay lại từ back/forward cache hoặc mở lại tab: cũng phải đặt lại phiên âm thanh */
    const onPageShow = (): void => {
      reapplyBackgroundAudioSession();
      visibleAtRef.current = Date.now();
      resumeIfNeeded();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);

    const unwatchAudioSession = watchAudioSessionState(currentAudioSessionHost(), resumeIfNeeded);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
      unwatchAudioSession?.();
    };
  }, []);

  // Nap bai nhac khi bai hien tai thay doi
  useEffect(() => {
    if (!current) return;

    const engine = ensureEngineForSource(current.sourceType);
    if (!engine) return;

    if (loadedSongRef.current === current.id) return;
    loadedSongRef.current = current.id;

    // Y dinh phat tai thoi diem chuyen bai: bai moi phai tu phat tiep
    const wasPlaying = usePlayerStore.getState().isPlaying;

    // Trong luc chuyen bai, su kien pause do he thong (thay src / tam dung dong co khac)
    // khong duoc coi la nguoi dung tam dung
    armSwitchGuard(switchingRef, switchingTimerRef);

    // Moi thoi diem chi phat mot bai: tam dung cac dong co khac
    for (const [type, other] of Object.entries(enginesRef.current)) {
      if (other && type !== current.sourceType) {
        void other.pause();
      }
    }

    /*
     * Mọi lượt phát đều bắt đầu từ 0:00: tính năng "nghe tiếp từ chỗ dừng" (tự phát nốt vị trí đã
     * nghe dở) đã được gỡ bỏ theo yêu cầu, nên không còn đọc `localStorage` để nạp vào giữa bài.
     * Động cơ vẫn nhận `startAt` (mặc định 0) cho những chỗ gọi khác.
     */
    void engine.load(current, 0).then(() => {
      const state = usePlayerStore.getState();

      // Nguoi dung da doi sang bai khac trong luc dang nap
      if (state.current?.id !== current.id) return;

      const decision = resolveAutoPlay(wasPlaying, state.isPlaying);

      // Khoa lai y dinh phat neu mot su kien pause cu da lat trang thai
      if (decision.restorePlaying) {
        usePlayerStore.setState({ isPlaying: true });
      }

      if (decision.play) {
        void engine.play();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Dong bo trang thai phat / tam dung
  useEffect(() => {
    const song = usePlayerStore.getState().current;
    if (!song) return;

    const engine = enginesRef.current[song.sourceType];
    if (!engine) return;

    if (isPlaying) {
      void engine.play();
    } else {
      void engine.pause();
    }
     
  }, [isPlaying, current?.id]);

  // Dong bo am luong
  useEffect(() => {
    const song = usePlayerStore.getState().current;
    if (!song) return;

    const engine = enginesRef.current[song.sourceType];
    if (!engine) return;

    engine.setVolume(volume);
    engine.setMuted(muted);
     
  }, [volume, muted, current?.id]);

  // Thuc hien lenh tua do store phat ra (keo thanh thoi gian, nut "Bai truoc" khi da nghe
  // qua 5 giay, ...). Store la nguon su that nen moi yeu cau tua deu di qua day.
  useEffect(() => {
    if (!seekRequest) return;

    const song = usePlayerStore.getState().current;
    if (song) {
      enginesRef.current[song.sourceType]?.seek(seekRequest.seconds);
    }

    // Lenh tua chi dung mot lan: xoa de khong tua lai khi component mount lai
    usePlayerStore.setState({ seekRequest: null });
  }, [seekRequest]);

  /**
   * Video che do toan man hinh phai CUON theo noi dung, khong dung yen tren man hinh.
   *
   * Khung video la phan tu `position: fixed` o goc trang (khong doi duoc phan tu cha vi doi cha se
   * lam iframe tai lai tu dau), nen phai do vi tri "o cho video" ma trinh phat day du dat trong luong
   * trang roi cap nhat toa do moi khi cuon / doi kich thuoc. Nho vay khi nguoi dung cuon, video di
   * len theo va khong con de len tieu de/nghe si ben duoi (xem `video-stage.ts`).
   */
  useEffect(() => {
    if (videoMode !== "full") return;

    const container = activeVideoContainer(current?.sourceType, {
      youtube: youtubeRef.current,
      tiktok: tiktokRef.current,
      soundcloud: soundcloudRef.current,
    });
    if (!container) return;

    let frame: number | null = null;
    let tracked: HTMLElement | null = null;

    // Ap dung ngay (khong doi khung hinh sau) de khung video bam dung o cho tu khung hinh dau tien
    const flush = () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }

      applyVideoStageStyles(container);
    };

    // Gop nhieu su kien lien tiep vao mot khung hinh -> cuon muot, khong giat
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(flush);
    };

    // O cho co the doi kich thuoc ma khong co su kien scroll/resize (mo hang cho, xoay man hinh...)
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(flush);

    const track = () => {
      const slot = videoSlotElement();
      if (slot !== tracked) {
        if (tracked) observer?.unobserve(tracked);
        tracked = slot;
        if (tracked) observer?.observe(tracked);
      }

      flush();
    };

    track();

    // Su kien scroll khong bubble -> phai nghe o pha capture de bat moi vung cuon
    const scrollOptions = { capture: true, passive: true } as const;
    window.addEventListener("scroll", schedule, scrollOptions);
    window.addEventListener("resize", schedule);
    const unwatch = watchVideoSlot(track);

    return () => {
      window.removeEventListener("scroll", schedule, scrollOptions);
      window.removeEventListener("resize", schedule);
      unwatch();
      observer?.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      clearVideoStageStyles(container);
    };
  }, [videoMode, current?.sourceType]);

  // Ghi nho trang thai dang nhap de callback `onEnded` (chay ngoai render) dung duoc
  useEffect(() => {
    authenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  /**
   * Ghi nhan lich su nghe nhac (chi voi nguoi dung da dang nhap).
   *
   * Truoc day effect phu thuoc ca `isPlaying`, nen MOI lan trang thai phat/tam dung doi (ke ca
   * nhung lan trinh phat bao pause/play lien tuc khi chuyen bai hoac tua) deu gui them mot
   * request `POST /api/history` voi 0ms -> hang loat request, ghi de lien tuc vao bang lich su
   * va lam nghen ket noi (moi request ton ~130ms o server).
   *
   * Nay:
   *  - Chi phu thuoc `current?.id`: moi bai chi gui 1 request "bat dau nghe".
   *  - Chi tinh la mot luot nghe khi bai da phat >= HISTORY_MIN_PLAY_MS (skip nhanh khong ghi).
   *  - Trong luc phat: chi cap nhat khi vi tri nghe tien them >= HISTORY_MIN_DELTA_MS.
   *  - Tam dung: gui not vi tri da nghe (khong mat du lieu).
   *  - Single-flight: chi mot request dang bay -> khong day hang doi vao server.
   */
  useEffect(() => {
    const songId = current?.id;
    if (!songId || !isAuthenticated) return;

    // Moi bai co mot bo dem rieng: bai moi = mot luot nghe moi
    const tracker = createHistoryTracker();

    const send = (msPlayed: number, completed: boolean) => {
      // Dang co request bay thi bo qua (ky sau se gui gia tri moi hon)
      if (historyInFlightRef.current) return;
      historyInFlightRef.current = true;

      void fetch("/api/history", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ songId, msPlayed, completed, source: "web-player" }),
        // Giu request duoc gui khi nguoi dung doi trang (khong lam cham UI vi khong await)
        keepalive: true,
      })
        .catch(() => undefined)
        .finally(() => {
          historyInFlightRef.current = false;
        });
    };

    const interval = window.setInterval(() => {
      const state = usePlayerStore.getState();
      if (state.current?.id !== songId) return;

      const msPlayed = historyReportTick(tracker, {
        msPlayed: state.progress * 1000,
        isPlaying: state.isPlaying,
      });

      if (msPlayed !== null) send(msPlayed, false);
    }, HISTORY_TICK_MS);

    // Nghe xong mot doan roi tam dung -> gui not vi tri cuoi (chi 1 request, khong lap lai)
    const unsubscribe = usePlayerStore.subscribe((state, previous) => {
      if (state.isPlaying || !previous.isPlaying) return;
      if (state.current?.id !== songId) return;

      const msPlayed = historyReportFlush(tracker, state.progress * 1000);
      if (msPlayed !== null) send(msPlayed, false);
    });

    return () => {
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [current?.id, isAuthenticated]);

  useEffect(() => {
    const engines = enginesRef.current;
    return () => {
      for (const engine of Object.values(engines)) {
        engine?.destroy();
      }
      enginesRef.current = {};
      // Cho phep nap lai bai hien tai sau khi remount (React StrictMode goi effect 2 lan)
      loadedSongRef.current = null;
      warmedUpRef.current = false;
      releaseSwitchGuard(switchingRef, switchingTimerRef);
    };
  }, []);

  return (
    <>
      {/*
        `preload="auto"`: the <audio> tai truoc du lieu cua bai dang phat (truoc day de
        `metadata` nen chi tai phan header -> bam phat moi bat dau tai, bai nhac khoi dong cham
        va de giat khi mang yeu). Chi engine UPLOADED dung the nay nen khong tai thua bai khac.
      */}
      <audio ref={audioRef} preload="auto" className="hidden" />
      <div
        ref={youtubeRef}
        aria-hidden={current?.sourceType !== "YOUTUBE"}
        className={cn(containerClass(videoMode, current?.sourceType === "YOUTUBE"))}
      />
      <div
        ref={tiktokRef}
        aria-hidden={current?.sourceType !== "TIKTOK"}
        className={cn(containerClass(videoMode, current?.sourceType === "TIKTOK"))}
      />
      <div
        ref={soundcloudRef}
        aria-hidden={current?.sourceType !== "SOUNDCLOUD"}
        className={cn(containerClass(videoMode, current?.sourceType === "SOUNDCLOUD"))}
      />
    </>
  );
}
