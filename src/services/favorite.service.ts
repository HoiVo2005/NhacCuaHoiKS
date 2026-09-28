import { cache } from "react";

import { prisma } from "@/lib/db/prisma";
import { toSongDTO } from "@/lib/mappers";
import type { SongDTO } from "@/types";

/**
 * Tap id bai nhac yeu thich cua nguoi dung.
 *
 * Duoc cache theo TUNG REQUEST (React cache): mot trang hien nhieu danh sach
 * (nhac moi, nghe nhieu, nghe tiep...) chi ton MOT truy van thay vi mot truy van
 * cho moi danh sach - day la nguyen nhan chinh khien trang tai cham.
 */
export const getFavoriteIdSet = cache(async (userId: string): Promise<Set<string>> => {
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    select: { songId: true },
  });

  return new Set(favorites.map((favorite) => favorite.songId));
});

/** Tap id bai nhac da duoc nguoi dung yeu thich (dung de gan co isFavorite) */
export async function getFavoriteIds(
  userId: string,
  songIds: string[],
): Promise<Set<string>> {
  if (songIds.length === 0) return new Set();

  const all = await getFavoriteIdSet(userId);
  if (all.size === 0) return new Set();

  const result = new Set<string>();
  for (const songId of songIds) {
    if (all.has(songId)) result.add(songId);
  }

  return result;
}

export async function isFavorite(userId: string, songId: string): Promise<boolean> {
  const count = await prisma.favorite.count({ where: { userId, songId } });
  return count > 0;
}

export async function addFavorite(userId: string, songId: string): Promise<void> {
  await prisma.favorite.upsert({
    where: { userId_songId: { userId, songId } },
    create: { userId, songId },
    update: {},
  });
}

export async function removeFavorite(userId: string, songId: string): Promise<void> {
  await prisma.favorite.deleteMany({ where: { userId, songId } });
}

/** Bat / tat yeu thich, tra ve trang thai moi */
export async function toggleFavorite(userId: string, songId: string): Promise<boolean> {
  const existing = await prisma.favorite.findUnique({
    where: { userId_songId: { userId, songId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return false;
  }

  await prisma.favorite.create({ data: { userId, songId } });
  return true;
}

export async function countFavorites(userId: string): Promise<number> {
  return prisma.favorite.count({ where: { userId } });
}

/** Danh sach bai nhac yeu thich (moi nhat truoc) */
export async function listFavoriteSongs(userId: string, limit = 100): Promise<SongDTO[]> {
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      song: {
        include: {
          genre: { select: { id: true, name: true, slug: true, color: true } },
          createdBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Tat ca bai trong danh sach nay deu la yeu thich
  return favorites.map((favorite) => toSongDTO(favorite.song, { isFavorite: true }));
}
