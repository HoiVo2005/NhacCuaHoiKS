import { ServiceError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { fetchJsonSafely, truncate } from "@/lib/music/http";
import { autoLyricsSkipReason, isOrdinarySong } from "@/lib/music/lyrics-auto";
import { parseLrc, parseLyricsInput, type LyricLine } from "@/lib/music/lyrics";
import {
  evaluateLyricsCandidate,
  storedMatchConfidence,
  type LyricsMatchDecision,
  type MatchableSong,
} from "@/lib/music/lyrics-match";
import { stripTitleNoise, TITLE_NOISE } from "@/lib/music/lyrics-title";
import { AdapterError } from "@/lib/music/types";

/**
 * Loi bai hat: doc tu cache trong CSDL (bang `song_lyrics`), neu chua co thi tra cuu
 * LRCLIB (API cong khai, khong can khoa) roi luu lai.
 *
 * Vi sao phai cache:
 *  - Moi lan mo trinh phat ma goi mang se cham va phu thuoc vao dich vu ben ngoai; LRCLIB con
 *    gioi han tan suat. Cache lai thi lan sau mo bai la co ngay.
 *  - Quan tri vien co the dan loi tay (`source = MANUAL`) de sua loi sai/chua co - ban dan tay
 *    luon duoc uu tien va KHONG bi ghi de boi ket qua tra cuu tu dong.
 *
 * Nguyen tac chat luong: **khong hien loi sai**. Moi ban ghi tim duoc phai qua kiem tra khop
 * (xem `lyrics-match.ts`); ban khong du chac chan bi bo qua va ghi lai de quan tri vien biet.
 */

export { stripTitleNoise };

const LRCLIB_BASE = "https://lrclib.net/api";

/** Chi cho phep goi dung ten mien nay (chong SSRF; xem `assertAllowedHost`) */
const LRCLIB_HOSTS = ["lrclib.net"];

/** Qua thoi gian nay thi coi nhu khong lay duoc loi (LRCLIB co luc phan hoi cham) */
const LRCLIB_TIMEOUT_MS = 12_000;

/** So lan thu lai khi loi mang (dich vu ngoai hay "ngat ket noi" tam thoi) */
const LRCLIB_ATTEMPTS = 2;

/** Lan truoc tra cuu khong thay loi: sau bao nhieu ngay thi thu lai (bai moi duoc bo sung loi) */
export const LYRICS_RETRY_AFTER_DAYS = 14;

/** Gioi han do dai loi dan tay (tranh nhet file la vao CSDL) */
const MAX_LYRICS_LENGTH = 20_000;

export type LyricsSource = "MANUAL" | "LRCLIB";

export interface LyricsResult {
  songId: string;
  source: LyricsSource;
  /** Loi co moc thoi gian (karaoke) hay khong */
  synced: boolean;
  /** Cac dong da parse san (client khong phai parse lai) */
  lines: LyricLine[];
  /** Loi thuong khi khong co moc thoi gian */
  plain: string | null;
  /** Do lech (ms) lay tu the `[offset:]` */
  offsetMs: number;
  /** Ten bai/nghe si da dung de tra cuu (hien thi cho quan tri vien biet nguon) */
  matched: { track: string | null; artist: string | null };
  updatedAt: string | null;
  /**
   * Do tin cay cua ban ghi dang hien:
   *  - `manual`: quan tri vien dan tay (dang tin nhat),
   *  - `exact`: ten bai + nghe si deu khop voi bai trong thu vien,
   *  - `likely`: chi khop ten bai (ban remix/cover hoac ten kenh) - UI nen nhac nguoi dung kiem tra,
   *  - `unknown`: khong co thong tin de doi chieu.
   */
  confidence: LyricsConfidence;
  /** Ban gan giong nhat bi BO QUA vi khong du chac chan (chi co khi chua co loi) */
  rejected?: { track: string | null; artist: string | null };
  /**
   * Ly do KHONG tu tra cuu loi (bai khong phai dang "mot bai hat": LK/mix/tuyen tap...).
   * Nhung bai nay van co the duoc quan tri vien dan loi tay.
   */
  skipReason?: string | null;
  /**
   * true = tam thoi KHONG ket noi duoc kho loi (LRCLIB) — khac han voi "bai nay khong co loi".
   * Truong hop nay KHONG duoc ghi cache de lan sau con thu lai.
   */
  unavailable?: boolean;
}

export type LyricsConfidence = "manual" | "exact" | "likely" | "unknown";

interface LyricsRow {
  songId: string;
  syncedLyrics: string | null;
  plainLyrics: string | null;
  source: string;
  matchedTrack: string | null;
  matchedArtist: string | null;
  updatedAt: Date;
}

function isSource(value: string): value is LyricsSource {
  return value === "MANUAL" || value === "LRCLIB";
}

/**
 * Bo cac phan "nhieu" trong ten bai khi tra cuu loi - xem `@/lib/music/lyrics-title`
 * (tach ra lib rieng de `lyrics-match.ts` dung chung ma khong tao vong lap module).
 */

/** So lan goi LRCLIB toi da cho MOT bai (mot bai hiem khong duoc lam cham ca request) */
const LRCLIB_REQUEST_BUDGET = 15;

/** So bien the ten bai toi da thu cho mot bai (moi bien the toi da 3 luot goi) */
const MAX_TITLE_CANDIDATES = 5;

/**
 * Tong thoi gian toi da cho mot lan tra cuu. Bai hiem (thu het moi bien the van khong co loi)
 * phai tra ve trong khoang nay, neu khong nguoi dung se ngoi doi vo ich; vuot tran thi bao
 * `unavailable` de lan sau con tra cuu lai.
 */
const LRCLIB_TOTAL_BUDGET_MS = 15_000;

/**
 * Cac ten bai nen thu lan luot khi tra cuu loi, tu **chinh xac nhat** toi **rong nhat**:
 *  1. ten da lam sach (bo phan nhieu, giu cac doan that su la ten bai),
 *  2. ten goc (nhu trong thu vien),
 *  3. tung doan sau dau `|` (kieu `JACK - J97 | LƯU NIÊN | Album...` -> `LƯU NIÊN`),
 *  4. phan truoc ` - ` (kieu `Ten bai - Nghe si`) — vi ban remix/lien khuc thuong lay loi ban goc.
 * Ban rong hon chi duoc thu SAU nen khong lam giam do chinh xac cua truong hop binh thuong.
 */
export function titleCandidates(title: string): string[] {
  const trimmed = title.trim();
  const cleaned = stripTitleNoise(trimmed);

  /*
   * Tach TAT CA cac doan theo dau `|` (ke ca doan dau) vi nguoi dung hay dat ten kieu
   * "TEN BAI | NGHE SI" - doan dau chinh la ten bai ("MẤT BAO LÂU | KHANG VIỆT" -> "MẤT BAO LÂU").
   * Loi da gap that: bo doan dau nen LRCLIB co bai ma khong tim ra.
   */
  const pipeSegments = trimmed
    .split("|")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && !TITLE_NOISE.test(segment));

  const beforeDash = trimmed.includes(" - ") ? (trimmed.split(" - ")[0] ?? "").trim() : "";

  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const candidate of [cleaned, trimmed, ...pipeSegments, beforeDash]) {
    const key = candidate.toLowerCase();
    if (!candidate || seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }

  /* Gioi han so bien the de so lan goi LRCLIB luon co tran (xem `LRCLIB_REQUEST_BUDGET`) */
  return candidates.slice(0, MAX_TITLE_CANDIDATES);
}

