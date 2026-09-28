/**
 * Quy tac tua bai (thanh thoi gian) dung chung cho trinh phat.
 *
 * Vi sao can: ngay sau khi nguoi dung tha thanh truot, cac dong co van co the bao
 * vi tri CU (the <audio> ban `timeupdate` trong luc dang seek; SoundCloud/YouTube
 * hoi vi tri theo chu ky ~1 giay). Neu chap nhan ngay thi thanh thoi gian nhay ve
 * vi tri cu roi nhay lai vi tri moi -> nhin nhu "giat"/"loi".
 */

/** Dong co bao vi tri lech trong pham vi nay (giay) thi coi nhu da tua xong */
export const SEEK_CONFIRM_TOLERANCE_SECONDS = 1.5;

/** Qua thoi gian nay thi khong cho doi nua (dong co khong bao gi -> khong bi ket) */
export const SEEK_PENDING_TIMEOUT_MS = 2500;

/** Gioi han vi tri tua trong khoang [0, duration] (duration <= 0 => khong gioi han tren) */
export function clampSeekTarget(seconds: number, duration = 0): number {
  if (!Number.isFinite(seconds)) return 0;

  const max = Number.isFinite(duration) && duration > 0 ? duration : Number.POSITIVE_INFINITY;
  return Math.min(Math.max(seconds, 0), max);
}

/** Bao cao nay co phai vi tri cu (cua truoc khi tua) khong? */
export function isStaleSeekReport(reported: number, pending: number): boolean {
  return Math.abs(reported - pending) > SEEK_CONFIRM_TOLERANCE_SECONDS;
}

/** Cac phim tren thanh truot cung phai "tua bai" giong nhu keo-tha chuot */
export const SEEK_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);
