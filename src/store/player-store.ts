"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { clampSeekTarget, isStaleSeekReport, SEEK_PENDING_TIMEOUT_MS } from "@/lib/seek";
import {
  sleepDeadlineFrom,
  SLEEP_TIMER_CLOCK_MAX_MS,
  SLEEP_TIMER_MAX_TRACKS,
  SLEEP_TIMER_MIN_TRACKS,
  type SleepMode,
} from "@/lib/sleep-timer";
import { DEFAULT_SOUND_PROFILE, isSoundProfileId, type SoundProfileId } from "@/lib/sound-profiles";
import { createThrottledPersistStorage } from "@/lib/throttled-storage";
import { clampVolume, DEFAULT_VOLUME } from "@/lib/volume";
import type { SongDTO } from "@/types";

export type RepeatMode = "off" | "all" | "one";
export type VideoMode = "hidden" | "floating" | "full";

interface PlayerState {
  queue: SongDTO[];
  currentIndex: number;
  current: SongDTO | null;
  queueLabel: string;
  isPlaying: boolean;
  isBuffering: boolean;
  volume: number;
  muted: boolean;
  /**
   * Tông âm thanh (EQ preset) cho file tải lên — `"off"` (mặc định) = nghe đúng bản gốc,
   * `"jbl-partybox"` = mô phỏng chữ ký loa JBL PartyBox Ultimate (xem `src/lib/sound-profiles.ts`).
   */
  soundProfile: SoundProfileId;
  progress: number;
  duration: number;
  /** Vi tri dang cho dong co xac nhan sau khi nguoi dung tua (null = khong cho) */
  pendingSeek: number | null;
  /** Thoi diem bat dau cho (ms) - dung de khong bi ket neu dong co khong bao gi */
  pendingSeekAt: number;
  /** Yeu cau tua moi nhat cho dong co thuc hien (token tang dan de luon chay lai) */
  seekRequest: { seconds: number; token: number } | null;
  shuffle: boolean;
  repeat: RepeatMode;
  videoMode: VideoMode;
  queueOpen: boolean;
  fullPlayerOpen: boolean;
  /** Bảng trợ giúp phím tắt (mở bằng phím `?` hoặc nút trên thanh phát) */
  shortcutsOpen: boolean;
  /** Bảng lời bài hát trong trình phát đầy đủ (mở bằng phím `Y` hoặc nút trên thanh phát) */
  lyricsOpen: boolean;
  errorMessage: string | null;
  /** Hẹn giờ tắt nhạc: đang tắt / đếm ngược theo thời gian / đếm ngược theo số bài */
  sleepMode: SleepMode;
  /** Mốc kết thúc (ms) khi `sleepMode === "countdown"` */
  sleepEndsAt: number | null;
  /** Số bài còn được phát hết trước khi tắt khi `sleepMode === "tracks"` (tính cả bài đang phát) */
  sleepTracksLeft: number;
  /** Tổng số bài người dùng đã hẹn (để hiện “còn 2/3 bài”) */
  sleepTracksTotal: number;

  playQueue: (songs: SongDTO[], startIndex?: number, label?: string) => void;
  playSong: (song: SongDTO, label?: string) => void;
  addToQueue: (song: SongDTO, next?: boolean) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  next: (auto?: boolean) => void;
  previous: () => void;
  seek: (seconds: number) => void;
  /** Ghi nhan vi tri tua nguoi dung vua chon (dong thoi cho dong co xac nhan) */
  requestSeekPosition: (seconds: number) => void;
  setProgress: (seconds: number, duration?: number) => void;
  setDuration: (seconds: number) => void;
  setBuffering: (buffering: boolean) => void;
  setVolume: (volume: number) => void;
  /** Chọn tông âm thanh (EQ preset) cho file tải lên */
  setSoundProfile: (profile: SoundProfileId) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVideoMode: (mode: VideoMode) => void;
  toggleQueue: () => void;
  toggleFullPlayer: () => void;
  /** Mo/dong bang tro giup phim tat */
  toggleShortcuts: () => void;
  setShortcutsOpen: (open: boolean) => void;
  /** Mo/dong bang loi bai hat (karaoke) trong trinh phat day du */
  toggleLyrics: () => void;
  setLyricsOpen: (open: boolean) => void;
  /** Mo bang loi va mo luon trinh phat day du (bang loi chi hien o trong trinh phat day du) */
  showLyrics: () => void;
  /** Hẹn giờ tắt nhạc sau `minutes` phút */
  setSleepTimer: (minutes: number) => void;
  /** Hẹn giờ tắt theo mốc đồng hồ (menu “tắt lúc …”), nhận mốc thời gian tuyệt đối (ms) */
  setSleepTimerAt: (deadline: number) => void;
  /** Hẹn giờ kiểu “còn `tracks` bài nữa thì tắt” (`1` = hết bài này thì tắt) */
  setSleepAfterTracks: (tracks: number) => void;
  /** Tắt hẹn giờ */
  clearSleepTimer: () => void;
  /** Đồng hồ đếm ngược gọi mỗi giây; trả về `true` khi vừa tắt nhạc */
  tickSleepTimer: (now?: number) => boolean;
  /** Hết bài: trả về `false` khi hẹn giờ theo số bài đã chạm bài cuối -> dừng phát (không chuyển bài) */
  handleTrackEnded: () => boolean;
  setError: (message: string | null) => void;
}