/** Trang thai cache co dung lai duoc khong? */
export function isCacheReusable(row: LyricsRow, now: Date = new Date()): boolean {
  const hasContent = Boolean(row.syncedLyrics) || Boolean(row.plainLyrics);
  if (hasContent) return true;
  // Loi dan tay (ke ca trong) luon duoc ton trong
  if (row.source === "MANUAL") return true;

  const ageMs = now.getTime() - row.updatedAt.getTime();
  return ageMs < LYRICS_RETRY_AFTER_DAYS * 86_400_000;
}

/**
 * Doi du lieu trong CSDL thanh ket qua gui cho client.
 *
 * `song` duoc truyen vao de TINH LAI do tin cay cua ban ghi da luu (so ten bai + nghe si voi bai
 * trong thu vien) — nho vay UI canh bao duoc khi chi la "khop gan dung" ma khong can luu them cot.
 */
export function toLyricsResult(row: LyricsRow, song: MatchableSong): LyricsResult {
  const parsed = row.syncedLyrics ? parseLrc(row.syncedLyrics) : null;
  const hasLyrics = Boolean(parsed && parsed.lines.length > 0) || Boolean(row.plainLyrics);
  const isManual = row.source === "MANUAL";

  const confidence: LyricsConfidence = isManual
    ? "manual"
    : storedMatchConfidence(song, { track: row.matchedTrack, artist: row.matchedArtist });

  return {
    songId: row.songId,
    source: isSource(row.source) ? row.source : "LRCLIB",
    synced: Boolean(parsed && parsed.lines.length > 0),
    lines: parsed?.lines ?? [],
    plain: row.plainLyrics ?? null,
    offsetMs: parsed?.offsetMs ?? 0,
    matched: { track: row.matchedTrack, artist: row.matchedArtist },
    updatedAt: row.updatedAt.toISOString(),
    confidence,
    /* Chua co loi nhung co thong tin ban gan giong -> bao ly do de quan tri vien dan tay */
    ...(hasLyrics || !row.matchedTrack
      ? {}
      : { rejected: { track: row.matchedTrack, artist: row.matchedArtist } }),
  };
}

