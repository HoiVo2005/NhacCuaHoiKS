import type { Genre, Playlist, Song, User } from "@prisma/client";
import { parseTags } from "@/lib/format";
import { upgradeThumbnailUrl } from "@/lib/music/thumbnails";
import type {
  GenreDTO,
  HistoryEntryDTO,
  PlaylistDetailDTO,
  PlaylistDTO,
  SongDTO,
  SourceType,
} from "@/types";

export type SongRow = Song & {
  genre?: Pick<Genre, "id" | "name" | "slug" | "color"> | null;
  createdBy?: Pick<User, "id" | "name"> | null;
};

export function toSongDTO(song: SongRow, options: { isFavorite?: boolean } = {}): SongDTO {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    description: song.description,
    durationSeconds: song.durationSeconds,
    /*
     * Anh bia duoc NANG CAP ngay khi tra DTO: bai cu trong CSDL con luu `hqdefault.jpg` (480x360,
     * co vien den) nen neu hien nguyen URL do thi bi mo o khung lon. Xem
     * `src/lib/music/thumbnails.ts` (the `<img>` se tu ha cap neu ban net nhat khong ton tai).
     */
    thumbnailUrl: upgradeThumbnailUrl(song.thumbnailUrl),
    sourceType: song.sourceType as SourceType,
    sourceId: song.sourceId,
    sourceUrl: song.sourceUrl,
    streamUrl: song.streamUrl,
    embedUrl: song.embedUrl,
    playbackType: song.playbackType === "DIRECT" ? "DIRECT" : "EMBED",
    tags: parseTags(song.tags),
    genreId: song.genreId,
    genre: song.genre
      ? {
          id: song.genre.id,
          name: song.genre.name,
          slug: song.genre.slug,
          color: song.genre.color,
        }
      : null,
    isPublished: song.isPublished,
    playCount: song.playCount,
    createdAt: song.createdAt.toISOString(),
    updatedAt: song.updatedAt.toISOString(),
    createdBy: song.createdBy ? { id: song.createdBy.id, name: song.createdBy.name } : null,
    isFavorite: options.isFavorite,
  };
}

export type PlaylistRow = Playlist & {
  owner?: Pick<User, "id" | "name"> | null;
  items?: { song: Pick<Song, "durationSeconds"> }[];
  _count?: { items: number };
};

export function toPlaylistDTO(playlist: PlaylistRow): PlaylistDTO {
  const songCount = playlist._count?.items ?? playlist.items?.length ?? 0;
  const totalDurationSeconds =
    playlist.items?.reduce((total, item) => total + (item.song.durationSeconds ?? 0), 0) ?? 0;

  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    coverUrl: upgradeThumbnailUrl(playlist.coverUrl),
    isPublic: playlist.isPublic,
    isFeatured: playlist.isFeatured,
    ownerId: playlist.ownerId,
    ownerName: playlist.owner?.name ?? "Hệ thống",
    songCount,
    totalDurationSeconds,
    createdAt: playlist.createdAt.toISOString(),
    updatedAt: playlist.updatedAt.toISOString(),
  };
}

export function toPlaylistDetailDTO(
  playlist: PlaylistRow,
  songs: SongDTO[],
): PlaylistDetailDTO {
  return {
    ...toPlaylistDTO({ ...playlist, _count: { items: songs.length } }),
    songs,
    songCount: songs.length,
    totalDurationSeconds: songs.reduce((total, song) => total + (song.durationSeconds ?? 0), 0),
  };
}

export function toGenreDTO(genre: Genre, songCount?: number): GenreDTO {
  return {
    id: genre.id,
    name: genre.name,
    slug: genre.slug,
    color: genre.color,
    description: genre.description,
    songCount,
  };
}

export type HistoryRow = {
  id: string;
  playedAt: Date;
  msPlayed: number;
  completed: boolean;
  song: SongRow;
};

export function toHistoryDTO(row: HistoryRow, options: { isFavorite?: boolean } = {}): HistoryEntryDTO {
  return {
    id: row.id,
    playedAt: row.playedAt.toISOString(),
    msPlayed: row.msPlayed,
    completed: row.completed,
    song: toSongDTO(row.song, options),
  };
}
