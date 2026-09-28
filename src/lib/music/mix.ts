import type { SongDTO } from "@/types";

/**
 * "Mix quanh bài này" (radio thông minh): chấm điểm các bài ứng viên theo mức tương đồng
 * với bài đang phát, rồi xếp hạng để tạo hàng chờ mới.
 *
 * Vì sao tách ra lib thuần (không viết thẳng trong service):
 *  - Luật trộn nhạc là *quy tắc nghiệp vụ* rất dễ sai (bài chỉ cùng nguồn phát không nên
 *    đứng trên bài cùng thể loại, bài cùng nghệ sĩ phải được ưu tiên...). Tách riêng thì
 *    `npm run check:mix` kiểm chứng được bằng dữ liệu giả, không cần CSDL.
 */

/** Trọng số từng "tín hiệu" tương đồng (điểm càng cao càng được xếp trước) */
export const MIX_WEIGHTS = {
  /** Cùng thể loại - tín hiệu mạnh nhất vì quyết định "gu" của mix */
  genre: 6,
  /** Cùng nghệ sĩ: người dùng thường muốn nghe thêm bài của chính ca sĩ đó */
  artist: 4,
  /** Mỗi thẻ trùng nhau +2, tối đa +4 để một bài nhiều thẻ không lấn hết bảng xếp hạng */
  tag: 2,
  maxTagScore: 4,
  /** Cùng nền tảng phát: tín hiệu yếu (chỉ để phân biệt khi các bài ngang nhau) */
  source: 1,
  /** Thời lượng tương đương: gợi ý "liền mạch khi nghe" (nhạc ngắn không nhảy sang bài 20 phút) */
  duration: 1,
} as const;

/** Chênh lệch thời lượng (giây) được coi là "cùng độ dài" */
export const MIX_DURATION_TOLERANCE_SECONDS = 90;

/** Số bài mặc định của một mix (và số tối đa người dùng có thể yêu cầu qua API) */
export const MIX_DEFAULT_SIZE = 20;
export const MIX_MAX_SIZE = 50;

export interface MixScore {
  song: SongDTO;
  score: number;
  /** Lý do bài này được xếp vào mix (dùng cho log/UI, kiểm chứng trong `check:mix`) */
  reasons: string[];
}

/** Nhan cua mot bai khi tao mix: `Mix quanh “Ten bai”` (dung lam nhan hang cho) */
export function mixQueueLabel(song: Pick<SongDTO, "title">): string {
  return `Mix quanh “${song.title}”`;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Các thẻ trùng nhau giữa 2 bài (so sánh không phân biệt hoa/thường, giữ bản gốc để hiển thị) */
export function sharedTags(current: SongDTO, candidate: SongDTO): string[] {
  const currentTags = new Set(current.tags.map(normalize).filter(Boolean));
  if (currentTags.size === 0) return [];

  const shared: string[] = [];
  const seen = new Set<string>();

  for (const tag of candidate.tags) {
    const key = normalize(tag);
    if (!key || !currentTags.has(key) || seen.has(key)) continue;
    seen.add(key);
    shared.push(tag.trim());
  }

  return shared;
}

/** Điểm tương đồng của một bài ứng viên so với bài gốc */
export function scoreMixCandidate(current: SongDTO, candidate: SongDTO): MixScore {
  const reasons: string[] = [];
  let score = 0;

  if (current.genreId && candidate.genreId && current.genreId === candidate.genreId) {
    score += MIX_WEIGHTS.genre;
    reasons.push(candidate.genre ? `Cùng thể loại ${candidate.genre.name}` : "Cùng thể loại");
  }

  const currentArtist = normalize(current.artist);
  if (currentArtist && currentArtist === normalize(candidate.artist)) {
    score += MIX_WEIGHTS.artist;
    reasons.push(`Cùng nghệ sĩ ${candidate.artist}`);
  }

  const tags = sharedTags(current, candidate);
  if (tags.length > 0) {
    score += Math.min(tags.length * MIX_WEIGHTS.tag, MIX_WEIGHTS.maxTagScore);
    reasons.push(`Cùng thẻ: ${tags.slice(0, 3).join(", ")}`);
  }

  if (current.sourceType === candidate.sourceType) {
    score += MIX_WEIGHTS.source;
    reasons.push("Cùng nguồn phát");
  }

  const currentDuration = current.durationSeconds ?? 0;
  const candidateDuration = candidate.durationSeconds ?? 0;
  if (
    currentDuration > 0 &&
    candidateDuration > 0 &&
    Math.abs(currentDuration - candidateDuration) <= MIX_DURATION_TOLERANCE_SECONDS
  ) {
    score += MIX_WEIGHTS.duration;
    reasons.push("Thời lượng tương đương");
  }

  return { song: candidate, score, reasons };
}

/**
 * Xếp hạng ứng viên cho mix:
 *  1. điểm tương đồng cao trước,
 *  2. cùng điểm thì bài được nghe nhiều hơn (dễ "trúng" gu của tập thể),
 *  3. cuối cùng là thứ tự tên A→Z để kết quả LUÔN ổn định (cùng dữ liệu -> cùng mix,
 *     nhờ vậy test được và người dùng bấm lại không thấy danh sách nhảy lung tung).
 *
 * Bài gốc và bài trùng id bị loại; bài chưa phát hành cũng bị loại.
 */
export function rankMixCandidates(current: SongDTO, candidates: SongDTO[], limit = MIX_DEFAULT_SIZE): MixScore[] {
  const seen = new Set<string>([current.id]);
  const unique: SongDTO[] = [];

  for (const song of candidates) {
    if (!song?.id || seen.has(song.id)) continue;
    seen.add(song.id);
    if (song.isPublished === false) continue;
    unique.push(song);
  }

  return unique
    .map((song) => scoreMixCandidate(current, song))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.song.playCount - a.song.playCount ||
        a.song.title.localeCompare(b.song.title, "vi"),
    )
    .slice(0, Math.max(0, limit));
}