interface LrclibRecord {
  trackName?: string;
  artistName?: string;
  duration?: number | null;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

export interface LrclibMatch {
  syncedLyrics: string | null;
  plainLyrics: string | null;
  track: string | null;
  artist: string | null;
  durationSeconds: number | null;
}

/** Ung vien da qua kiem tra khop */
export interface ScoredLyricsMatch {
  match: LrclibMatch;
  decision: LyricsMatchDecision;
}

/** LRCLIB tra 404 khi khong co ban ghi nao khop -> khong phai loi he thong */
function isNotFound(error: unknown): boolean {
  return (
    error instanceof AdapterError &&
    error.code === "UPSTREAM_ERROR" &&
    error.message.includes("404")
  );
}

/** Ket qua goi LRCLIB: co du lieu / khong co ban ghi / tam thoi khong ket noi duoc */
type LrclibOutcome<T> = { status: "ok"; data: T | null } | { status: "unavailable" };

/**
 * Goi LRCLIB voi thoi gian cho gioi han.
 *  - 404 -> `{ status: "ok", data: null }` (khong phai loi he thong),
 *  - loi mang/timeout -> thu lai `LRCLIB_ATTEMPTS` lan; van loi thi tra `unavailable`
 *    (KHONG nem loi ra ngoai, de route tra ve ket qua "tam thoi chua co loi" thay vi 500).
 */
async function requestLrclib<T>(path: string): Promise<LrclibOutcome<T>> {
  for (let attempt = 1; attempt <= LRCLIB_ATTEMPTS; attempt += 1) {
    try {
      const data = await fetchJsonSafely<T>(`${LRCLIB_BASE}${path}`, {
        hostAllowlist: LRCLIB_HOSTS,
        timeoutMs: LRCLIB_TIMEOUT_MS,
      });

      return { status: "ok", data };
    } catch (error) {
      if (isNotFound(error)) return { status: "ok", data: null };
      if (!(error instanceof AdapterError)) throw error;

      if (attempt < LRCLIB_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }

      console.warn(`[lyrics] Không gọi được LRCLIB (${error.code}): ${path}`);
      return { status: "unavailable" };
    }
  }

  return { status: "unavailable" };
}

function toMatch(record: LrclibRecord | null): LrclibMatch | null {
  if (!record) return null;

  const syncedLyrics = record.syncedLyrics?.trim() || null;
  const plainLyrics = record.plainLyrics?.trim() || null;
  if (!syncedLyrics && !plainLyrics) return null;

  return {
    syncedLyrics,
    plainLyrics,
    track: record.trackName ?? null,
    artist: record.artistName ?? null,
    durationSeconds: Number.isFinite(record.duration ?? NaN) ? Number(record.duration) : null,
  };
}

export interface LyricsLookup {
  /** Ban ghi DUNG BAI (null = khong tim thay ban nao dung bai) */
  match: LrclibMatch | null;
  /** true = tam thoi khong ket noi duoc LRCLIB (khac voi "khong co loi") */
  unavailable: boolean;
  /** Ban gan giong nhat bi bo qua vi khong du chac chan (de quan tri vien biet ly do) */
  rejected: LrclibMatch | null;
}

/**
 * Chon ban ghi TOT NHAT trong ket qua tim kiem, chi giu ban **dung bai**
 * (xem `evaluateLyricsCandidate`): uu tien diem cao nhat, bo qua ban khong du chac chan.
 */
export function pickBestLyricsCandidate(
  song: { title: string; artist: string | null; durationSeconds: number },
  records: LrclibRecord[] | null,
): { best: ScoredLyricsMatch | null; rejected: LrclibMatch | null } {
  if (!Array.isArray(records)) return { best: null, rejected: null };

  const scored: ScoredLyricsMatch[] = [];

  for (const record of records) {
    const match = toMatch(record);
    if (!match) continue;

    scored.push({ match, decision: evaluateLyricsCandidate(song, record) });
  }

  const accepted = scored
    .filter((candidate) => candidate.decision.accepted)
    .sort((a, b) => b.decision.total - a.decision.total);

  if (accepted.length > 0) return { best: accepted[0], rejected: null };

  const closest = [...scored].sort((a, b) => b.decision.total - a.decision.total)[0] ?? null;
  return { best: null, rejected: closest?.match ?? null };
}

/** Tham so truy van LRCLIB (co the kem nghe si / thoi luong) */
function buildParams(track: string, artist: string | null, durationSeconds?: number): string {
  const params = new URLSearchParams({ track_name: track });
  if (artist) params.set("artist_name", artist);
  if (durationSeconds && durationSeconds > 0) params.set("duration", String(Math.round(durationSeconds)));

  return params.toString();
}

/**
 * Tra cuu loi tren LRCLIB, tu "chinh xac nhat" toi "rong nhat":
 *  voi TUNG bien the ten bai (xem `titleCandidates`):
 *   1. `/get` khop ca ten bai + nghe si + thoi luong (chinh xac nhat),
 *   2. `/search` co ca nghe si,
 *   3. `/search` CHI theo ten bai — vi nghe si trong thu vien thuong la kenh YouTube/nguoi remix
 *      (vi du "Mây Saigon Official", "VietZ"), loc theo nghe si se lam mat ket qua dung.
 *
 * Co "ngan sach" so lan goi (`LRCLIB_REQUEST_BUDGET`): bai hiem (thu het moi bien the ma khong co)
 * se khong lam cham request cua nguoi dung — vuot ngan sach thi bao `unavailable` de con thu lai sau.
 */
export async function lookupLyrics(input: {
  title: string;
  artist: string | null;
  durationSeconds: number;
}): Promise<LyricsLookup> {
  const artist = input.artist?.replace(/\s*-\s*topic\s*$/i, "").trim() || null;
  const durationSeconds = Math.round(input.durationSeconds);
  const song = { title: input.title, artist: input.artist, durationSeconds };

  let budget = LRCLIB_REQUEST_BUDGET;
  const deadline = Date.now() + LRCLIB_TOTAL_BUDGET_MS;

  /** Ban gan giong nhat bi BO QUA (de bao cho quan tri vien biet vi sao khong hien loi) */
  let rejected: LrclibMatch | null = null;

  const canContinue = (): boolean => budget > 0 && Date.now() < deadline;
  const unavailable = (): LyricsLookup => ({ match: null, unavailable: true, rejected: null });
  const found = (match: LrclibMatch): LyricsLookup => ({ match, unavailable: false, rejected: null });

  const exhausted = (): LyricsLookup => {
    /* Het ngan sach: coi nhu tam thoi chua tra cuu duoc (KHONG ghi cache "khong co loi") */
    console.warn("[lyrics] Hết hạn mức tra cứu LRCLIB cho một bài - sẽ thử lại lần sau");
    return { match: null, unavailable: true, rejected: null };
  };

  for (const track of titleCandidates(input.title)) {
    if (durationSeconds > 0) {
      if (!canContinue()) return exhausted();
      budget -= 1;

      const exact = await requestLrclib<LrclibRecord>(
        `/get?${buildParams(track, artist, durationSeconds)}`,
      );
      if (exact.status === "unavailable") return unavailable();

      const match = toMatch(exact.data);
      if (match) {
        /* `/get` la khop chinh xac (ten + nghe si + thoi luong) nhung VAN kiem tra lai cho chac */
        const decision = evaluateLyricsCandidate(song, exact.data ?? {});
        if (decision.accepted) return found(match);

        rejected = rejected ?? match;
      }
    }

    if (!canContinue()) return exhausted();
    budget -= 1;

    const withArtist = await requestLrclib<LrclibRecord[]>(`/search?${buildParams(track, artist)}`);
    if (withArtist.status === "unavailable") return unavailable();

    const withArtistPick = pickBestLyricsCandidate(song, withArtist.data);
    if (withArtistPick.best) return found(withArtistPick.best.match);

    rejected = rejected ?? withArtistPick.rejected;

    if (artist) {
      if (!canContinue()) return exhausted();
      budget -= 1;

      const titleOnly = await requestLrclib<LrclibRecord[]>(`/search?${buildParams(track, null)}`);
      if (titleOnly.status === "unavailable") return unavailable();

      const titleOnlyPick = pickBestLyricsCandidate(song, titleOnly.data);
      if (titleOnlyPick.best) return found(titleOnlyPick.best.match);

      rejected = rejected ?? titleOnlyPick.rejected;
    }
  }

  return { match: null, unavailable: false, rejected };
}

/**
 * Loi cua mot bai hat: tra cache truoc, chua co thi tra cuu roi luu lai.
 * Loi dan tay (MANUAL) luon duoc uu tien va khong bi ghi de boi tra cuu tu dong.
 * Neu tam thoi khong goi duoc LRCLIB thi tra ket qua rong co co `unavailable` (khong ghi cache).
 */
export async function getSongLyrics(
  songId: string,
  options: { allowUnpublished?: boolean; force?: boolean } = {},
): Promise<LyricsResult> {
  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: { id: true, title: true, artist: true, durationSeconds: true, isPublished: true },
  });

  if (!song || (!song.isPublished && !options.allowUnpublished)) {
    throw new ServiceError("Bài nhạc không tồn tại hoặc chưa phát hành.", 404, "SONG_NOT_FOUND");
  }

  const skipReason = autoLyricsSkipReason(song);
  const cached = await prisma.songLyrics.findUnique({ where: { songId } });

  /* Loi do quan tri vien dan tay LUON duoc uu tien, khong bao gio bi bo qua */
  if (cached?.source === "MANUAL" && isCacheReusable(cached)) return toLyricsResult(cached, song);

  /*
   * Chi tu tra cuu cho "bai hat binh thuong" (mot bai, mot loi). Lien khuc/mix/tuyen tap bi bo qua
   * vi chung chua nhieu bai -> tra cuu tu dong de ra loi sai. Bo qua ca CACHE TU DONG cu (neu co)
   * vi ban ghi do duoc lay bang luat cu (co the sai bai). Quan tri vien van co the:
   *  - dan loi tay (luon duoc phep), hoac
   *  - gui `force` de thu tra cuu cho cac bai dang bi bo qua.
   */
  if (skipReason && !options.force) {
    return {
      songId,
      source: "LRCLIB",
      synced: false,
      lines: [],
      plain: null,
      offsetMs: 0,
      matched: { track: null, artist: null },
      updatedAt: null,
      confidence: "unknown",
      skipReason,
    };
  }

  if (cached && isCacheReusable(cached)) return toLyricsResult(cached, song);

  const lookup = await lookupLyrics(song);

  /*
   * Tam thoi khong ket noi duoc kho loi: tra ket qua rong co co `unavailable` va KHONG ghi cache
   * (neu ghi thi lan sau se bi coi la "bai nay khong co loi" suot 14 ngay).
   */
  if (lookup.unavailable) {
    return {
      songId,
      source: "LRCLIB",
      synced: false,
      lines: [],
      plain: null,
      offsetMs: 0,
      matched: { track: null, artist: null },
      updatedAt: null,
      confidence: "unknown",
      unavailable: true,
    };
  }

  const match = lookup.match;
  const data = {
    syncedLyrics: match?.syncedLyrics ?? null,
    plainLyrics: match?.plainLyrics ?? null,
    source: "LRCLIB",
    /*
     * Luu lai ban ghi da dung (hoac ban gan giong nhat bi bo qua) de lan sau con giai thich duoc
     * cho quan tri vien: "khong hien loi vi ban tim duoc khong du chac chan".
     */
    matchedTrack: truncate((match ?? lookup.rejected)?.track ?? null, 300),
    matchedArtist: truncate((match ?? lookup.rejected)?.artist ?? null, 200),
  };

  const saved = await prisma.songLyrics.upsert({
    where: { songId },
    create: { songId, ...data },
    update: data,
  });

  return toLyricsResult(saved, song);
}

