import type { RefObject } from "react";

/** Thoi gian toi da bo qua su kien pause do chuyen bai (ms) */
export const SWITCH_GUARD_MS = 2500;

/**
 * Trong luc chuyen bai, trinh phat co the tu phat sinh su kien `pause`
 * (thay `src` cua the <audio>, tam dung dong co khac khi doi nguon phat...).
 * Su kien do KHONG phai do nguoi dung bam tam dung, nen phai bo qua - neu khong
 * store se bi dat `isPlaying = false` va bai moi khong tu dong phat.
 */
export function armSwitchGuard(
  active: RefObject<boolean>,
  timer: RefObject<number | null>,
  durationMs: number = SWITCH_GUARD_MS,
): void {
  active.current = true;

  if (timer.current !== null) {
    window.clearTimeout(timer.current);
  }

  timer.current = window.setTimeout(() => {
    active.current = false;
    timer.current = null;
  }, durationMs);
}

/** Ket thuc chuyen bai (bai moi da phat duoc) */
export function releaseSwitchGuard(
  active: RefObject<boolean>,
  timer: RefObject<number | null>,
): void {
  active.current = false;

  if (timer.current !== null) {
    window.clearTimeout(timer.current);
    timer.current = null;
  }
}

/** Su kien pause nay co phai do nguoi dung bam tam dung khong? */
export function isUserPause(active: RefObject<boolean>): boolean {
  return !active.current;
}

/**
 * Quyet dinh sau khi nap xong bai moi: co tu phat tiep khong?
 * Trong luc chuyen bai, neu trang thai phat bi lat boi mot su kien pause cu
 * thi khoi phuc lai y dinh phat ban dau (bai moi van tu phat).
 */
export function resolveAutoPlay(
  wasPlaying: boolean,
  isPlayingNow: boolean,
): { play: boolean; restorePlaying: boolean } {
  if (isPlayingNow) return { play: true, restorePlaying: false };
  if (wasPlaying) return { play: true, restorePlaying: true };
  return { play: false, restorePlaying: false };
}