/** Xoá hẹn giờ theo số bài (dùng khi hàng chờ hết: không còn bài nào để đếm) */
const NO_TRACK_SLEEP = { sleepMode: "off", sleepTracksLeft: 0, sleepTracksTotal: 0 } as const;

/** Trạng thái khi hẹn “còn N bài nữa thì tắt” (kẹp về 1–99 cho an toàn nếu state bị sửa tay) */
function trackSleepState(tracks: number) {
  const rounded = Math.round(tracks);
  const safe = Number.isFinite(rounded)
    ? Math.min(Math.max(rounded, SLEEP_TIMER_MIN_TRACKS), SLEEP_TIMER_MAX_TRACKS)
    : SLEEP_TIMER_MIN_TRACKS;

  return {
    sleepMode: "tracks",
    sleepEndsAt: null,
    sleepTracksLeft: safe,
    sleepTracksTotal: safe,
  } satisfies Partial<PlayerState>;
}

function pickNextIndex(
  state: Pick<PlayerState, "queue" | "currentIndex" | "shuffle" | "repeat">,
  auto: boolean,
): number {
  const { queue, currentIndex, shuffle, repeat } = state;
  if (queue.length === 0) return -1;

  if (repeat === "one" && auto) return currentIndex;

  if (shuffle) {
    if (queue.length === 1) return 0;
    let index = currentIndex;
    while (index === currentIndex) {
      index = Math.floor(Math.random() * queue.length);
    }
    return index;
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex < queue.length) return nextIndex;

  if (repeat === "all" || !auto) return 0;
  return -1;
}

/**
 * Ap dung vi tri dong co vua bao ve.
 *
 * Ngay sau khi nguoi dung tua, dong co co the van con bao vi tri CU:
 * - the <audio> ban `timeupdate` trong luc dang seek;
 * - SoundCloud/YouTube hoi vi tri theo chu ky (~1 giay).
 * Chap nhan ngay se lam thanh thoi gian nhay ve vi tri cu roi nhay lai -> giat.
 * Vi vay: bo qua bao cao lech xa vi tri dang cho, toi da SEEK_PENDING_TIMEOUT_MS.
 */
function settleProgress(state: PlayerState, seconds: number): Partial<PlayerState> {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const pending = state.pendingSeek;

  if (pending === null) return { progress: safe };

  const stillWaiting = Date.now() - state.pendingSeekAt < SEEK_PENDING_TIMEOUT_MS;
  if (stillWaiting && isStaleSeekReport(safe, pending)) return {};

  return { progress: safe, pendingSeek: null };
}

/**
 * Cac truong duoc luu lai giua cac lan mo trang (xem `partialize` ben duoi).
 * Khai bao tuong minh de `persist` biet kieu du lieu ma storage co tiet che nhan vao.
 */
type PersistedPlayerState = Pick<
  PlayerState,
  | "volume"
  | "muted"
  | "soundProfile"
  | "shuffle"
  | "repeat"
  | "queue"
  | "currentIndex"
  | "current"
  | "queueLabel"
>;

