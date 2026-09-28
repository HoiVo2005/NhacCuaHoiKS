import type { ResolvedMetadata } from "@/types";

import { buildTikTokEmbedUrl, extractTikTokPostId } from "../detect";
import { fetchJsonSafely, truncate } from "../http";
import { MetadataUnavailableError, type AdapterContext, type SourceAdapter } from "../types";

interface TikTokOEmbedResponse {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  html?: string;
}

function extractPostIdFromHtml(html: string | undefined): string | null {
  if (!html) return null;
  const match = html.match(/\/(?:player\/v1|embed\/v2)\/(\d{6,25})/);
  return match?.[1] ?? null;
}

/**
 * Adapter TikTok:
 *  - Metadata: oEmbed chinh thuc https://www.tiktok.com/oembed
 *  - Phat nhac: TikTok Embed Player chinh thuc www.tiktok.com/player/v1/{postId}
 *    co the dieu khien bang postMessage (play / pause / seekTo / mute / unMute)
 *
 * Han che that cua nen tang (duoc hien thi ro trong UI):
 *  - Khong ho tro chinh am luong theo muc (chi mute/unmute)
 *  - Khong lay duoc thoi luong qua oEmbed (se cap nhat khi phat)
 */
export const tiktokAdapter: SourceAdapter = {
  type: "TIKTOK",
  label: "TikTok",

  supports(url) {
    return url.hostname.toLowerCase().endsWith("tiktok.com");
  },

  async resolve(url, context: AdapterContext): Promise<ResolvedMetadata> {
    const warnings: string[] = [];
    let postId = extractTikTokPostId(url);

    let title: string | null = null;
    let artist: string | null = null;
    let thumbnailUrl: string | null = null;

    const canonicalUrl = postId
      ? url.toString().split("?")[0]
      : url.toString().split("?")[0];

    try {
      const oEmbed = await fetchJsonSafely<TikTokOEmbedResponse>(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonicalUrl)}`,
        { timeoutMs: context.timeoutMs, hostAllowlist: ["tiktok.com"] },
      );

      title = truncate(oEmbed.title, 300);
      artist = truncate(oEmbed.author_name?.replace(/^@/, ""), 200);
      thumbnailUrl = oEmbed.thumbnail_url ?? null;

      if (!postId) {
        postId = extractPostIdFromHtml(oEmbed.html);
      }
    } catch {
      warnings.push(
        "Không lấy được metadata TikTok (video có thể ở chế độ riêng tư, đã bị xoá hoặc bị chặn theo khu vực). Vui lòng nhập tay.",
      );
    }

    if (!postId) {
      throw new MetadataUnavailableError(
        "Không nhận diện được mã video TikTok. Hãy dán đường dẫn đầy đủ dạng https://www.tiktok.com/@tac-gia/video/1234567890123456789 (không dùng link rút gọn).",
      );
    }

    if (!title) {
      title = `Video TikTok ${postId}`;
      warnings.push("Cần kiểm tra lại tên bài nhạc (TikTok không trả về tiêu đề).");
    }

    warnings.push(
      "TikTok Embed Player không hỗ trợ chỉnh âm lượng theo mức (chỉ bật/tắt tiếng); thời lượng được cập nhật khi phát.",
    );

    return {
      sourceType: "TIKTOK",
      sourceId: postId,
      title,
      artist,
      album: null,
      durationSeconds: 0,
      thumbnailUrl,
      embedUrl: buildTikTokEmbedUrl(postId),
      sourceUrl: canonicalUrl,
      streamUrl: null,
      playbackType: "EMBED",
      provider: "TikTok (oEmbed/Embed Player)",
      warnings,
    };
  },
};
