import { stripTitleNoise } from "@/lib/music/lyrics-title";

/**
 * KIEM TRA mot ban ghi loi (tu LRCLIB) co DUNG la bai dang co trong thu vien khong.
 *
 * Vi sao can: LRCLIB la noi cong dong tu dien, mot ten bai co the co nhieu ban ghi khac nhau
 * (cover, remix, ban live, ban khac nghia...). Neu cu lay "ban ghi dau tien co loi" thi rat de
 * hien LOI KHONG DUNG BAI. Nguyen tac o day: **khong lay loi sai** — the hon la bao "chua tim
 * thay" de quan tri vien dan tay.
 *
 * Tin hieu dung de xet:
 *  - TEN BAI (quan trong nhat): so khop theo tap tu, bo cac tu "nhieu" nhu official/mv/audio/
 *    remix/live/cover... vi cac ban nay thuong DUNG CHUNG loi voi ban goc.
 *  - NGHE SI: chi la tin hieu cong them. Thu vien noi bo hay ghi ten kenh/nguoi remix
 *    ("May Saigon Official", "VietZ") nen khong the bat buoc phai khop.
 *  - THOI LUONG: cung chi la tin hieu cong them (ban remix/lien khuc dai hon ban goc).
 */

export const MATCH_RULES = {
  /** Diem khop ten bai toi thieu (0..1) de coi la cung mot bai */
  titleMinScore: 0.75,
  /** Lech thoi luong tuyet doi duoc coi la khop */
  durationToleranceSeconds: 15,
  /** Lech thoi luong theo ti le (bai dai cho phep lech nhieu hon) */
  durationToleranceRatio: 0.08,
} as const;

/**
 * Cac tu "vo nghia" khi so khop: chung khong lam thay doi LOI bai hat
 * (ban remix/live/cover dung chung loi voi ban goc).
 */
const NOISE_TOKENS = new Set([
  "official",
  "officially",
  "video",
  "music",
  "audio",
  "mv",
  "lyrics",
  "lyric",
  "visualizer",
  "visualiser",
  "hd",
  "4k",
  "full",
  "track",
  "topic",
  "feat",
  "ft",
  "featuring",
  "prod",
  "remix",
  "remaster",
  "remastered",
  "version",
  "live",
  "cover",
  "karaoke",
  "beat",
  "instrumental",
  "acoustic",
  "studio",
  "records",
  "record",
  "channel",
  "media",
  "entertainment",
  "productions",
  "vpop",
  "the",
  "and",
  "x",
]);

export interface MatchableSong {
  title: string;
  artist: string | null;
  durationSeconds: number;
}

/** Bo dau tieng Viet + ha chu thuong + tach tu (dung cho so sanh "long") */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");
}

/** Tach mot chuoi thanh 2 tap tu: giu dau (chinh xac) va bo dau (long, cho ban ghi thieu dau) */
function tokensOf(value: string): { exact: string[]; folded: string[] } {
  const cleaned = value
    .toLowerCase()
    .replace(/[([][^)\]]*[)\]]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");

  const exact = cleaned.split(/\s+/).filter(Boolean);
  const folded = fold(cleaned).split(/\s+/).filter(Boolean);

  return { exact, folded };
}

/** Bo cac tu "nhieu" khoi danh sach tu (dung khi so khop ten bai) */
function coreTokens(value: string): { exact: string[]; folded: string[] } {
  const { exact, folded } = tokensOf(stripTitleNoise(value));
  const keep = (token: string) => token.length > 0 && !NOISE_TOKENS.has(token);

  return { exact: exact.filter(keep), folded: folded.filter(keep) };
}

/** Ti le tu chung tren tap tu ngan hon (1 = mot ten nam tron trong ten kia) */
function containment(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let common = 0;
  for (const token of setA) {
    if (setB.has(token)) common += 1;
  }

  return common / Math.min(setA.size, setB.size);
}