export const usePlayerStore = create<PlayerState>()(
  persist<PlayerState, [], [], PersistedPlayerState>(
    (set, get) => ({
      queue: [],
      currentIndex: -1,
      current: null,
      queueLabel: "",
      isPlaying: false,
      isBuffering: false,
      volume: DEFAULT_VOLUME,
      muted: false,
      soundProfile: DEFAULT_SOUND_PROFILE,
      progress: 0,
      duration: 0,
      pendingSeek: null,
      pendingSeekAt: 0,
      seekRequest: null,
      shuffle: false,
      repeat: "off",
      videoMode: "hidden",
      queueOpen: false,
      fullPlayerOpen: false,
      shortcutsOpen: false,
      lyricsOpen: false,
      errorMessage: null,
      sleepMode: "off",
      sleepEndsAt: null,
      sleepTracksLeft: 0,
      sleepTracksTotal: 0,

      playQueue: (songs, startIndex = 0, label = "") => {
        if (songs.length === 0) return;

        const index = Math.min(Math.max(startIndex, 0), songs.length - 1);
        set({
          queue: songs,
          currentIndex: index,
          current: songs[index],
          queueLabel: label,
          isPlaying: true,
          progress: 0,
          pendingSeek: null,
          pendingSeekAt: 0,
          seekRequest: null,
          duration: songs[index].durationSeconds ?? 0,
          errorMessage: null,
        });
      },

      playSong: (song, label = "") => {
        const { queue } = get();
        const existingIndex = queue.findIndex((item) => item.id === song.id);

        if (existingIndex >= 0) {
          get().playQueue(queue, existingIndex, label);
          return;
        }

        get().playQueue([song], 0, label);
      },

      addToQueue: (song, next = false) => {
        const { queue, currentIndex, current } = get();

        if (!current) {
          get().playQueue([song], 0);
          return;
        }

        if (next) {
          const updated = [...queue];
          updated.splice(currentIndex + 1, 0, song);
          set({ queue: updated });
          return;
        }

        set({ queue: [...queue, song] });
      },

      removeFromQueue: (index) => {
        const { queue, currentIndex } = get();
        if (index < 0 || index >= queue.length) return;

        const updated = queue.filter((_, position) => position !== index);

        if (index === currentIndex) {
          const nextIndex = Math.min(currentIndex, updated.length - 1);
          set({
            queue: updated,
            currentIndex: nextIndex,
            current: updated[nextIndex] ?? null,
            progress: 0,
            pendingSeek: null,
            pendingSeekAt: 0,
            seekRequest: null,
            isPlaying: updated.length > 0,
          });
          return;
        }

        set({
          queue: updated,
          currentIndex: index < currentIndex ? currentIndex - 1 : currentIndex,
        });
      },

      clearQueue: () =>
        set({
          queue: [],
          currentIndex: -1,
          current: null,
          isPlaying: false,
          progress: 0,
          pendingSeek: null,
          pendingSeekAt: 0,
          seekRequest: null,
          /* Hàng chờ bị xoá hết -> hẹn giờ theo số bài không còn gì để đếm */
          ...NO_TRACK_SLEEP,
        }),

      /** Keo-tha sap xep lai hang cho, giu nguyen bai dang phat */
      moveInQueue: (from, to) =>
        set((state) => {
          const queue = [...state.queue];

          if (
            from === to ||
            from < 0 ||
            to < 0 ||
            from >= queue.length ||
            to >= queue.length
          ) {
            return {};
          }

          const [moved] = queue.splice(from, 1);
          queue.splice(to, 0, moved);

          let currentIndex = state.currentIndex;
          if (currentIndex === from) {
            currentIndex = to;
          } else if (from < currentIndex && to >= currentIndex) {
            currentIndex -= 1;
          } else if (from > currentIndex && to <= currentIndex) {
            currentIndex += 1;
          }

          return { queue, currentIndex };
        }),

      togglePlay: () => {
        const { current, isPlaying } = get();
        if (!current) return;
        set({ isPlaying: !isPlaying, errorMessage: null });
      },

      setPlaying: (playing) => set({ isPlaying: playing }),

      next: (auto = false) => {
        const state = get();
        const nextIndex = pickNextIndex(state, auto);

        if (nextIndex < 0) {
          set({
            isPlaying: false,
            progress: 0,
            pendingSeek: null,
            pendingSeekAt: 0,
            seekRequest: null,
            /* Hết bài để chuyển mà hàng chờ đã cạn -> hẹn giờ theo số bài tự tắt cho khỏi hiện nhãn sai */
            ...NO_TRACK_SLEEP,
          });
          return;
        }

        set({
          currentIndex: nextIndex,
          current: state.queue[nextIndex],
          progress: 0,
          pendingSeek: null,
          pendingSeekAt: 0,
          seekRequest: null,
          isPlaying: true,
          duration: state.queue[nextIndex]?.durationSeconds ?? 0,
        });
      },

      previous: () => {
        const { queue, currentIndex, progress } = get();
        if (queue.length === 0) return;

        // Nghe qua 5 giay thi tua ve dau bai, nguoc lai quay ve bai truoc
        if (progress > 5) {
          get().requestSeekPosition(0);
          return;
        }

        const prevIndex = currentIndex - 1 < 0 ? queue.length - 1 : currentIndex - 1;
        set({
          currentIndex: prevIndex,
          current: queue[prevIndex],
          progress: 0,
          pendingSeek: null,
          pendingSeekAt: 0,
          seekRequest: null,
          isPlaying: true,
        });
      },

      /**
       * Yeu cau tua bai: ghi ngay vi tri nguoi dung chon, danh dau "dang cho dong co
       * xac nhan" (bo qua bao cao cu -> thanh thoi gian khong bi giat) va phat yeu cau
       * cho dong co phat thuc hien.
       */
      requestSeekPosition: (seconds) =>
        set((state) => {
          const target = clampSeekTarget(seconds, state.duration);

          return {
            progress: target,
            pendingSeek: target,
            pendingSeekAt: Date.now(),
            seekRequest: { seconds: target, token: (state.seekRequest?.token ?? 0) + 1 },
          };
        }),

      seek: (seconds) => get().requestSeekPosition(seconds),

      setProgress: (seconds, duration) =>
        set((state) => ({
          ...settleProgress(state, seconds),
          ...(typeof duration === "number" && Number.isFinite(duration) && duration > 0
            ? { duration }
            : {}),
        })),
      setDuration: (seconds) => set({ duration: Math.max(0, seconds) }),
      setBuffering: (buffering) => set({ isBuffering: buffering }),

      setVolume: (volume) => set({ volume: clampVolume(volume), muted: false }),
      /*
       * Chọn tông nhạc (EQ): giá trị hỏng từ localStorage bản cũ / lưu tay -> quy về "off"
       * (mặc định, không EQ) thay vì để chuỗi lạ chạy vào đồ thị âm thanh.
       */
      setSoundProfile: (profile) =>
        set({ soundProfile: isSoundProfileId(profile) ? profile : DEFAULT_SOUND_PROFILE }),
      toggleMute: () => set((state) => ({ muted: !state.muted })),
      toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

      cycleRepeat: () =>
        set((state) => ({
          repeat: state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off",
        })),

      setVideoMode: (mode) => set({ videoMode: mode }),
      toggleQueue: () => set((state) => ({ queueOpen: !state.queueOpen })),

      /** Bang phim tat: khong luu vao localStorage (mo lai trang thi dong lai la hop ly) */
      toggleShortcuts: () => set((state) => ({ shortcutsOpen: !state.shortcutsOpen })),
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),

      /** Bang loi bai hat: cung khong luu vao localStorage (mo lai trang thi dong lai) */
      toggleLyrics: () => set((state) => ({ lyricsOpen: !state.lyricsOpen })),
      setLyricsOpen: (lyricsOpen) => set({ lyricsOpen }),

      /* Bang loi chi hien trong trinh phat day du -> mo bang thi mo luon trinh phat */
      showLyrics: () => set({ lyricsOpen: true, fullPlayerOpen: true }),

      toggleFullPlayer: () =>
        set((state) => ({
          fullPlayerOpen: !state.fullPlayerOpen,
          videoMode: state.fullPlayerOpen ? "hidden" : "full",
        })),

      setSleepTimer: (minutes) =>
        set({ sleepMode: "countdown", sleepEndsAt: sleepDeadlineFrom(minutes) }),

      /**
       * Kiểu “tắt lúc 23:30”: nhận mốc tuyệt đối đã tính sẵn (`sleepDeadlineFromClock`).
       * Bao giờ cũng nằm trong tương lai để đồng hồ đếm ngược còn việc để làm; xa nhất 24 giờ.
       */
      setSleepTimerAt: (deadline) => {
        const now = Date.now();
        set({
          sleepMode: "countdown",
          sleepEndsAt: Math.min(Math.max(deadline, now + 30_000), now + SLEEP_TIMER_CLOCK_MAX_MS),
        });
      },

      /**
       * “Còn N bài nữa thì tắt”: phát hết bài đang mở rồi tới các bài kế tiếp cho đủ `tracks` bài, sau đó dừng.
       * Số bài luôn tính cả bài đang phát nên `tracks = 1` chính là “hết bài này thì tắt”.
       */
      setSleepAfterTracks: (tracks) => set(trackSleepState(tracks)),

      clearSleepTimer: () =>
        set({ sleepMode: "off", sleepEndsAt: null, sleepTracksLeft: 0, sleepTracksTotal: 0 }),

      /**
       * Đồng hồ đếm ngược (1 giây/lần) gọi vào đây. Hết giờ -> tạm dừng phát và tắt hẹn giờ.
       * Nhận `now` để test được mà không phải chờ thật.
       */
      tickSleepTimer: (now = Date.now()) => {
        const { sleepMode, sleepEndsAt } = get();
        if (sleepMode !== "countdown" || sleepEndsAt === null || now < sleepEndsAt) return false;

        set({ isPlaying: false, sleepMode: "off", sleepEndsAt: null });
        return true;
      },

      /**
       * Hết bài: đang hẹn giờ theo số bài thì trừ dần; tới bài cuối cùng thì dừng phát thay vì tự chuyển bài.
       * Trả về `false` khi đã dừng -> động cơ KHÔNG được gọi `next`.
       */
      handleTrackEnded: () => {
        const { sleepMode, sleepTracksLeft } = get();
        if (sleepMode !== "tracks") return true;

        if (sleepTracksLeft > 1) {
          set({ sleepTracksLeft: sleepTracksLeft - 1 });
          return true;
        }

        set({
          isPlaying: false,
          sleepMode: "off",
          sleepEndsAt: null,
          sleepTracksLeft: 0,
          sleepTracksTotal: 0,
        });
        return false;
      },

      setError: (message) => set({ errorMessage: message, isBuffering: false }),
    }),
    {
      name: "nhaccuahoiks-player",
      /*
       * Ghi co tiet che xuong localStorage: khong luu `progress` (xem `partialize` ben duoi) va
       * storage so sanh tung truong truoc khi ghi (`isSamePersistedValue`) -> dang phat, trang
       * thai da luu khong doi nen khong con JSON.stringify hang cho + ghi dong bo moi giay tren
       * main thread (truoc day dung chinh luc cap nhat thanh thoi gian -> thanh giat, nhac van
       * chay binh thuong). Xem `src/lib/throttled-storage.ts`.
       */
      storage: createThrottledPersistStorage<PersistedPlayerState>(),
      /**
       * Bản cũ có lưu khoá `resume` (vị trí đã nghe dở) và `progress` trong localStorage; tính
       * năng nghe tiếp đã bị gỡ nên bỏ cả hai khi đọc lại để state không mang dữ liệu chết
       * (thanh thời gian không còn hiện vị trí cũ rồi nhảy về 0:00 khi phát).
       */
      merge: (persisted, current) => {
        const rest = { ...(persisted as Partial<PlayerState> & { resume?: unknown }) };
        delete rest.resume;
        delete rest.progress;
        // Dữ liệu EQ hỏng từ bản cũ / lưu tay -> quy về "off" (mặc định, không đổi hành vi)
        if (!isSoundProfileId(rest.soundProfile)) rest.soundProfile = DEFAULT_SOUND_PROFILE;
        return { ...current, ...rest };
      },
      /*
       * Không lưu hẹn giờ tắt nhạc: mở lại trang sau vài tiếng mà vẫn còn đếm ngược cũ thì
       * vô nghĩa (nhạc đã dừng khi đóng tab), lại dễ làm người dùng tưởng trình phát lỗi.
       *
       * Không lưu `progress` (vị trí giây đang phát): mỗi giây giá trị lại đổi nên `persist`
       * phải ghi lại toàn bộ trạng thái (kèm hàng chờ) mỗi giây trên main thread -> giao diện
       * giật. Tính năng "nghe tiếp từ chỗ dừng" đã bị gỡ, mỗi bài luôn phát từ 0:00 nên lưu
       * vị trí cũ cũng vô ích.
       */
      partialize: (state) => ({
        volume: state.volume,
        muted: state.muted,
        soundProfile: state.soundProfile,
        shuffle: state.shuffle,
        repeat: state.repeat,
        queue: state.queue,
        currentIndex: state.currentIndex,
        current: state.current,
        queueLabel: state.queueLabel,
      }),
    },
  ),
);
