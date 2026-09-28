import type { ResolvedMetadata } from "@/types";

import { buildYouTubeEmbedUrl, extractYouTubeId } from "../detect";
import { fetchJsonSafely, fetchTextSafely, parseIsoDurationToSeconds, truncate } from "../http";
import { buildYouTubeThumbnailUrl, pickBestYouTubeApiThumbnail, upgradeThumbnailUrl } from "../thumbnails";
import { MetadataUnavailableError, type AdapterContext, type SourceAdapter } from "../types";

interface YouTubeOEmbedResponse {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  provider_name?: string;
}

interface YouTubeVideoListResponse {
  items?: {
    contentDetails?: { duration?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      description?: string;
      /**
       * Data API tra cac co dang co (khong phai bai nao cung co `maxres`), nen kieu du lieu
       * phai la ban ghi mo de chon duoc ban net nhat bang `pickBestYouTubeApiThumbnail`.
       */
      thumbnails?: Record<string, { url?: string } | undefined>;
    };
  }[];
}

/**
 * Doc thoi luong tu HTML trang xem video (du lieu cong khai, khong can API key).
 * YouTube nhet thoi luong vao ytInitialPlayerResponse dang "lengthSeconds":"214".
 */
export function extractYouTubeDurationFromHtml(html: string): number {
  const lengthMatch = html.match(/"lengthSeconds":"(\d{1,6})"/);
  if (lengthMatch?.[1]) return Number(lengthMatch[1]);

  const approxMatch = html.match(/"approxDurationMs":"(\d{3,})"/);
  if (approxMatch?.[1]) return Math.round(Number(approxMatch[1]) / 1000);

  return 0;
}

function isYouTubeHost(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return (
    host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")
  );
}

/**
 * Adapter YouTube:
 *  - Co che 1 (khong can API key): oEmbed chinh thuc https://www.youtube.com/oembed
 *  - Co che 2 (neu co YOUTUBE_API_KEY): YouTube Data API v3 de lay them thoi luong
 *  - Phat nhac: IFrame Player API chinh thuc (uplayer nguoi dung tuong tac truc tiep)
 */
export const youtubeAdapter: SourceAdapter = {
  type: "YOUTUBE",
  label: "YouTube",

  supports(url) {
    return isYouTubeHost(url) && Boolean(extractYouTubeId(url));
  },

  async resolve(url, context: AdapterContext): Promise<ResolvedMetadata> {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      throw new MetadataUnavailableError(
        "Không nhận diện được mã video YouTube trong đường dẫn này.",
      );
    }

    const warnings: string[] = [];
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

    let title: string | null = null;
    let artist: string | null = null;
    /**
     * Luon bat dau bang ban bia NET NHAT (`maxresdefault` 1280x720).
     * oEmbed chi tra `hqdefault` 480x360 (co vien den 4:3) nen phai NANG CAP chu khong lay nguyen.
     */
    let thumbnailUrl: string | null = buildYouTubeThumbnailUrl(videoId);
    let durationSeconds = 0;

    try {
      const oEmbed = await fetchJsonSafely<YouTubeOEmbedResponse>(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonicalUrl)}`,
        { timeoutMs: context.timeoutMs, hostAllowlist: ["youtube.com", "youtu.be"] },
      );

      title = truncate(oEmbed.title, 300);
      artist = truncate(oEmbed.author_name, 200);
      thumbnailUrl = upgradeThumbnailUrl(oEmbed.thumbnail_url) ?? thumbnailUrl;
    } catch {
      warnings.push(
        "Không lấy được thông tin qua oEmbed (video có thể bị giới hạn hoặc đã bị xoá). Vui lòng nhập tay.",
      );
    }

    if (context.youtubeApiKey) {
      try {
        const apiResponse = await fetchJsonSafely<YouTubeVideoListResponse>(
          `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails,snippet&key=${context.youtubeApiKey}`,
          { timeoutMs: context.timeoutMs, hostAllowlist: ["googleapis.com"] },
        );

        const item = apiResponse.items?.[0];
        if (item) {
          durationSeconds = parseIsoDurationToSeconds(item.contentDetails?.duration);
          title = truncate(item.snippet?.title ?? title, 300);
          artist = truncate(item.snippet?.channelTitle ?? artist, 200);
          // Data API co the co `maxres`/`standard` (net hon `high`) - chon ban net nhat co san
          const apiThumbnail = pickBestYouTubeApiThumbnail(item.snippet?.thumbnails);
          thumbnailUrl = apiThumbnail ?? thumbnailUrl;
        }
      } catch {
        warnings.push("Không lấy được thời lượng từ YouTube Data API, đang dùng phương án dự phòng.");
      }
    }

    // Khong can API key: doc thoi luong cong khai tu chinh trang xem video
    if (durationSeconds === 0) {
      try {
        const watchHtml = await fetchTextSafely(canonicalUrl, {
          timeoutMs: context.timeoutMs,
          hostAllowlist: ["youtube.com", "youtu.be"],
        });
        durationSeconds = extractYouTubeDurationFromHtml(watchHtml);
      } catch {
        // bo qua: thoi luong se duoc cap nhat chinh xac khi bai nhac duoc phat lan dau
      }
    }

    if (durationSeconds === 0) {
      warnings.push(
        "Chưa đọc được thời lượng video — hệ thống sẽ tự cập nhật khi bài nhạc được phát lần đầu.",
      );
    }

    if (!title) {
      title = `Video YouTube ${videoId}`;
      warnings.push("Cần kiểm tra lại tên bài nhạc do nền tảng không trả về tiêu đề.");
    }

    return {
      sourceType: "YOUTUBE",
      sourceId: videoId,
      title,
      artist,
      album: null,
      durationSeconds,
      thumbnailUrl,
      embedUrl: buildYouTubeEmbedUrl(videoId),
      sourceUrl: canonicalUrl,
      streamUrl: null,
      playbackType: "EMBED",
      provider: "YouTube (oEmbed/IFrame API)",
      warnings,
    };
  },
};
