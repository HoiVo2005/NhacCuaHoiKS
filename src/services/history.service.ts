import { SOURCE_TYPES } from "@/lib/constants";
import { prisma } from "@/lib/db/prisma";
import {
  buildDailyTrend,
  buildHourBuckets,
  buildStreak,
  DAY_MS,
  peakHourBucket,
  startOfLocalDay,
  type DayPlayCount,
  type HourBucket,
  type StreakInfo,
} from "@/lib/listening-insights";
import { toHistoryDTO, toSongDTO } from "@/lib/mappers";
import { getFavoriteIds } from "./favorite.service";
import type { HistoryEntryDTO, SongDTO, SourceType } from "@/types";

const songInclude = {
  genre: { select: { id: true, name: true, slug: true, color: true } },
  createdBy: { select: { id: true, name: true } },
};

/** Cua so gop lich su: neu cung bai hat duoc phat lai trong 90s thi cap nhat ban ghi cu */
const MERGE_WINDOW_MS = 90_000;

export interface RegisterPlayInput {
  userId: string;
  songId: string;
  msPlayed?: number;
  completed?: boolean;
  source?: string | null;
}

/** Ghi nhan mot luot nghe: tao/cap nhat lich su + tang luot phat */
export async function registerPlay(input: RegisterPlayInput): Promise<void> {
  const { userId, songId } = input;
  const msPlayed = input.msPlayed ?? 0;
  const completed = input.completed ?? false;
  const since = new Date(Date.now() - MERGE_WINDOW_MS);

  const recent = await prisma.listenHistory.findFirst({
    where: { userId, songId, playedAt: { gte: since } },
    orderBy: { playedAt: "desc" },
    select: { id: true, msPlayed: true, completed: true },
  });

  if (recent) {
    /*
     * Bo qua khi KHONG co gi moi: client co the gui lai dung vi tri cu (tam dung roi phat lai,
     * nhieu tab cung mo mot bai...). Truoc day moi request deu update -> ton them mot vong
     * truy van vao SQL Server ma du lieu khong doi.
     */
    const nextMsPlayed = Math.max(msPlayed, 0);
    const advanced = nextMsPlayed > recent.msPlayed;
    const marksCompleted = completed && !recent.completed;

    if (!advanced && !marksCompleted) return;

    await prisma.listenHistory.update({
      where: { id: recent.id },
      data: {
        playedAt: new Date(),
        msPlayed: nextMsPlayed,
        completed,
        source: input.source ?? null,
      },
    });
    return;
  }

  await prisma.$transaction([
    prisma.listenHistory.create({
      data: { userId, songId, msPlayed, completed, source: input.source ?? null },
    }),
    prisma.song.update({ where: { id: songId }, data: { playCount: { increment: 1 } } }),
  ]);
}

export async function listUserHistory(
  userId: string,
  limit = 50,
): Promise<HistoryEntryDTO[]> {
  const rows = await prisma.listenHistory.findMany({
    where: { userId },
    orderBy: { playedAt: "desc" },
    take: limit,
    include: { song: { include: songInclude } },
  });

  const favoriteIds = await getFavoriteIds(
    userId,
    rows.map((row) => row.songId),
  );

  return rows.map((row) =>
    toHistoryDTO(
      {
        id: row.id,
        playedAt: row.playedAt,
        msPlayed: row.msPlayed,
        completed: row.completed,
        song: row.song,
      },
      { isFavorite: favoriteIds.has(row.songId) },
    ),
  );
}

/** So dong lich sử quet toi da khi tim bai nghe gan day (de loc trung) */
const RECENT_HISTORY_SCAN_LIMIT = 200;

/**
 * Loc danh sach lich sử thành danh sách bài nhạc KHÔNG TRÙNG (mỗi bài 1 lần),
 * giữ thứ tự nghe mới nhất trước.
 *
 * Ly do: bang listen_history luu moi luot nghe la mot dong, nen neu nguoi dung
 * nghe lai cung mot bai nhieu lan thi bai do se xuat hien nhieu dong lien nhau.
 */
export function pickUniqueRecentSongs<T extends { songId: string }>(rows: T[], limit: number): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const row of rows) {
    if (seen.has(row.songId)) continue;
    seen.add(row.songId);
    unique.push(row);
    if (unique.length >= limit) break;
  }

  return unique;
}

