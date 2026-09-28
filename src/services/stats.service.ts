import { prisma } from "@/lib/db/prisma";
import type { SourceType, StatsOverview } from "@/types";

const DAY_MS = 86_400_000;

function startOfDay(offsetDays = 0): Date {
  const date = new Date(Date.now() - offsetDays * DAY_MS);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Thong ke tong quan cho dashboard quan tri */
export async function getStatsOverview(): Promise<StatsOverview> {
  const now = Date.now();
  const since7d = new Date(now - 7 * DAY_MS);
  const since14d = new Date(now - 13 * DAY_MS);
  const today = startOfDay();

  const [
    totalSongs,
    publishedSongs,
    totalUsers,
    activeUsers,
    totalPlaylists,
    totalPlays,
    playsToday,
    plays7d,
    listeningAggregate,
    topSongs,
    playsByDayRows,
    genreRows,
    sourceRows,
    topListenerRows,
  ] = await Promise.all([
    prisma.song.count(),
    prisma.song.count({ where: { isPublished: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.playlist.count(),
    prisma.listenHistory.count(),
    prisma.listenHistory.count({ where: { playedAt: { gte: today } } }),
    prisma.listenHistory.count({ where: { playedAt: { gte: since7d } } }),
    prisma.listenHistory.aggregate({ _sum: { msPlayed: true } }),
    prisma.song.findMany({
      where: { playCount: { gt: 0 } },
      orderBy: { playCount: "desc" },
      take: 8,
      select: { id: true, title: true, artist: true, playCount: true },
    }),
    prisma.listenHistory.findMany({
      where: { playedAt: { gte: since14d } },
      select: { playedAt: true },
    }),
    prisma.genre.findMany({
      select: {
        name: true,
        color: true,
        songs: { select: { playCount: true } },
      },
    }),
    prisma.song.groupBy({
      by: ["sourceType"],
      _count: { _all: true },
    }),
    // Tong hop ngay o SQL Server (khong keo toan bo lich su cua nguoi dung ve Node)
    prisma.listenHistory.groupBy({
      by: ["userId"],
      _count: { _all: true },
      _sum: { msPlayed: true },
      orderBy: { _count: { userId: "desc" } },
      take: 5,
    }),
  ]);

  const countsByDay = new Map<string, number>();
  for (const row of playsByDayRows) {
    const key = toDayKey(row.playedAt);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  const playsByDay = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now - (13 - index) * DAY_MS);
    const key = toDayKey(date);
    return { date: key, plays: countsByDay.get(key) ?? 0 };
  });

  const topListenerIds = topListenerRows.map((row) => row.userId);
  const topListenerUsers = topListenerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topListenerIds } },
        select: { id: true, name: true },
      })
    : [];

  const nameById = new Map(topListenerUsers.map((user) => [user.id, user.name]));

  return {
    totalSongs,
    publishedSongs,
    totalUsers,
    activeUsers,
    totalPlaylists,
    totalPlays,
    playsToday,
    plays7d,
    listeningHours: (listeningAggregate._sum.msPlayed ?? 0) / 3_600_000,
    topSongs,
    playsByDay,
    topGenres: genreRows
      .map((genre) => ({
        name: genre.name,
        color: genre.color,
        plays: genre.songs.reduce((total, song) => total + song.playCount, 0),
      }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 6),
    bySource: sourceRows.map((row) => ({
      source: row.sourceType as SourceType,
      count: row._count._all,
    })),
    topListeners: topListenerRows.map((row) => ({
      id: row.userId,
      name: nameById.get(row.userId) ?? "Người dùng",
      plays: row._count._all,
      msPlayed: row._sum.msPlayed ?? 0,
    })),
  };
}
