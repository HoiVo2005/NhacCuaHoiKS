/**
 * Hẹn giờ tắt nhạc (sleep timer).
 *
 * Ba kiểu hẹn giờ:
 *  - Đếm ngược theo số phút (hoặc theo mốc giờ đồng hồ): hết thời gian → tạm dừng phát (dù đang ở bài nào).
 *  - Đếm ngược theo SỐ BÀI: phát hết N bài nữa (tính cả bài đang phát) rồi dừng, **không** tự chuyển bài.
 *    `N = 1` chính là kiểu “hết bài này thì tắt” trước đây.
 *
 * Toàn bộ phép tính nằm ở đây dưới dạng hàm thuần để test được bằng `npm run check:sleep`.
 */

export type SleepMode = "off" | "countdown" | "tracks";

/** Các mốc thời gian hay dùng (phút) */
export const SLEEP_TIMER_MINUTES = [5, 10, 15, 30, 45, 60] as const;

/** Các mốc “bao nhiêu bài nữa thì tắt” hay dùng (bài) */
export const SLEEP_TIMER_TRACKS = [1, 2, 3, 5, 10] as const;

/** Số phút nhỏ nhất / lớn nhất người dùng được tự chọn */
export const SLEEP_TIMER_MIN_MINUTES = 1;
export const SLEEP_TIMER_MAX_MINUTES = 12 * 60;

/** Trần cho phép: 12 giờ — chặn giá trị vô lý nếu state bị sửa tay */
export const SLEEP_TIMER_MAX_MS = SLEEP_TIMER_MAX_MINUTES * 60_000;

/** Trần cho kiểu “tắt lúc mấy giờ”: xa nhất là 24 giờ (chọn giờ đã qua trong ngày → ngày mai) */
export const SLEEP_TIMER_CLOCK_MAX_MS = 24 * 60 * 60 * 1000;

/**
 * Số bài ít nhất / nhiều nhất người dùng được hẹn.
 * `1` = “hết bài này thì tắt”; con số luôn **tính cả bài đang phát** (xem `sleepTracksLeft`).
 */
export const SLEEP_TIMER_MIN_TRACKS = 1;
export const SLEEP_TIMER_MAX_TRACKS = 99;

/** Mốc kết thúc (ms) khi người dùng chọn hẹn `minutes` phút */
export function sleepDeadlineFrom(minutes: number, now = Date.now()): number {
  const safeMinutes = Math.min(Math.max(minutes, 1), SLEEP_TIMER_MAX_MS / 60_000);
  return now + Math.round(safeMinutes * 60_000);
}

/**
 * Chuẩn hoá số phút người dùng tự nhập: chấp nhận 1–720 phút (làm tròn số lẻ).
 * Trả về `null` khi giá trị không dùng được (rỗng, chữ, âm, quá trần) để giao diện báo lỗi.
 */
export function normalizeSleepMinutes(value: number): number | null {
  if (!Number.isFinite(value)) return null;

  const minutes = Math.round(value);
  if (minutes < SLEEP_TIMER_MIN_MINUTES || minutes > SLEEP_TIMER_MAX_MINUTES) return null;
  return minutes;
}

/**
 * Chuẩn hoá số bài người dùng tự nhập: chấp nhận 1–99 bài (làm tròn số lẻ).
 * Trả về `null` khi giá trị không dùng được (rỗng, chữ, âm, quá trần) để giao diện báo lỗi.
 */
export function normalizeSleepTracks(value: number): number | null {
  if (!Number.isFinite(value)) return null;

  const tracks = Math.round(value);
  if (tracks < SLEEP_TIMER_MIN_TRACKS || tracks > SLEEP_TIMER_MAX_TRACKS) return null;
  return tracks;
}

/** `23:30` theo đồng hồ của máy người dùng (dùng để hiện “tắt lúc …”) */
export function formatClockTime(deadline: number | null): string {
  if (deadline === null) return "";

  const date = new Date(deadline);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Mốc kết thúc (ms) khi người dùng chọn **giờ đồng hồ** (ví dụ `"23:30"`).
 *
 * - Chưa tới giờ đó trong ngày → hẹn hôm nay.
 * - Đã qua → hiểu là ngày mai.
 * - Vừa trôi qua trong vòng một phút (chọn đúng phút hiện tại) → tắt sau 1 phút, không đẩy sang ngày mai.
 *
 * Trả về `null` khi chuỗi không phải giờ hợp lệ.
 */
export function sleepDeadlineFromClock(clock: string, now = Date.now()): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);

  const deadline = target.getTime();
  if (deadline > now) return deadline;
  if (now - deadline < 60_000) return now + 60_000;
  return deadline + SLEEP_TIMER_CLOCK_MAX_MS;
}

/** Thời gian còn lại (ms), luôn >= 0 */
export function sleepRemaining(sleepEndsAt: number | null, now = Date.now()): number {
  if (sleepEndsAt === null) return 0;
  return Math.max(0, sleepEndsAt - now);
}

/** `14:59`, hoặc `1:05:00` khi còn từ một giờ trở lên */
export function formatSleepRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Nhãn ngắn cho số bài còn lại: `3 bài`, hoặc `hết bài này` khi chỉ còn bài đang phát */
export function formatSleepTracks(tracksLeft: number): string {
  return tracksLeft <= 1 ? "hết bài này" : `${tracksLeft} bài`;
}

/** Mô tả đầy đủ cho tooltip/aria-label (đếm ngược sống theo `now`) */
export function describeSleepTimer(
  mode: SleepMode,
  sleepEndsAt: number | null,
  now = Date.now(),
  /** Số bài còn lại khi `mode === "tracks"` (tính cả bài đang phát) */
  tracksLeft = 0,
): string {
  if (mode === "tracks") {
    if (tracksLeft <= 1) return "Hẹn giờ: tắt nhạc khi hết bài này";
    return `Hẹn giờ: tắt nhạc sau ${tracksLeft} bài nữa (kể cả bài đang phát)`;
  }

  if (mode === "countdown") {
    const clock = formatClockTime(sleepEndsAt);
    const remaining = formatSleepRemaining(sleepRemaining(sleepEndsAt, now));
    return `Hẹn giờ: tắt nhạc sau ${remaining}${clock ? ` (lúc ${clock})` : ""}`;
  }
  return "Hẹn giờ tắt nhạc";
}
