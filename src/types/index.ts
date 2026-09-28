export type Role = "ADMIN" | "EMPLOYEE";
export type SourceType = "YOUTUBE" | "SOUNDCLOUD" | "TIKTOK" | "UPLOADED";
export type PlaybackType = "EMBED" | "DIRECT";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
}

export interface GenreDTO {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  description: string | null;
  songCount?: number;
}

export interface SongCreatorDTO {
  id: string;
  name: string;
}

/** Bai nhac duoc gui xuong client (da chuan hoa tags + ngay thang) */
export interface SongDTO {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  description: string | null;
  durationSeconds: number;
  thumbnailUrl: string | null;
  sourceType: SourceType;
  sourceId: string | null;
  sourceUrl: string | null;
  streamUrl: string | null;
  embedUrl: string | null;
  playbackType: PlaybackType;
  tags: string[];
  genreId: string | null;
  genre: Pick<GenreDTO, "id" | "name" | "slug" | "color"> | null;
  isPublished: boolean;
  playCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: SongCreatorDTO | null;
  isFavorite?: boolean;
}

export interface PlaylistDTO {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  isFeatured: boolean;
  ownerId: string;
  ownerName: string;
  songCount: number;
  totalDurationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistDetailDTO extends PlaylistDTO {
  songs: SongDTO[];
}

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  stats?: {
    playCount: number;
    playlistCount: number;
    favoriteCount: number;
  };
}

export interface HistoryEntryDTO {
  id: string;
  playedAt: string;
  msPlayed: number;
  completed: boolean;
  song: SongDTO;
}

export interface PlayerCapabilities {
  canPlayPause: boolean;
  canSeek: boolean;
  canSetVolume: boolean;
  canReportProgress: boolean;
  canReportDuration: boolean;
  note: string;
}

export interface ResolvedMetadata {
  sourceType: SourceType;
  sourceId: string | null;
  title: string;
  artist: string | null;
  album: string | null;
  durationSeconds: number;
  thumbnailUrl: string | null;
  embedUrl: string;
  sourceUrl: string;
  streamUrl: string | null;
  playbackType: PlaybackType;
  provider: string;
  warnings: string[];
  /** The loai (neu nen tang tra ve, vi du SoundCloud genre) */
  genre?: string | null;
  /** Danh sach the/tag neu co */
  tags?: string[];
  /** Mo ta ngan (neu co) */
  description?: string | null;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface StatsOverview {
  totalSongs: number;
  publishedSongs: number;
  totalUsers: number;
  activeUsers: number;
  totalPlaylists: number;
  totalPlays: number;
  playsToday: number;
  plays7d: number;
  listeningHours: number;
  topSongs: { id: string; title: string; artist: string | null; playCount: number }[];
  playsByDay: { date: string; plays: number }[];
  topGenres: { name: string; color: string | null; plays: number }[];
  bySource: { source: SourceType; count: number }[];
  topListeners: { id: string; name: string; plays: number; msPlayed: number }[];
}
