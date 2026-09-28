import { ServiceError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { MAX_DURATION_SECONDS, shouldSyncDuration } from "@/lib/duration";
import { serializeTags } from "@/lib/format";
import { toSongDTO, type SongRow } from "@/lib/mappers";
import { getStorage } from "@/lib/storage";
import type { CreateSongInput, SongListQuery, UpdateSongInput } from "@/lib/validations/song";
import type { SongDTO } from "@/types";

import { getFavoriteIds } from "./favorite.service";

export const songInclude = {
  genre: { select: { id: true, name: true, slug: true, color: true } },
  createdBy: { select: { id: true, name: true } },
};

export interface SongListResult {
  items: SongDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Gan co yeu thich cho danh sach bai nhac */
export async function mapWithFavorites(
  rows: SongRow[],
  userId?: string | null,
): Promise<SongDTO[]> {
  const favoriteIds = userId
    ? await getFavoriteIds(
        userId,
        rows.map((row) => row.id),
      )
    : new Set<string>();

  return rows.map((row) => toSongDTO(row, { isFavorite: favoriteIds.has(row.id) }));
}

const SORT_MAP = {
  newest: { createdAt: "desc" as const },
  oldest: { createdAt: "asc" as const },
  title: { title: "asc" as const },
  plays: { playCount: "desc" as const },
};

export async function listSongs(
  query: SongListQuery,
  options: { userId?: string | null } = {},
): Promise<SongListResult> {
  const { q, genre, source, sort, page, pageSize, scope } = query;
  const skip = (page - 1) * pageSize;

  const where = {
    ...(scope === "published" ? { isPublished: true } : {}),
    ...(source ? { sourceType: source } : {}),
    ...(genre ? { genre: { slug: genre } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { artist: { contains: q } },
            { album: { contains: q } },
            { tags: { contains: q } },
            { genre: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.song.findMany({
      where,
      include: songInclude,
      orderBy: SORT_MAP[sort],
      skip,
      take: pageSize,
    }),
    prisma.song.count({ where }),
  ]);

  return {
    items: await mapWithFavorites(rows, options.userId),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getSongById(
  id: string,
  options: { userId?: string | null; requirePublished?: boolean } = {},
): Promise<SongDTO | null> {
  const row = await prisma.song.findFirst({
    where: {
      id,
      ...(options.requirePublished ? { isPublished: true } : {}),
    },
    include: songInclude,
  });

  if (!row) return null;

  const [dto] = await mapWithFavorites([row], options.userId);
  return dto;
}

async function assertGenreExists(genreId: string | null | undefined): Promise<void> {
  if (!genreId) return;

  const genre = await prisma.genre.findUnique({ where: { id: genreId }, select: { id: true } });
  if (!genre) {
    throw new ServiceError("Thể loại không tồn tại.", 400, "INVALID_GENRE", {
      genreId: "Thể loại không tồn tại",
    });
  }
}

async function assertNoDuplicate(
  sourceType: string,
  sourceId: string | null | undefined,
  excludeId?: string,
): Promise<void> {
  if (sourceType === "UPLOADED" || !sourceId) return;

  const existing = await prisma.song.findFirst({
    where: { sourceType, sourceId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, title: true },
  });

  if (existing) {
    throw new ServiceError(
      `Bài nhạc này đã có trong thư viện: "${existing.title}".`,
      409,
      "DUPLICATE_SONG",
    );
  }
}

export async function createSong(
  input: CreateSongInput,
  actorId: string,
): Promise<SongDTO> {
  await assertGenreExists(input.genreId);
  await assertNoDuplicate(input.sourceType, input.sourceId);

  const song = await prisma.song.create({
    data: {
      title: input.title,
      artist: input.artist ?? null,
      album: input.album ?? null,
      description: input.description ?? null,
      durationSeconds: input.durationSeconds ?? 0,
      thumbnailUrl: input.thumbnailUrl ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      sourceUrl: input.sourceUrl ?? null,
      streamUrl: input.streamUrl ?? null,
      embedUrl: input.embedUrl ?? null,
      playbackType: input.playbackType,
      mimeType: input.mimeType ?? null,
      fileSizeBytes: input.fileSizeBytes ?? null,
      storageKey: input.storageKey ?? null,
      tags: serializeTags(input.tags),
      genreId: input.genreId ?? null,
      isPublished: input.isPublished,
      createdById: actorId,
      updatedById: actorId,
    },
    include: songInclude,
  });

  return toSongDTO(song);
}

export async function updateSong(
  id: string,
  input: UpdateSongInput,
  actorId: string,
): Promise<SongDTO> {
  const current = await prisma.song.findUnique({ where: { id }, select: { id: true } });
  if (!current) {
    throw new ServiceError("Bài nhạc không tồn tại.", 404, "SONG_NOT_FOUND");
  }

  if (input.genreId !== undefined) {
    await assertGenreExists(input.genreId);
  }

  const updated = await prisma.song.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.artist !== undefined ? { artist: input.artist ?? null } : {}),
      ...(input.album !== undefined ? { album: input.album ?? null } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}),
      ...(input.thumbnailUrl !== undefined ? { thumbnailUrl: input.thumbnailUrl ?? null } : {}),
      ...(input.genreId !== undefined ? { genreId: input.genreId ?? null } : {}),
      ...(input.tags !== undefined ? { tags: serializeTags(input.tags) } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      updatedById: actorId,
    },
    include: songInclude,
  });

  return toSongDTO(updated);
}

export async function setSongPublished(id: string, isPublished: boolean): Promise<void> {
  const result = await prisma.song.updateMany({ where: { id }, data: { isPublished } });
  if (result.count === 0) {
    throw new ServiceError("Bài nhạc không tồn tại.", 404, "SONG_NOT_FOUND");
  }
}

export async function deleteSong(id: string): Promise<void> {
  const song = await prisma.song.findUnique({
    where: { id },
    select: { id: true, storageKey: true, sourceType: true },
  });

  if (!song) {
    throw new ServiceError("Bài nhạc không tồn tại.", 404, "SONG_NOT_FOUND");
  }

  await prisma.song.delete({ where: { id } });

  if (song.sourceType === "UPLOADED" && song.storageKey) {
    try {
      await getStorage().remove(song.storageKey);
    } catch (error) {
      console.error("[song] Không xoá được file trong storage:", error);
    }
  }
}

/**
 * Dong bo thoi luong THAT do trinh phat bao ve (nen tang chinh thuc).
 * Ghi khi CSDL chua biet thoi luong, hoac khi gia tri dang luu lech qua nhieu.
 */
export async function syncDuration(id: string, seconds: number): Promise<boolean> {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_DURATION_SECONDS) return false;

  const song = await prisma.song.findUnique({
    where: { id },
    select: { durationSeconds: true },
  });

  if (!song) return false;
  if (!shouldSyncDuration(song.durationSeconds, seconds)) return false;

  await prisma.song.update({
    where: { id },
    data: { durationSeconds: Math.round(seconds) },
  });

  return true;
}

export async function countSongs(where: { isPublished?: boolean } = {}): Promise<number> {
  return prisma.song.count({ where });
}

/** Xoá nhiều bài nhạc cùng lúc (kèm dọn file trong storage) */
export async function deleteSongs(ids: string[]): Promise<number> {
  const existing = await prisma.song.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });

  let affected = 0;
  for (const song of existing) {
    await deleteSong(song.id);
    affected += 1;
  }

  return affected;
}

/** Ẩn / phát hành nhiều bài nhạc cùng lúc */
export async function setSongsPublished(ids: string[], isPublished: boolean): Promise<number> {
  const result = await prisma.song.updateMany({
    where: { id: { in: ids } },
    data: { isPublished },
  });

  return result.count;
}
