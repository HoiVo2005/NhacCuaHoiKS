/**
 * Loi bai hat: doc file LRC (loi co moc thoi gian) va tim dong dang hat.
 *
 * Vi sao tach ra lib thuan:
 *  - LRC la dinh dang "de sai": mot dong co the co NHIEU moc thoi gian (`[00:12.00][00:55.00]Diep khuc`),
 *    co the co the `[offset:-500]`, tag meta `[ti:]/[ar:]`, moc chi co phut:giay hoac co phan tram giay.
 *  - Viec tim "dong dang hat" phai dung khi nhieu dong cung moc (diep khuc) va phai nhanh (chay ~4 lan/giay
 *    theo tien do bai hat) nen dung tim kiem nhi phan thay vi duyet tuyen tinh.
 *  - `npm run check:lyrics` kiem chung toan bo cac truong hop tren bang du lieu gia, khong can mang.
 */

/** Mot dong loi da co moc thoi gian (ms) */
export interface LyricLine {
  timeMs: number;
  text: string;
}

export interface ParsedLyrics {
  /** Do lech (ms) lay tu the `[offset:...]` trong file LRC (am = hat som hon) */
  offsetMs: number;
  lines: LyricLine[];
  meta: {
    title: string | null;
    artist: string | null;
    album: string | null;
  };
}

/** Moi lan bam "chinh lech" doi 0,5 giay (du de bu sai lech thuc te) */
export const LYRIC_OFFSET_STEP_MS = 500;

/** Gioi han do lech cho phep chinh tay (tranh bam nham lam loi chay lech han) */
export const LYRIC_MAX_OFFSET_MS = 10_000;

/** Moc thoi gian: `[mm:ss]`, `[mm:ss.xx]`, `[mm:ss:xx]`, cho phep nhieu moc tren mot dong */
const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

/** The meta cua LRC: `[ti:Ten bai]`, `[ar:Nghe si]`... */
const META_TAG = /^\[(ti|ar|al|by|re|ve|length):([^\]]*)\]$/i;

/** The chinh do lech: `[offset:-500]` */
const OFFSET_TAG = /^\[offset:\s*(-?\d+)\s*\]$/i;

/** Doan loi nay co moc thoi gian chua? (neu khong thi chi hien nhu van ban thuong) */
export function looksSynced(raw: string | null | undefined): boolean {
  if (!raw) return false;
  TIME_TAG.lastIndex = 0;
  return TIME_TAG.test(raw);
}

/** Doi phan giay dang thap phan cua LRC sang ms: `5` -> 500, `35` -> 350, `355` -> 355 */
function fractionToMs(fraction: string | undefined): number {
  if (!fraction) return 0;
  if (fraction.length === 1) return Number(fraction) * 100;
  if (fraction.length === 2) return Number(fraction) * 10;
  return Number(fraction.slice(0, 3));
}

/**
 * Doc chuoi LRC thanh danh sach dong co moc thoi gian.
 * Dong chi co moc thoi gian ma khong co chu (khoang nhac) bi bo qua vi khong co gi de to sang.
 */
export function parseLrc(raw: string): ParsedLyrics {
  const result: ParsedLyrics = {
    offsetMs: 0,
    lines: [],
    meta: { title: null, artist: null, album: null },
  };

  if (!raw) return result;

  for (const sourceLine of raw.replace(/\r\n?/g, "\n").split("\n")) {
    const line = sourceLine.trim();
    if (!line) continue;

    const offsetMatch = line.match(OFFSET_TAG);
    if (offsetMatch) {
      result.offsetMs = Number(offsetMatch[1]);
      continue;
    }

    const metaMatch = line.match(META_TAG);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const value = metaMatch[2].trim() || null;
      if (key === "ti") result.meta.title = value;
      else if (key === "ar") result.meta.artist = value;
      else if (key === "al") result.meta.album = value;
      continue;
    }

    /* Cac moc thoi gian co the nam dau dong; phan con lai la loi bai hat */
    const times: number[] = [];
    TIME_TAG.lastIndex = 0;
    let match = TIME_TAG.exec(line);

    while (match) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      times.push(minutes * 60_000 + seconds * 1000 + fractionToMs(match[3]));
      match = TIME_TAG.exec(line);
    }

    if (times.length === 0) continue;

    TIME_TAG.lastIndex = 0;
    const text = line.replace(TIME_TAG, "").replace(/\s+/g, " ").trim();
    if (!text) continue;

    for (const timeMs of times) {
      result.lines.push({ timeMs, text });
    }
  }

  // Nhieu dong cung moc (diep khuc) van duoc giu; sap xep on dinh theo thoi gian
  result.lines.sort((a, b) => a.timeMs - b.timeMs);
  return result;
}

/**
 * Dong dang hat tai vi tri `positionMs`:
 *  - tra ve `-1` khi con dang o doan nhac dau (truoc dong loi dau tien),
 *  - tra ve chi so dong CUOI CUNG co moc <= vi tri hien tai.
 * Dung tim kiem nhi phan vi ham nay duoc goi lien tuc theo tien do bai hat.
 */
export function findActiveLyricIndex(lines: LyricLine[], positionMs: number): number {
  if (lines.length === 0) return -1;
  if (!Number.isFinite(positionMs) || positionMs < lines[0].timeMs) return -1;

  let low = 0;
  let high = lines.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].timeMs <= positionMs) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return found;
}

/** Doi danh sach dong co moc thoi gian thanh van ban thuong (de copy/hien thi) */
export function lyricsToPlainText(lines: LyricLine[]): string {
  return lines.map((line) => line.text).join("\n");
}

/** Moc thoi gian dang `mm:ss.cc` (dung cho trinh soan loi cua quan tri vien) */
export function formatLyricTimestamp(timeMs: number): string {
  const safe = Math.max(0, Math.round(timeMs));
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const centiseconds = Math.floor((safe % 1000) / 10);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

/** Don dep loi dan tay: bo khoang trang thua, gom nhieu dong trong lien tiep */
export function normalizePlainLyrics(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "")
    .trim();
}

export interface LyricsInput {
  /** Loi dan vao co moc thoi gian (dang karaoke) khong? */
  synced: boolean;
  lines: LyricLine[];
  /** Van ban de hien thi khi khong dong bo (hoac de copy ra ngoai) */
  plain: string;
  offsetMs: number;
}

/**
 * Chuan hoa loi do quan tri vien dan vao: tu nhan biet co moc thoi gian hay khong.
 * (Dan tu LRCLIB hay nguon khac deu dung duoc: co the `[mm:ss.xx]` thi thanh karaoke.)
 */
export function parseLyricsInput(raw: string): LyricsInput {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { synced: false, lines: [], plain: "", offsetMs: 0 };

  if (!looksSynced(trimmed)) {
    return { synced: false, lines: [], plain: normalizePlainLyrics(trimmed), offsetMs: 0 };
  }

  const parsed = parseLrc(trimmed);
  const plain = parsed.lines.length > 0 ? lyricsToPlainText(parsed.lines) : normalizePlainLyrics(trimmed);

  return { synced: parsed.lines.length > 0, lines: parsed.lines, plain, offsetMs: parsed.offsetMs };
}