/** Quan tri vien dan loi tay (LRC co moc thoi gian hoac loi thuong) */
export async function saveManualLyrics(
  songId: string,
  actorId: string,
  raw: string,
): Promise<LyricsResult> {
  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: { id: true, title: true, artist: true, durationSeconds: true },
  });
  if (!song) {
    throw new ServiceError("Bài nhạc không tồn tại.", 404, "SONG_NOT_FOUND");
  }

  if ((raw ?? "").length > MAX_LYRICS_LENGTH) {
    throw new ServiceError(
      `Lời bài hát quá dài (tối đa ${MAX_LYRICS_LENGTH.toLocaleString("vi-VN")} ký tự).`,
      400,
      "LYRICS_TOO_LONG",
    );
  }

  const input = parseLyricsInput(raw);
  if (!input.synced && !input.plain) {
    throw new ServiceError(
      "Lời bài hát không được để trống. Dán lời thường hoặc LRC có mốc [mm:ss.xx].",
      400,
      "LYRICS_EMPTY",
    );
  }

  const data = {
    syncedLyrics: input.synced ? (raw ?? "").trim() : null,
    plainLyrics: input.plain,
    source: "MANUAL",
    matchedTrack: null,
    matchedArtist: null,
    updatedById: actorId,
  };

  const saved = await prisma.songLyrics.upsert({
    where: { songId },
    create: { songId, ...data },
    update: data,
  });

  return toLyricsResult(saved, song);
}

