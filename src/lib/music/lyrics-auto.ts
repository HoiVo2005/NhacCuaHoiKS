/**
 * Loai bai nao thi HE THONG TU TRA CUU LOI.
 *
 * Yeu cau nghiep vu: **chi tu lay loi cho "bai hat binh thuong"** (mot bai, mot loi) nhu da so
 * bai tren YouTube. Cac dang khac - lien khuc (LK), mix/nonstop, tuyen tap, best of, album ghep
 * nhieu bai - se bi BO QUA vi:
 *   - chung chua NHIEU bai nen khong co mot "loi bai hat" dung nghia,
 *   - tra cuu tu dong rat de ra loi cua mot bai khac trong do -> sai lời.
 *
 * Bai bi bo qua van co the duoc quan tri vien DAN LOI TAY (khong bao gio chan viec nay),
 * va quan tri vien co the bam "van tra cuu" de thu tra cuu thu cong.
 */

/** Bai dai hon muc nay thuong la mix/lien khuc/tuyen tap chu khong phai mot bai hat */
export const AUTO_LYRICS_MAX_DURATION_SECONDS = 10 * 60;

/**
 * Dau hieu "nhieu bai trong mot muc" (so khop theo TU nguyen ven nen `remix` khong khop `mix`).
 */
const MULTI_SONG_PATTERN =
  /\b(lk|liên khúc|lien khuc|medley|mega\s?mix|mashup|mash\s?up|nonstop|non-stop|mix|tuyển tập|tuyen tap|tổng hợp|tong hop|playlist|best of|top\s?\d+|vol\.?\s?\d|volume\s?\d|\d+\s?giờ|\d+\s?hours?|\d+\s?phút|\d+\s?minutes?)\b/i;

export interface AutoLyricsSong {
  title: string;
  durationSeconds: number;
}

/**
 * Ly do KHONG tu tra cuu loi (null = bai binh thuong, nen tu tra cuu).
 * Tra ve chuoi de hien cho nguoi dung biet vi sao khong co loi tu dong.
 */
export function autoLyricsSkipReason(song: AutoLyricsSong): string | null {
  const title = (song.title ?? "").trim();
  if (!title) return "Bài nhạc chưa có tên.";

  const multiSong = title.match(MULTI_SONG_PATTERN);
  if (multiSong) {
    return `Tên bài có “${multiSong[0].trim()}” nên đây có thể là liên khúc/mix/tuyển tập (nhiều bài trong một mục).`;
  }

  /*
   * Ten co tu 4 doan ngan cach bang `|` tro len -> thuong la muc ghep NHIEU bai.
   * (Khong dat nguong 3 vi da gap that: "JACK - J97 | LƯU NIÊN | Album TAM THÁI TỬ - Track No.4"
   * chi la mot bai nam trong album va tra cuu ra dung loi.)
   */
  const segments = title
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length >= 4) {
    return "Tên bài gồm nhiều đoạn ngăn cách bởi “|” nên có thể là mục gộp nhiều bài.";
  }

  if (song.durationSeconds > AUTO_LYRICS_MAX_DURATION_SECONDS) {
    return `Thời lượng hơn ${Math.round(AUTO_LYRICS_MAX_DURATION_SECONDS / 60)} phút nên có thể là mix/tuyển tập.`;
  }

  return null;
}

/** Bai co phai dang "mot bai hat" de tu tra cuu loi khong? */
export function isOrdinarySong(song: AutoLyricsSong): boolean {
  return autoLyricsSkipReason(song) === null;
}
