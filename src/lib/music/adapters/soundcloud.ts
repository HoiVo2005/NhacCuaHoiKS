import type { ResolvedMetadata } from "@/types";

import { buildSoundCloudEmbedUrl } from "../detect";
import { fetchJsonSafely, fetchTextSafely, truncate } from "../http";
import { MetadataUnavailableError, type AdapterContext, type SourceAdapter } from "../types";

/** Phan hoi cua SoundCloud API v2 (khi co client_id) */
interface SoundCloudApiTrack {
  kind?: string;
  id?: number;
  title?: string;
  duration?: number;
  genre?: string;
  tag_list?: string;
  permalink_url?: string;
  artwork_url?: string | null;
  streamable?: boolean;
  user?: { username?: string; permalink_url?: string };
}

function extractMetaTag(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property="${property}"[^>]+content="([^"]*)"`, "i"),
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${property}"`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractJsonString(html: string, key: string): string | null {
  const match = html.match(new RegExp(`"${key}":\\s*"([^"]{1,200})"`));
  return match?.[1] ?? null;
}

function extractJsonNumber(html: string, key: string): number | null {
  const match = html.match(new RegExp(`"${key}":\\s*(\\d{3,})`));
  return match ? Number(match[1]) : null;
}

/**
 * Doc metadata tu trang bai nhac cong khai (the meta Open Graph + du lieu hydration).
 * Day la du lieu ma moi trinh duyet/tinh nang xem truoc lien ket deu doc duoc.
 */
export function parseSoundCloudTrackPage(html: string): {
  title: string | null;
  artist: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  durationSeconds: number;
  genre: string | null;
} {
  const title = extractMetaTag(html, "og:title");
  const thumbnailUrl = extractMetaTag(html, "og:image");
  const description = extractMetaTag(html, "og:description");
  const artist = extractJsonString(html, "username");

  // Du lieu hydration cua trang bai nhac co thoi luong chinh xac (don vi mili giay)
  const durationMs =
    extractJsonNumber(html, "duration") ?? extractJsonNumber(html, "full_duration");
  const genre = extractJsonString(html, "genre");

  return {
    title: title && title !== "SoundCloud" ? title : null,
    artist,
    thumbnailUrl,
    description,
    durationSeconds: durationMs && durationMs > 1000 ? Math.round(durationMs / 1000) : 0,
    genre,
  };
}

/** Phat hien link dang playlist/set (khong phai mot bai nhac) */
function isPlaylistUrl(url: URL): boolean {
  return url.pathname.includes("/sets/") || url.pathname.includes("/albums/");
}

/**
 * Adapter SoundCloud:
 *  - Uu tien 1: SoundCloud API chinh thuc (api.soundcloud.com/resolve) khi co SOUNDCLOUD_CLIENT_ID
 *    => day du ten, nghe si, thoi luong, anh bia, the loai, tags
 *  - Uu tien 2: doc the meta Open Graph + du lieu hydration cua trang bai nhac cong khai
 *    (oEmbed cua SoundCloud da ngung hoat dong, tra ve 404)
 *  - Phat nhac: SoundCloud Widget API chinh thuc (iframe w.soundcloud.com/player)
 *
 * Trinh duyet se tu bo sung thoi luong con thieu qua Widget API (getCurrentSound).
 */