/** Xoa cache loi cua mot bai (lan sau se tra cuu lai tu dau) */
export async function clearSongLyrics(songId: string): Promise<number> {
  const result = await prisma.songLyrics.deleteMany({ where: { songId } });
  return result.count;
}

/* ------------------------------ Lấy lời hàng loạt -------------------------------- */

/**
 * Bai vua tra cuu xong (trong vong 1 phut) ma khong co loi thi KHONG chon lai nua.
 * Nho vay nut "lay loi cho cac bai chua co" chay het luot la dung, khong lap vo han.
 */
const JUST_TRIED_WINDOW_MS = 60_000;

/** Nghi giua hai bai khi lay hang loat (lich su voi dich vu ben ngoai) */
const WARM_DELAY_MS = 250;

export interface WarmLyricsResult {
  /** So bai da thu tra cuu */
  attempted: number;
  /** So bai lay duoc loi (co moc thoi gian hoac loi thuong) */
  found: number;
  /** So bai LRCLIB khong co loi (da ghi nho de khong tra cuu lai lien tuc) */
  missing: number;
  /** So bai tam thoi khong tra cuu duoc (mang loi / het ngan sach) */
  unavailable: number;
  /** So bai BI BO QUA vi khong phai "bai hat binh thuong" (LK/mix/tuyen tap) */
  skipped: number;
}

