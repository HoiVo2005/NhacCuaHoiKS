/**
 * Quyet dinh KHI NAO gui tien do nghe len `/api/history` (logic thuan -> kiem chung bang
 * `npm run check:history`).
 *
 * Loi da tung gap: effect trong `player-engine.tsx` phu thuoc ca trang thai phat/tam dung, nen
 * moi lan pause/play (ke ca nhung lan trinh phat tu bao khi chuyen bai, tua, hoac React
 * StrictMode chay effect 2 lan) deu gui them mot request 0ms -> hang loat request lam nghen
 * server (moi request ton ~130ms) va lam nghen ca trang.
 *
 * Quy tac hien tai:
 *  - Moi bai chi gui 1 request "bat dau nghe", va chi khi da phat du `HISTORY_MIN_PLAY_MS`
 *    (bam nham / skip nhanh khong tao rac trong lich su).
 *  - Sau do chi cap nhat khi vi tri nghe tien them >= `HISTORY_MIN_DELTA_MS`.
 *  - Tam dung: gui not vi tri cuoi (neu co tien trien) - van chi 1 request.
 */

/** Nhip kiem tra tien do (chi doc store, khong goi API) */
export const HISTORY_TICK_MS = 5_000;

/** Phai phat du bay nhieu ms moi tinh la mot luot nghe */
export const HISTORY_MIN_PLAY_MS = 5_000;

/** Chi cap nhat khi vi tri nghe tien them >= bay nhieu ms */
export const HISTORY_MIN_DELTA_MS = 30_000;

/** Trang thai ghi lich su cua MOT bai dang phat */
export interface HistoryReportTracker {
  /** Da gui request "bat dau nghe" cho bai nay chua */
  started: boolean;
  /** Vi tri (ms) da gui lan cuoi */
  lastSentMs: number;
}

export function createHistoryTracker(): HistoryReportTracker {
  return { started: false, lastSentMs: 0 };
}

/**
 * Mot nhip kiem tra trong luc bai dang mo.
 * Tra ve so ms can gui, hoac `null` khi khong co gi moi (khong goi API).
 */
export function historyReportTick(
  tracker: HistoryReportTracker,
  input: { msPlayed: number; isPlaying: boolean },
): number | null {
  const msPlayed = Math.max(Math.round(input.msPlayed), 0);

  if (!tracker.started) {
    if (!input.isPlaying || msPlayed < HISTORY_MIN_PLAY_MS) return null;

    tracker.started = true;
    tracker.lastSentMs = msPlayed;
    return msPlayed;
  }

  // Dang tam dung: khong gui tien do (chi gui khi nguoi dung bam phat lai va nghe tiep)
  if (!input.isPlaying) return null;

  // Chua nghe them du nguong -> bo qua (bao gom ca truong hop tua nguoc ve vi tri cu)
  if (msPlayed - tracker.lastSentMs < HISTORY_MIN_DELTA_MS) return null;

  tracker.lastSentMs = msPlayed;
  return msPlayed;
}

/**
 * Nguoi dung tam dung / thoat: gui not vi tri da nghe.
 * Tra ve so ms can gui, hoac `null` khi khong co tien trien dang ke.
 */
export function historyReportFlush(
  tracker: HistoryReportTracker,
  msPlayed: number,
): number | null {
  if (!tracker.started) return null;

  const value = Math.max(Math.round(msPlayed), tracker.lastSentMs);
  if (value - tracker.lastSentMs < 1_000) return null;

  tracker.lastSentMs = value;
  return value;
}
