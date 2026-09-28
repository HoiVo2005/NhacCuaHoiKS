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

/** Thiết bị đã đăng nhập: ĐANG dùng | đã bị đăng xuất từ xa | bị chặn đăng nhập */
export type DeviceStatus = "ACTIVE" | "REVOKED" | "BLOCKED";

/**
 * Thiết bị / phiên đăng nhập gửi xuống client (trang “Thiết bị đang đăng nhập”).
 * Hiển thị: tên máy, IP, vị trí, lần dùng gần nhất + trạng thái chặn.
 */
export interface DeviceDTO {
  id: string;
  /** Tên do người dùng tự đặt (nếu có) */
  label: string | null;
  /** Tên nhận diện tự động từ User-Agent */
  deviceName: string;
  /** Tên để hiển thị: `label` nếu có, ngược lại là `deviceName` */
  displayName: string;
  browser: string | null;
  platform: string | null;
  ipAddress: string | null;
  /** IP kèm ghi chú khi là mạng nội bộ (localhost/LAN) */
  ipLabel: string;
  /** Vị trí suy ra từ IP, ví dụ “Hà Nội, Việt Nam” */
  location: string | null;
  firstLoginAt: string;
  lastSeenAt: string;
  /** Có phải thiết bị đang dùng để xem trang này không */
  isCurrent: boolean;
  revokedAt: string | null;
  revokedByEmail: string | null;
  blockedAt: string | null;
  blockedByEmail: string | null;
  blockedReason: string | null;
  status: DeviceStatus;
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