/** Danh sach bai nhac nghe gan day (moi bai 1 lan, moi nhat truoc) */
export async function listRecentlyPlayedSongs(userId: string, limit = 10) {
  const rows = await prisma.listenHistory.findMany({
    where: { userId },
    orderBy: { playedAt: "desc" },
    // Quet rong hon so luong can hien thi de van du bai khac nhau du mot bai duoc nghe lai nhieu lan
    take: Math.min(Math.max(limit * 8, 60), RECENT_HISTORY_SCAN_LIMIT),
    include: { song: { include: songInclude } },
  });

  const unique = pickUniqueRecentSongs(rows, limit);

  const favoriteIds = await getFavoriteIds(
    userId,
    unique.map((row) => row.songId),
  );

  return unique.map((row) =>
    toHistoryDTO(
      {
        id: row.id,
        playedAt: row.playedAt,
        msPlayed: row.msPlayed,
        completed: row.completed,
        song: row.song,
      },
      { isFavorite: favoriteIds.has(row.songId) },
    ),
  );
}

export async function clearUserHistory(userId: string): Promise<number> {
  const result = await prisma.listenHistory.deleteMany({ where: { userId } });
  return result.count;
}

export async function deleteHistoryEntry(userId: string, entryId: string): Promise<void> {
  await prisma.listenHistory.deleteMany({ where: { id: entryId, userId } });
}

/** Xoá nhiều mục trong lịch sử nghe của chính người dùng */
export async function deleteHistoryEntries(userId: string, ids: string[]): Promise<number> {
  const result = await prisma.listenHistory.deleteMany({
    where: { id: { in: ids }, userId },
  });

  return result.count;
}

/** Lich su nghe nhac toan he thong (danh cho quan tri vien) */
export async function listAllHistory(limit = 200) {
  const rows = await prisma.listenHistory.findMany({
    orderBy: { playedAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, name: true, email: true } },
      song: { select: { id: true, title: true, artist: true, sourceType: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    playedAt: row.playedAt.toISOString(),
    msPlayed: row.msPlayed,
    completed: row.completed,
    user: row.user,
    song: row.song,
  }));
}

/** Thong ke nhanh cho trang Ho so ca nhan */
export async function getUserListeningStats(userId: string) {
  const [aggregate, distinctSongs, recentPlays] = await Promise.all([
    prisma.listenHistory.aggregate({
      where: { userId },
      _sum: { msPlayed: true },
      _count: { id: true },
    }),
    prisma.listenHistory.findMany({
      where: { userId },
      distinct: ["songId"],
      select: { songId: true },
    }),
    prisma.listenHistory.findMany({
      where: { userId, playedAt: { gte: new Date(Date.now() - 13 * 86_400_000) } },
      select: { playedAt: true },
    }),
  ]);

  const countsByDay = new Map<string, number>();
  for (const row of recentPlays) {
    const key = row.playedAt.toISOString().slice(0, 10);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  const playsByDay = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(Date.now() - (13 - index) * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    return { date: key, plays: countsByDay.get(key) ?? 0 };
  });

  return {
    totalPlays: aggregate._count.id,
    totalMsPlayed: aggregate._sum.msPlayed ?? 0,
    distinctSongs: distinctSongs.length,
    playsByDay,
  };
}

export type { SourceType };

/* ------------------------------- "Nhịp nghe" cá nhân ------------------------------ */

/** Cửa sổ dữ liệu cho phần “thói quen nghe” (biểu đồ ngày, giờ vàng, top…) */
export const INSIGHTS_WINDOW_DAYS = 60;

/** Số ngày vẽ trên biểu đồ “nhịp nghe” */
export const INSIGHTS_TREND_DAYS = 30;

/**
 * Số dòng lịch sử tối đa đọc về khi tính thói quen.
 * Người nghe rất nhiều vẫn không kéo cả bảng `listen_history` về Node (chỉ 60 ngày gần đây).
 */
const INSIGHTS_ROW_LIMIT = 5000;

export interface InsightSong {
  song: SongDTO;
  plays: number;
  msPlayed: number;
}

export interface ListeningInsights {
  /** Số ngày dữ liệu dùng cho phần thói quen (để trang hiển thị đúng nhãn) */
  windowDays: number;
  /** Tổng cộng dồn mọi thời điểm (không giới hạn cửa sổ) */
  totalPlays: number;
  totalMsPlayed: number;
  distinctSongs: number;
  /** Lần nghe đầu tiên (để hiện “bạn đã nghe từ …”) */
  firstPlayedAt: string | null;
  dailyTrend: DayPlayCount[];
  hourBuckets: HourBucket[];
  peakHour: HourBucket | null;
  streak: StreakInfo;
  topSongs: InsightSong[];
  topArtists: { name: string; plays: number; msPlayed: number }[];
  topGenres: { name: string; color: string | null; plays: number }[];
  bySource: { source: SourceType; count: number }[];
}

/**
 * Thống kê “Nhịp nghe” của một người dùng.
 *
 * Tổng số (lượt nghe / thời lượng / số bài khác nhau) tính bằng câu truy vấn tổng hợp của
 * CSDL; phần thói quen (giờ vàng, chuỗi ngày, top bài–nghệ sĩ–thể loại) tính trên 60 ngày
 * gần nhất để không phải kéo toàn bộ lịch sử về Node.
 */
