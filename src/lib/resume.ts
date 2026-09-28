/**
 * "Nghe tiếp từ chỗ dừng" - ghi nhớ vị trí đang nghe của từng bài (logic thuần).
 *
 * Vi sao tach ra lib thuan: day la phan de gay kho chiu nhat neu lam sai:
 *  - Nhớ quá sớm (bài vừa mở 3 giây) thì lần sau vào bị "nhảy" vào giữa bài một cách vô cớ.
 *  - Nhớ cả khi đã nghe gần hết bài thì lần sau bấm vào chỉ còn vài giây cuối -> tưởng lỗi.
 *  - Ghi xuống localStorage quá dày sẽ làm giật nhạc (xem `src/lib/throttled-storage.ts`).
 *
 * Quy tắc:
 *  1. Chỉ nhớ khi đã nghe >= `RESUME_MIN_SECONDS` (bấm nhầm / nghe lướt không để lại dấu vết).
 *  2. Vị trí được làm tròn xuống theo bước `RESUME_SAVE_STEP_SECONDS` -> cùng một vị trí trong
 *     5 giây chỉ tạo MỘT bản ghi (hạn chế ghi localStorage).
 *  3. Gần hết bài (`RESUME_TAIL_SECONDS` cuối) coi như đã nghe xong -> lần sau phát lại từ đầu.
 *  4. Người dùng tua về sát đầu bài = muốn nghe lại từ đầu -> xoá vị trí đã nhớ (`forgetResumePosition`).
 */

/** Chưa nghe đủ bấy nhiêu giây thì không nhớ vị trí */
export const RESUME_MIN_SECONDS = 20;

/** Còn bấy nhiêu giây cuối bài thì coi như đã nghe xong (không nhớ nữa) */
export const RESUME_TAIL_SECONDS = 15;

/** Bước làm tròn vị trí khi lưu (giây) - cùng một bước thì không tạo bản ghi mới */
export const RESUME_SAVE_STEP_SECONDS = 5;

/** Giới hạn số bài được nhớ (bài cũ nhất bị loại trước) - tránh localStorage phình to */
export const RESUME_MAX_ENTRIES = 200;

export interface ResumeEntry {
  /** Vị trí đã nghe (giây, đã làm tròn theo bước) */
  seconds: number;
  /** Thời điểm lưu (ms) - dùng để loại bản ghi cũ khi vượt giới hạn */
  savedAt: number;
}

/** songId -> vị trí đang nghe */
export type ResumeMap = Record<string, ResumeEntry>;

/** Làm tròn xuống theo bước lưu (20.9 -> 20; 24.9 -> 20; 25.1 -> 25) */
export function resumeStep(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.floor(seconds / RESUME_SAVE_STEP_SECONDS) * RESUME_SAVE_STEP_SECONDS;
}

/** Cắt bớt bản đồ theo giới hạn, giữ các bản ghi mới nhất */
export function pruneResumeMap(resume: ResumeMap, limit = RESUME_MAX_ENTRIES): ResumeMap {
  const entries = Object.entries(resume);
  if (entries.length <= limit) return resume;

  const kept = entries
    .sort((a, b) => b[1].savedAt - a[1].savedAt)
    .slice(0, limit);

  return Object.fromEntries(kept);
}

/**
 * Ghi nhớ vị trí đang nghe của một bài.
 *
 * Trả về CHÍNH bản đồ cũ khi không có gì đổi (cùng bài, cùng bước 5 giây, hoặc chưa nghe đủ
 * `RESUME_MIN_SECONDS`) để nơi gọi bỏ qua việc cập nhật state -> không ghi localStorage vô ích.
 */
export function rememberResumePosition(
  resume: ResumeMap,
  songId: string | null | undefined,
  positionSeconds: number,
  savedAt: number,
): ResumeMap {
  if (!songId) return resume;
  if (!Number.isFinite(positionSeconds) || positionSeconds < RESUME_MIN_SECONDS) return resume;

  const seconds = resumeStep(positionSeconds);
  if (seconds < RESUME_MIN_SECONDS) return resume;

  const existing = resume[songId];
  if (existing && existing.seconds === seconds) return resume;

  return pruneResumeMap({ ...resume, [songId]: { seconds, savedAt } });
}

/**
 * Vị trí nên phát tiếp của một bài; null = phát từ đầu.
 *
 * `durationSeconds` là thời lượng đã biết của bài (từ CSDL) - dùng để loại trường hợp đã nghe
 * gần hết bài. Khi chưa biết thời lượng (0) thì chỉ áp dụng ngưỡng tối thiểu.
 */
export function resumeSecondsFor(
  resume: ResumeMap | null | undefined,
  songId: string | null | undefined,
  durationSeconds: number,
): number | null {
  if (!songId || !resume) return null;

  const entry = resume[songId];
  if (!entry || !Number.isFinite(entry.seconds)) return null;
  if (entry.seconds < RESUME_MIN_SECONDS) return null;

  if (
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0 &&
    entry.seconds > durationSeconds - RESUME_TAIL_SECONDS
  ) {
    return null;
  }

  return Math.floor(entry.seconds);
}

/** Xoá vị trí đã nhớ của một bài (người dùng tua về đầu bài, hoặc bài đã nghe hết) */
export function forgetResumePosition(resume: ResumeMap, songId: string | null | undefined): ResumeMap {
  if (!songId || !resume[songId]) return resume;

  const next = { ...resume };
  delete next[songId];
  return next;
}

/**
 * Dọn dữ liệu đọc từ localStorage: người dùng có thể sửa tay, hoặc bản ghi từ phiên bản cũ.
 * Bỏ mọi mục sai kiểu thay vì làm hỏng trạng thái trình phát.
 */
export function sanitizeResumeMap(value: unknown): ResumeMap {
  if (!value || typeof value !== "object") return {};

  const result: ResumeMap = {};

  for (const [songId, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!songId || !entry || typeof entry !== "object") continue;

    const seconds = (entry as { seconds?: unknown }).seconds;
    const savedAt = (entry as { savedAt?: unknown }).savedAt;

    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < RESUME_MIN_SECONDS) {
      continue;
    }

    result[songId] = {
      seconds: Math.floor(seconds),
      savedAt: typeof savedAt === "number" && Number.isFinite(savedAt) ? savedAt : 0,
    };
  }

  return pruneResumeMap(result);
}
