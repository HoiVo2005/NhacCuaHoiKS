import { ServiceError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { toPlaylistDTO, toPlaylistDetailDTO, type PlaylistRow } from "@/lib/mappers";
import type { PlaylistInput } from "@/lib/validations";
import type { PlaylistDTO, PlaylistDetailDTO } from "@/types";

import { mapWithFavorites, songInclude } from "./song.service";

export const playlistInclude = {
  owner: { select: { id: true, name: true } },
  _count: { select: { items: true } },
};

/** Danh sach playlist: cong khai + cua chinh nguoi dung (khach chi thay cong khai) */
export async function listPlaylistsForUser(userId?: string | null): Promise<PlaylistDTO[]> {
  const rows = await prisma.playlist.findMany({
    where: userId ? { OR: [{ ownerId: userId }, { isPublic: true }] } : { isPublic: true },
    include: playlistInclude,
    orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
  });

  return rows.map((row) => toPlaylistDTO(row as PlaylistRow));
}

export async function listOwnedPlaylists(userId: string): Promise<PlaylistDTO[]> {
  const rows = await prisma.playlist.findMany({
    where: { ownerId: userId },
    include: playlistInclude,
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((row) => toPlaylistDTO(row as PlaylistRow));
}

/** Playlist noi bo do quan tri vien tao (hien thi tren trang chu) */
export async function listFeaturedPlaylists(limit = 6): Promise<PlaylistDTO[]> {
  const rows = await prisma.playlist.findMany({
    where: { isFeatured: true },
    include: playlistInclude,
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return rows.map((row) => toPlaylistDTO(row as PlaylistRow));
}

export async function listAllPlaylists(): Promise<PlaylistDTO[]> {
  const rows = await prisma.playlist.findMany({
    include: playlistInclude,
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((row) => toPlaylistDTO(row as PlaylistRow));
}

export async function getPlaylist(
  id: string,
  options: { userId: string; allowAdmin?: boolean },
): Promise<PlaylistDetailDTO | null> {
  const playlist = await prisma.playlist.findUnique({
    where: { id },
    include: playlistInclude,
  });

  if (!playlist) return null;

  const canView = options.allowAdmin || playlist.isPublic || playlist.ownerId === options.userId;

  if (!canView) {
    throw new ServiceError("Bạn không có quyền xem playlist này.", 403, "PLAYLIST_FORBIDDEN");
  }

  const items = await prisma.playlistSong.findMany({
    where: { playlistId: id },
    orderBy: [{ position: "asc" }, { addedAt: "asc" }],
    include: { song: { include: songInclude } },
  });

  const songs = await mapWithFavorites(
    items.map((item) => item.song),
    options.userId,
  );

  return toPlaylistDetailDTO(playlist as PlaylistRow, songs);
}

export async function createPlaylist(
  input: PlaylistInput,
  userId: string,
): Promise<PlaylistDTO> {
  const playlist = await prisma.playlist.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      coverUrl: input.coverUrl ?? null,
      isPublic: input.isPublic,
      /*
       * LUU Y (loi da tung gap): truoc day cho nay KHONG luu `isFeatured`, nen nut
       * "Tao playlist noi bo" o khu quan tri (gui isFeatured: true) van tao ra playlist
       * thuong -> playlist khong hien tren trang chu va thieu nhan "Noi bo",
       * quan tri vien phai bam "Dat lam noi bo" them mot lan nua.
       * Route da chan: nguoi khong phai ADMIN luon bi ep `isFeatured: false`.
       */
      isFeatured: input.isFeatured ?? false,
      ownerId: userId,
    },
    include: playlistInclude,
  });

  return toPlaylistDTO(playlist as PlaylistRow);
}

async function assertOwner(playlistId: string, userId: string, allowAdmin = false) {
  const playlist = await prisma.playlist.findUnique({
    where: { id: playlistId },
    select: { id: true, ownerId: true, name: true },
  });

  if (!playlist) {
    throw new ServiceError("Playlist không tồn tại.", 404, "PLAYLIST_NOT_FOUND");
  }

  if (!allowAdmin && playlist.ownerId !== userId) {
    throw new ServiceError(
      "Chỉ chủ sở hữu mới có thể thay đổi playlist này.",
      403,
      "PLAYLIST_FORBIDDEN",
    );
  }

  return playlist;
}

export async function updatePlaylist(
  id: string,
  input: Partial<PlaylistInput>,
  userId: string,
  allowAdmin = false,
): Promise<PlaylistDTO> {
  await assertOwner(id, userId, allowAdmin);

  const updated = await prisma.playlist.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl ?? null } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
    },
    include: playlistInclude,
  });

  return toPlaylistDTO(updated as PlaylistRow);
}