export async function getListeningInsights(
  userId: string,
  options: { now?: Date; windowDays?: number; trendDays?: number } = {},
): Promise<ListeningInsights> {
  const now = options.now ?? new Date();
  const windowDays = Math.max(1, options.windowDays ?? INSIGHTS_WINDOW_DAYS);
  const trendDays = Math.max(1, options.trendDays ?? INSIGHTS_TREND_DAYS);
  const windowStart = startOfLocalDay(new Date(now.getTime() - (windowDays - 1) * DAY_MS));

  const [aggregate, distinctSongs, firstPlay, rows] = await Promise.all([
    prisma.listenHistory.aggregate({
      where: { userId },
      _sum: { msPlayed: true },
      _count: { id: true },
    }),
    prisma.listenHistory.findMany({
      where: { userId },
      distinct: ["songId"],
      select: { songId: true },
    }),
    prisma.listenHistory.findFirst({
      where: { userId },
      orderBy: { playedAt: "asc" },
      select: { playedAt: true },
    }),
    prisma.listenHistory.findMany({
      where: { userId, playedAt: { gte: windowStart } },
      orderBy: { playedAt: "desc" },
      take: INSIGHTS_ROW_LIMIT,
      include: { song: { include: songInclude } },
    }),
  ]);

  const timestamps = rows.map((row) => row.playedAt);

  /* Top bài hát: gom theo id, giữ lại dòng đầu tiên để có đủ dữ liệu bài nhạc */
  const perSong = new Map<string, { plays: number; msPlayed: number; row: (typeof rows)[number] }>();

  for (const row of rows) {
    const entry = perSong.get(row.songId);
    if (entry) {
      entry.plays += 1;
      entry.msPlayed += row.msPlayed;
      continue;
    }
    perSong.set(row.songId, { plays: 1, msPlayed: row.msPlayed, row });
  }

  const rankedSongs = [...perSong.values()].sort(
    (a, b) => b.plays - a.plays || b.msPlayed - a.msPlayed || a.row.song.title.localeCompare(b.row.song.title, "vi"),
  );

  const favoriteIds = await getFavoriteIds(
    userId,
    rankedSongs.slice(0, 8).map((entry) => entry.row.songId),
  );

  const topSongs: InsightSong[] = rankedSongs.slice(0, 8).map((entry) => ({
    song: toSongDTO(entry.row.song, { isFavorite: favoriteIds.has(entry.row.songId) }),
    plays: entry.plays,
    msPlayed: entry.msPlayed,
  }));

  /* Top nghệ sĩ / thể loại: gom theo tên (bài không rõ nghệ sĩ vẫn được đếm riêng) */
  const perArtist = new Map<string, { plays: number; msPlayed: number }>();
  const perGenre = new Map<string, { plays: number; color: string | null }>();
  const perSource = new Map<SourceType, number>();

  for (const row of rows) {
    const artist = row.song.artist?.trim() || "Không rõ nghệ sĩ";
    const artistEntry = perArtist.get(artist) ?? { plays: 0, msPlayed: 0 };
    artistEntry.plays += 1;
    artistEntry.msPlayed += row.msPlayed;
    perArtist.set(artist, artistEntry);

    const genreName = row.song.genre?.name ?? "Chưa phân loại";
    const genreEntry = perGenre.get(genreName) ?? { plays: 0, color: row.song.genre?.color ?? null };
    genreEntry.plays += 1;
    perGenre.set(genreName, genreEntry);

    const source = row.song.sourceType as SourceType;
    perSource.set(source, (perSource.get(source) ?? 0) + 1);
  }

  const hourBuckets = buildHourBuckets(timestamps, 3);

  return {
    windowDays,
    totalPlays: aggregate._count.id,
    totalMsPlayed: aggregate._sum.msPlayed ?? 0,
    distinctSongs: distinctSongs.length,
    firstPlayedAt: firstPlay?.playedAt.toISOString() ?? null,
    dailyTrend: buildDailyTrend(timestamps, trendDays, now),
    hourBuckets,
    peakHour: peakHourBucket(hourBuckets),
    streak: buildStreak(timestamps, now),
    topSongs,
    topArtists: [...perArtist.entries()]
      .map(([name, entry]) => ({ name, plays: entry.plays, msPlayed: entry.msPlayed }))
      .sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name, "vi"))
      .slice(0, 6),
    topGenres: [...perGenre.entries()]
      .map(([name, entry]) => ({ name, color: entry.color, plays: entry.plays }))
      .sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name, "vi"))
      .slice(0, 6),
    bySource: Object.values(SOURCE_TYPES).map((source) => ({
      source: source as SourceType,
      count: perSource.get(source as SourceType) ?? 0,
    })),
  };
}
