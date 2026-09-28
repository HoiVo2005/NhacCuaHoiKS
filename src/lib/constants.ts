import type { PlayerCapabilities, SourceType } from "@/types";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "NhacCuaHoiKS";

export const ROLES = {
  ADMIN: "ADMIN",
  EMPLOYEE: "EMPLOYEE",
} as const;

export const SOURCE_TYPES = {
  YOUTUBE: "YOUTUBE",
  SOUNDCLOUD: "SOUNDCLOUD",
  TIKTOK: "TIKTOK",
  UPLOADED: "UPLOADED",
} as const;

export const SOURCE_LABELS: Record<SourceType, string> = {
  YOUTUBE: "YouTube",
  SOUNDCLOUD: "SoundCloud",
  TIKTOK: "TikTok",
  UPLOADED: "File tải lên",
};

/**
 * Mau thuong hieu tung nguon phat - dung token CSS de tu doi theo giao dien sang/toi
 * (ban sang can sac dam hon moi du tuong phan tren nen trang).
 */
export const SOURCE_COLORS: Record<SourceType, string> = {
  YOUTUBE: "var(--source-youtube)",
  SOUNDCLOUD: "var(--source-soundcloud)",
  TIKTOK: "var(--source-tiktok)",
  UPLOADED: "var(--source-uploaded)",
};

/**
 * Mau chu dao cua he thong: #3A80F6.
 * Dung khi can mot mau hex cu the (mau the loai, mau mac dinh trong CSDL...);
 * con lai nen dung token CSS (`bg-primary`, `text-brand`) de tu doi theo giao dien.
 */
export const BRAND_COLOR = "#3a80f6";

/** Mau mac dinh khi tao the loai moi (quan tri vien co the doi sau) */
export const DEFAULT_GENRE_COLOR = BRAND_COLOR;

/** Cac ten mien duoc phep lay metadata (chong SSRF) */
export const ALLOWED_METADATA_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "soundcloud.com",
  "www.soundcloud.com",
  "m.soundcloud.com",
  "tiktok.com",
  "www.tiktok.com",
  "m.tiktok.com",
];

/**
 * Kha nang dieu khien cua tung loai nguon nhac.
 * Dung de UI hien thi dung: tinh nang nao duoc ho tro va tinh nang nao bi khoa.
 */
export const PLAYER_CAPABILITIES: Record<SourceType, PlayerCapabilities> = {
  YOUTUBE: {
    canPlayPause: true,
    canSeek: true,
    canSetVolume: true,
    canReportProgress: true,
    canReportDuration: true,
    note: "Phát qua YouTube IFrame Player API chính thức.",
  },
  SOUNDCLOUD: {
    canPlayPause: true,
    canSeek: true,
    canSetVolume: true,
    canReportProgress: true,
    canReportDuration: true,
    note: "Phát qua SoundCloud Widget API chính thức.",
  },
  TIKTOK: {
    canPlayPause: true,
    canSeek: true,
    canSetVolume: false,
    canReportProgress: true,
    canReportDuration: true,
    note: "TikTok Embed Player chỉ hỗ trợ tắt/bật tiếng (kể cả thanh trượt âm lượng ở đây). Muốn chỉnh mức nhỏ/lớn, bấm nút loa trong khung video.",
  },
  UPLOADED: {
    canPlayPause: true,
    canSeek: true,
    canSetVolume: true,
    canReportProgress: true,
    canReportDuration: true,
    note: "Phát trực tiếp từ file nội bộ.",
  },
};

export const DEFAULT_PAGE_SIZE = 24;

export const UPLOAD_ACCEPTED_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/flac",
];

export const MAX_TAG_LENGTH = 40;