export async function deletePlaylist(
  id: string,
  userId: string,
  allowAdmin = false,
): Promise<void> {
  await assertOwner(id, userId, allowAdmin);
  await prisma.playlist.delete({ where: { id } });
}

/** Xoá nhiều playlist cùng lúc (bỏ qua playlist không có quyền hoặc đã bị xoá) */
export async function deletePlaylists(
  ids: string[],
  userId: string,
  allowAdmin = false,
): Promise<number> {
  let affected = 0;

  for (const id of ids) {
    try {
      await deletePlaylist(id, userId, allowAdmin);
      affected += 1;
    } catch {
      // bo qua muc khong xoa duoc
    }
  }

  return affected;
}

export async function addSongToPlaylist(
  playlistId: string,
  songId: string,
  userId: string,
  allowAdmin = false,
): Promise<void> {
  await assertOwner(playlistId, userId, allowAdmin);

  const song = await prisma.song.findUnique({ where: { id: songId }, select: { id: true } });
  if (!song) {
    throw new ServiceError("Bài nhạc không tồn tại.", 404, "SONG_NOT_FOUND");
  }

  const existing = await prisma.playlistSong.findUnique({
    where: { playlistId_songId: { playlistId, songId } },
    select: { id: true },
  });

  if (existing) {
    throw new ServiceError("Bài nhạc đã có trong playlist này.", 409, "SONG_ALREADY_IN_PLAYLIST");
  }

  const last = await prisma.playlistSong.findFirst({
    where: { playlistId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.playlistSong.create({
    data: {
      playlistId,
      songId,
      position: (last?.position ?? -1) + 1,
      addedById: userId,
    },
  });
}

export async function removeSongFromPlaylist(
  playlistId: string,
  songId: string,
  userId: string,
  allowAdmin = false,
): Promise<void> {
  await assertOwner(playlistId, userId, allowAdmin);

  await prisma.playlistSong.deleteMany({ where: { playlistId, songId } });
  await normalizePositions(playlistId);
}

export async function reorderPlaylist(
  playlistId: string,
  songIds: string[],
  userId: string,
  allowAdmin = false,
): Promise<void> {
  await assertOwner(playlistId, userId, allowAdmin);

  const items = await prisma.playlistSong.findMany({
    where: { playlistId },
    select: { id: true, songId: true },
  });

  const bySongId = new Map(items.map((item) => [item.songId, item.id]));
  const ordered = songIds.filter((songId) => bySongId.has(songId));
  const remaining = items.filter((item) => !ordered.includes(item.songId)).map((i) => i.songId);

  await prisma.$transaction(
    [...ordered, ...remaining].map((songId, index) =>
      prisma.playlistSong.update({
        where: { id: bySongId.get(songId)! },
        data: { position: index },
      }),
    ),
  );
}

async function normalizePositions(playlistId: string): Promise<void> {
  const items = await prisma.playlistSong.findMany({
    where: { playlistId },
    orderBy: [{ position: "asc" }, { addedAt: "asc" }],
    select: { id: true },
  });

  await prisma.$transaction(
    items.map((item, index) =>
      prisma.playlistSong.update({ where: { id: item.id }, data: { position: index } }),
    ),
  );
}

export async function countPlaylists(): Promise<number> {
  return prisma.playlist.count();
}

export async function countPlaylistsByOwner(ownerId: string): Promise<number> {
  return prisma.playlist.count({ where: { ownerId } });
}