/**
 * Lay + luu loi cho mot nhom bai, chay TUAN TU va nghi ngan giua cac bai de khong
 * "don dap" vao LRCLIB. Mot bai loi mang thi bo qua, khong lam hong cac bai con lai.
 *
 * Dung khi: them bai moi (chay nen) hoac quan tri vien bam "lay loi cho cac bai chua co".
 */
export async function warmLyricsCache(songIds: string[]): Promise<WarmLyricsResult> {
  const result: WarmLyricsResult = { attempted: 0, found: 0, missing: 0, unavailable: 0, skipped: 0 };

  for (let index = 0; index < songIds.length; index += 1) {
    const songId = songIds[index];
    result.attempted += 1;

    try {
      const lyrics = await getSongLyrics(songId);
      if (lyrics.skipReason) result.skipped += 1;
      else if (lyrics.unavailable) result.unavailable += 1;
      else if (lyrics.lines.length > 0 || lyrics.plain) result.found += 1;
      else result.missing += 1;
    } catch (error) {
      /* Bai khong ton tai / loi bat ngo: ghi log roi di tiep */
      console.warn(
        `[lyrics] Không lấy được lời cho bài ${songId}:`,
        error instanceof Error ? error.message : error,
      );
      result.unavailable += 1;
    }

    if (index < songIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, WARM_DELAY_MS));
    }
  }

  return result;
}