/** Do khop ten bai (0..1): so sanh ca ban giu dau lan ban bo dau */
export function titleMatchScore(songTitle: string, recordTitle: string | null | undefined): number {
  if (!recordTitle) return 0;

  const song = coreTokens(songTitle);
  const record = coreTokens(recordTitle);

  return Math.max(containment(song.exact, record.exact), containment(song.folded, record.folded));
}

/** Do khop nghe si (0..1): thu vien co the ghi ten kenh/nguoi remix nen day chi la tin hieu phu */
export function artistMatchScore(
  songArtist: string | null,
  recordArtist: string | null | undefined,
): number {
  if (!songArtist?.trim() || !recordArtist?.trim()) return 0;

  const song = coreTokens(songArtist);
  const record = coreTokens(recordArtist);

  return Math.max(containment(song.exact, record.exact), containment(song.folded, record.folded));
}

/** Thoi luong co khop khong? (chua biet thoi luong thi coi nhu khong xac nhan duoc) */
export function durationMatches(
  songSeconds: number,
  recordSeconds: number | null | undefined,
): boolean {
  if (!songSeconds || !recordSeconds || songSeconds <= 0 || recordSeconds <= 0) return false;

  const tolerance = Math.max(
    MATCH_RULES.durationToleranceSeconds,
    songSeconds * MATCH_RULES.durationToleranceRatio,
  );

  return Math.abs(songSeconds - recordSeconds) <= tolerance;
}

export type MatchRejectionReason = "ten-bai-khong-khop" | "chi-tiet-ten-bai";

export interface LyricsMatchDecision {
  /** Co du chac chan de hien loi nay cho nguoi dung khong? */
  accepted: boolean;
  /** Ly do bi tu choi (chi co khi `accepted = false`) */
  reason: MatchRejectionReason | null;
  titleScore: number;
  artistScore: number;
  durationOk: boolean;
  /** Diem tong hop de chon ban tot nhat khi co nhieu ung vien */
  total: number;
}

/**
 * Quyet dinh mot ban ghi loi co dung bai khong.
 *
 *  - Ten bai phai khop manh (`titleMinScore`);
 *  - Rieng ten bai QUA NGAN (1 tu, vi du "Jack") thi bat buoc phai co them tin hieu
 *    (nghe si hoac thoi luong) — tranh lay loi cua mot bai trung ten khac.
 */
export function evaluateLyricsCandidate(
  song: MatchableSong,
  record: MatchableRecord,
): LyricsMatchDecision {
  const titleScore = titleMatchScore(song.title, record.trackName);
  const artistScore = artistMatchScore(song.artist, record.artistName);
  const durationOk = durationMatches(song.durationSeconds, record.duration);

  const songCore = coreTokens(song.title).folded.length;
  const recordCore = coreTokens(record.trackName ?? "").folded.length;
  const tooGeneric = Math.min(songCore, recordCore) <= 1;

  const titleOk = titleScore >= MATCH_RULES.titleMinScore;
  const accepted = titleOk && (!tooGeneric || artistScore > 0 || durationOk);

  return {
    accepted,
    reason: accepted ? null : titleOk ? "chi-tiet-ten-bai" : "ten-bai-khong-khop",
    titleScore,
    artistScore,
    durationOk,
    total: titleScore * 3 + artistScore * 2 + (durationOk ? 1 : 0),
  };
}

/**
 * Do tin cay cua mot dong cache da luu (dung khi hien thi lai, khong goi mang):
 *  - `exact`: ten bai khop va co them nghe si khop,
 *  - `likely`: chi khop ten bai (thuong gap voi ban remix/cover hoac ten kenh),
 *  - `unknown`: khong co thong tin ban ghi de doi chieu.
 */
export function storedMatchConfidence(
  song: MatchableSong,
  matched: { track: string | null; artist: string | null },
): "exact" | "likely" | "unknown" {
  if (!matched.track) return "unknown";
  if (titleMatchScore(song.title, matched.track) < MATCH_RULES.titleMinScore) return "unknown";

  return artistMatchScore(song.artist, matched.artist) > 0 ? "exact" : "likely";
}

export interface MatchableRecord {
  trackName?: string | null;
  artistName?: string | null;
  duration?: number | null;
}
