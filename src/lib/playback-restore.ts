/**
 * "Phát tiếp đúng chỗ đã nghe" khi trang/iframe bị TẢI LẠI (logic thuần + localStorage -
 * kiểm chứng bằng `npm run check:resume`).
 *
 * Hai tình huống làm người dùng đang nghe dở lại thấy bài phát từ 0:00:
 *
 *  1. **Iframe nhúng tự tải lại khi ở nền lâu**: trình duyệt có thể vứt hoặc `reload` iframe sau
 *     vài phút trang bị ẩn (TikTok còn mang `autoplay=1` nên reload là chạy lại từ đầu ngay).
 *     Trang mẹ vẫn sống nên nhạc "vẫn phát bình thường" - chỉ có vị trí bị đá về 0.
 *  2. **Trang/app bị tải lại** (bộ nhớ bị thu hồi, mở lại PWA): hàng chờ + bài hiện tại được khôi
 *     phục từ `localStorage` nhưng `progress` thì KHÔNG (tính năng "nghe tiếp từ chỗ dừng" cũ đã
 *     bị gỡ theo yêu cầu) -> mở lại là phát từ đầu.
 *
 * Nguyên tắc phân biệt, để tính năng "nghe tiếp" cũ VẪN bị gỡ:
 *  - Snapshot chỉ do lượt **đang phát** tạo ra (`wasPlaying`) và chỉ có hiệu lực trong
 *    `PLAYBACK_SNAPSHOT_MAX_AGE_MS` kể từ lúc chốt -> "vừa đang nghe mà bị tải lại" thì mới nối;
 *  - Tạm dừng rồi quay lại sau, hoặc mở lại sau thời hạn -> vẫn phát từ 0:00 như cũ;
 *  - Snapshot dùng xong là xoá: bấm vào bài lần sau là phát từ đầu.
 */

/** Khóa lưu vị trí đang nghe vào `localStorage` */
export const PLAYBACK_SNAPSHOT_KEY = "nhaccuahoiks-playback-snapshot";

/**
 * Thời hạn hiệu lực của snapshot (ms) tính từ lúc chốt (lúc trang bị ẩn / sắp đóng). Quá hạn là
 * phiên cũ -> không nối nữa. 15 phút đủ cho "app bị hệ điều hành giết rồi mở lại trong ít phút".
 */
export const PLAYBACK_SNAPSHOT_MAX_AGE_MS = 15 * 60_000;

/** Dưới mức này coi như mới bắt đầu bài -> không cần nối (đầu bài gần 0:00, nối vô nghĩa) */
export const PLAYBACK_SNAPSHOT_MIN_SECONDS = 5;

export interface PlaybackSnapshot {
  /** Bài đang phát lúc chốt - chỉ nối khi bài được nạp lại CÙNG bài */
  songId: string;
  /** Vị trí giây lúc chốt */
  seconds: number;
  /** Lúc chốt còn ĐANG phát không? (tạm dừng -> lần sau vẫn phát từ 0:00) */
  wasPlaying: boolean;
  /** Thời điểm chốt (ms) */
  at: number;
}

/**
 * Vị trí bắt đầu khi nạp bài (null = phát từ 0:00).
 *
 * Phải đúng HẾT: có snapshot, CÙNG bài, lúc chốt còn đang phát, vị trí đáng kể, và snapshot
 * chưa quá hạn.
 */
export function resolveResumeStartAt(input: {
  snapshot: PlaybackSnapshot | null;
  songId: string;
  now: number;
}): number | null {
  const snapshot = input.snapshot;
  if (!snapshot) return null;
  if (snapshot.songId !== input.songId) return null;
  if (!snapshot.wasPlaying) return null;

  const seconds = snapshot.seconds;
  if (!Number.isFinite(seconds) || seconds < PLAYBACK_SNAPSHOT_MIN_SECONDS) return null;

  const age = input.now - snapshot.at;
  // Tuoi khong tinh duoc / am (dong ho bi doi) -> khong tin
  if (!Number.isFinite(age) || age < 0 || age > PLAYBACK_SNAPSHOT_MAX_AGE_MS) return null;

  return seconds;
}

/** Doc snapshot (din khong hop le / localStorage loi -> null, khong lam hong trinh phat) */
export function readPlaybackSnapshot(): PlaybackSnapshot | null {
  if (typeof window === "undefined" || !window.localStorage) return null;

  try {
    const raw = window.localStorage.getItem(PLAYBACK_SNAPSHOT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PlaybackSnapshot> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.songId !== "string" || typeof parsed.seconds !== "number") return null;

    return {
      songId: parsed.songId,
      seconds: parsed.seconds,
      wasPlaying: parsed.wasPlaying === true,
      at: typeof parsed.at === "number" ? parsed.at : 0,
    };
  } catch {
    return null;
  }
}

/** Ghi (hoac xoa khi `null`) snapshot - ket loi bo nho/ch rieng tu thi bo qua */
export function writePlaybackSnapshot(snapshot: PlaybackSnapshot | null): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    if (!snapshot) {
      window.localStorage.removeItem(PLAYBACK_SNAPSHOT_KEY);
      return;
    }

    window.localStorage.setItem(PLAYBACK_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Het dung luong / che do rieng tu: bo qua, lan chot sau thu lai
  }
}

/**
 * Muc thut lui toi thieu (giay) so voi vi tri XA NHAT da dat de ket luan "media bi tai lai tu
 * dau" (thuong media khong bao gio tu chay lui nhieu nhu vua - chi co tua cua nguoi dung hay reload
 * moi lam vay, ma tua thi da co `pendingSeek` chan rieng).
 */
export const RESTART_DROP_SECONDS = 10;

/** Duoi muc nay thi chua co gi de so (moi nghe vai giay, ve 0 cung khong de tua lai) */
export const RESTART_MIN_PEAK_SECONDS = 10;

/**
 * Chua nhip cuoi bai (giay): da gan het ma phat lai tu dau la HET BAI / vong lap - hanh vi binh
 * thuong, KHONG duoc coi la loi roi tua lai.
 */
export const RESTART_END_TOLERANCE_SECONDS = 5;

/**
 * Phat hien media tu nay ve dau khi dang nghe do -> tra ve vi tri can tua lai (null = khong lam gi).
 *
 * Chi fire khi DUNG moi dieu: khong dang chuyen bai, khong co yeu cau tua cua nguoi dung dang cho
 * (`pendingSeek` - store tu xu ly), da nghe kha sau vao bai, chua gan het bai, va vi tri bao ve
 * thut lui qua xa so voi dinh da dat.
 */
export function findRestartSeekTarget(input: {
  /** Vi tri vua duoc dong co bao ve */
  seconds: number;
  /** Vi tri XA NHAT da dat duoc trong bai nay */
  peak: number;
  /** Tong thoi luong (0 = chua biet) */
  duration: number;
  switching: boolean;
  /** Yeu cau tua dang cho dong co xac nhan (null = khong co) */
  pendingSeek: number | null;
}): number | null {
  if (input.switching) return null;
  if (input.pendingSeek !== null) return null;

  const seconds = input.seconds;
  const peak = input.peak;
  if (!Number.isFinite(seconds) || !Number.isFinite(peak)) return null;

  if (peak < RESTART_MIN_PEAK_SECONDS) return null;

  if (input.duration > 0 && peak >= input.duration - RESTART_END_TOLERANCE_SECONDS) {
    return null;
  }

  // Chua lui du xa -> van nam trong dao dong binh thuong
  if (seconds > peak - RESTART_DROP_SECONDS) return null;

  return peak;
}
