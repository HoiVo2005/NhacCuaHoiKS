import { prisma } from "@/lib/db/prisma";
import type { SongDTO, SourceType } from "@/types";

import { mapWithFavorites, songInclude } from "./song.service";

/** Bai nhac moi them gan day */
export async function listNewestSongs(
  limit = 12,
  userId?: string | null,
): Promise<SongDTO[]> {
  const rows = await prisma.song.findMany({
    where: { isPublished: true },
    include: songInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return mapWithFavorites(rows, userId);
}

/** Bai nhac nghe nhieu nhat */
export async function listTopSongs(limit = 10, userId?: string | null): Promise<SongDTO[]> {
  const rows = await prisma.song.findMany({
    where: { isPublished: true },
    include: songInclude,
    orderBy: [{ playCount: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return mapWithFavorites(rows, userId);
}

/** Bai nhac theo the loai */
export async function listSongsByGenre(
  genreSlug: string,
  limit = 20,
  userId?: string | null,
): Promise<SongDTO[]> {
  const rows = await prisma.song.findMany({
    where: { isPublished: true, genre: { slug: genreSlug } },
    include: songInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return mapWithFavorites(rows, userId);
}

/** Bai nhac theo nguon (YouTube/SoundCloud/TikTok/Upload) */
export async function listSongsBySource(
  source: SourceType,
  limit = 12,
  userId?: string | null,
): Promise<SongDTO[]> {
  const rows = await prisma.song.findMany({
    where: { isPublished: true, sourceType: source },
    include: songInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return mapWithFavorites(rows, userId);
}

/** Tim kiem nhanh cho thanh tim kiem (tra ve bai nhac + playlist) */
export async function quickSearch(term: string, userId?: string | null, limit = 6) {
  const keyword = term.trim();
  if (!keyword) {
    return { songs: [] as SongDTO[], playlists: [] as { id: string; name: string }[] };
  }

  const [songRows, playlists] = await Promise.all([
    prisma.song.findMany({
      where: {
        isPublished: true,
        OR: [
          { title: { contains: keyword } },
          { artist: { contains: keyword } },
          { tags: { contains: keyword } },
        ],
      },
      include: songInclude,
      orderBy: { playCount: "desc" },
      take: limit,
    }),
    prisma.playlist.findMany({
      where: {
        name: { contains: keyword },
        OR: [{ isPublic: true }, { ownerId: userId ?? "" }],
      },
      select: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
  ]);

  return {
    songs: await mapWithFavorites(songRows, userId),
    playlists,
  };
}

/** Bai nhac cung the loai (goi y phat tiep) */
export async function listRelatedSongs(
  songId: string,
  limit = 8,
  userId?: string | null,
): Promise<SongDTO[]> {
  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: { genreId: true, id: true },
  });

  if (!song) return [];

  const rows = await prisma.song.findMany({
    where: {
      isPublished: true,
      id: { not: song.id },
      ...(song.genreId ? { genreId: song.genreId } : {}),
    },
    include: songInclude,
    orderBy: { playCount: "desc" },
    take: limit,
  });

  if (rows.length > 0 || !song.genreId) {
    return mapWithFavorites(rows, userId);
  }

  // Neu the loai do chua co bai nao khac, tra ve bai moi nhat
  return listNewestSongs(limit, userId);
}