export const soundcloudAdapter: SourceAdapter = {
  type: "SOUNDCLOUD",
  label: "SoundCloud",

  supports(url) {
    return url.hostname.toLowerCase().endsWith("soundcloud.com");
  },

  async resolve(url, context: AdapterContext): Promise<ResolvedMetadata> {
    const canonicalUrl = `https://soundcloud.com${url.pathname.replace(/\/+$/, "")}`;
    const warnings: string[] = [];

    if (canonicalUrl.split("/").filter(Boolean).length < 2) {
      throw new MetadataUnavailableError(
        "Đường dẫn SoundCloud cần trỏ tới một bài nhạc cụ thể (ví dụ: soundcloud.com/tac-gia/ten-bai).",
      );
    }

    // --- Uu tien 1: API chinh thuc (can client_id) ---
    if (context.soundcloudClientId) {
      try {
        const track = await fetchJsonSafely<SoundCloudApiTrack>(
          `https://api.soundcloud.com/resolve?url=${encodeURIComponent(canonicalUrl)}&client_id=${encodeURIComponent(context.soundcloudClientId)}`,
          { timeoutMs: context.timeoutMs, hostAllowlist: ["soundcloud.com"] },
        );

        if (track?.title) {
          if (track.streamable === false) {
            warnings.push("Chủ sở hữu đã tắt tính năng phát trực tuyến cho bài nhạc này.");
          }

          return {
            sourceType: "SOUNDCLOUD",
            sourceId: track.id ? String(track.id) : null,
            title: truncate(track.title, 300) ?? track.title,
            artist: truncate(track.user?.username, 200),
            album: null,
            description: null,
            durationSeconds: track.duration ? Math.round(track.duration / 1000) : 0,
            thumbnailUrl: track.artwork_url ?? null,
            embedUrl: buildSoundCloudEmbedUrl(track.permalink_url ?? canonicalUrl),
            sourceUrl: track.permalink_url ?? canonicalUrl,
            streamUrl: null,
            playbackType: "EMBED",
            provider: "SoundCloud API (api.soundcloud.com)",
            warnings: [...warnings, "Thông tin lấy từ SoundCloud API chính thức."],
            genre: truncate(track.genre, 100),
            tags: track.tag_list
              ? track.tag_list
                  .split(/\s+/)
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .slice(0, 10)
              : [],
          };
        }
      } catch (error) {
        warnings.push(
          `Không gọi được SoundCloud API (${error instanceof Error ? error.message : "lỗi không rõ"}), đang dùng phương án dự phòng.`,
        );
      }
    }

    // --- Uu tien 2: the meta Open Graph cua trang bai nhac ---
    let pageInfo: ReturnType<typeof parseSoundCloudTrackPage> | null = null;

    try {
      const html = await fetchTextSafely(canonicalUrl, {
        timeoutMs: context.timeoutMs,
        hostAllowlist: ["soundcloud.com"],
      });
      pageInfo = parseSoundCloudTrackPage(html);
    } catch (error) {
      warnings.push(
        `Không tải được trang bài nhạc: ${error instanceof Error ? error.message : "lỗi không rõ"}.`,
      );
    }

    if (!pageInfo?.title) {
      throw new MetadataUnavailableError(
        "Không tìm thấy bài nhạc này trên SoundCloud. Hãy kiểm tra lại đường dẫn — bài nhạc có thể đã bị xoá, đổi link hoặc đang ở chế độ riêng tư.",
      );
    }

    if (!context.soundcloudClientId) {
      // Khong bat buoc phai co API key: he thong doc thong tin cong khai cua trang
      // bai nhac va bo sung thoi luong qua Widget API chinh thuc ngay tren trinh duyet.
      // Vi vay khong hien thi canh bao gay hieu nham la thieu cau hinh.
    }

    if (isPlaylistUrl(url)) {
      warnings.push("Đây là đường dẫn playlist/set; trình phát sẽ nhúng cả danh sách của SoundCloud.");
    }

    return {
      sourceType: "SOUNDCLOUD",
      sourceId: null,
      title: truncate(pageInfo.title, 300) ?? pageInfo.title,
      artist: truncate(pageInfo.artist, 200),
      album: null,
      description: pageInfo.description,
      durationSeconds: pageInfo.durationSeconds,
      thumbnailUrl: pageInfo.thumbnailUrl,
      embedUrl: buildSoundCloudEmbedUrl(canonicalUrl),
      sourceUrl: canonicalUrl,
      streamUrl: null,
      playbackType: "EMBED",
      provider: "SoundCloud (Open Graph + Widget API)",
      warnings,
      genre: truncate(pageInfo.genre, 100),
      tags: [],
    };
  },
};
