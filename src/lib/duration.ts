/**
 * Quy tac dong bo thoi luong bai nhac giua trinh phat va CSDL.
 * Dung chung cho ca client (player) va server (API) de khong lech logic.
 */

/** Cho phep sai lech nho (lam tron) giua thoi luong trong CSDL va trinh phat bao ve */
export const DURATION_TOLERANCE_SECONDS = 3;

/** Chot chan: thoi luong toi da hop ly (24 gio) */
export const MAX_DURATION_SECONDS = 24 * 60 * 60;

/**
 * Co nen luu thoi luong ma trinh phat bao ve khong?
 *
 * - CSDL chua biet thoi luong (0) -> luu lai
 * - Trinh phat bao lech qua nhieu so voi CSDL -> luu de SUA LAI con so sai
 *
 * Nho vay thoi luong hien thi luon la con so that do chinh nen tang bao ve
 * (YouTube IFrame API, SoundCloud Widget API, the <audio>...).
 */
export function shouldSyncDuration(knownSeconds: number, reportedSeconds: number): boolean {
  if (!Number.isFinite(reportedSeconds) || reportedSeconds <= 0) return false;
  if (reportedSeconds > MAX_DURATION_SECONDS) return false;

  const reported = Math.round(reportedSeconds);

  if (!Number.isFinite(knownSeconds) || knownSeconds <= 0) return true;

  return Math.abs(Math.round(knownSeconds) - reported) > DURATION_TOLERANCE_SECONDS;
}