/**
 * So bai quet toi da khi tim bai "chua co loi". Viec loc "bai hat binh thuong" phai lam trong JS
 * (dieu kien theo TÊN BAI, khong dien dat duoc bang SQL mot cach gon gang) nen co tran quet:
 * thu vien cong ty vai tram bai van nam trong gioi han nay.
 */
const MISSING_LYRICS_SCAN_LIMIT = 500;

/** Dieu kien "da phat hanh nhung chua co loi dung duoc" (chua tra cuu, hoac da thu ma khong thay) */
function missingLyricsWhere() {
  return {
    isPublished: true,
    OR: [
      { lyrics: { is: null } },
      {
        lyrics: {
          is: {
            syncedLyrics: null,
            plainLyrics: null,
            updatedAt: { lt: new Date(Date.now() - JUST_TRIED_WINDOW_MS) },
          },
        },
      },
    ],
  };
}

/**
 * Id cac bai DA PHAT HANH, CHUA co loi, VA la "bai hat binh thuong" (loai tru LK/mix/tuyen tap).
 * Sap theo bai moi nhat truoc.
 */
export async function listSongIdsMissingLyrics(limit = 20): Promise<string[]> {
  const songs = await prisma.song.findMany({
    where: missingLyricsWhere(),
    orderBy: { createdAt: "desc" },
    take: MISSING_LYRICS_SCAN_LIMIT,
    select: { id: true, title: true, durationSeconds: true },
  });

  return songs
    .filter((song) => isOrdinarySong(song))
    .slice(0, Math.min(Math.max(Math.round(limit), 1), 50))
    .map((song) => song.id);
}

/** So bai "binh thuong" da phat hanh nhung chua co loi (bo qua LK/mix/tuyen tap) */
export async function countSongsMissingLyrics(): Promise<number> {
  const songs = await prisma.song.findMany({
    where: missingLyricsWhere(),
    take: MISSING_LYRICS_SCAN_LIMIT,
    select: { title: true, durationSeconds: true },
  });

  return songs.filter((song) => isOrdinarySong(song)).length;
}
