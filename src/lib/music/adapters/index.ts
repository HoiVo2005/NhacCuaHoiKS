import type { ResolvedMetadata, SourceType } from "@/types";

import { detectSourceType } from "../detect";
import { assertAllowedHost, parseHttpUrl, truncate } from "../http";
import { AdapterError, MetadataUnavailableError, type AdapterContext, type SourceAdapter } from "../types";
import { soundcloudAdapter } from "./soundcloud";
import { tiktokAdapter } from "./tiktok";
import { youtubeAdapter } from "./youtube";

export const sourceAdapters: SourceAdapter[] = [youtubeAdapter, soundcloudAdapter, tiktokAdapter];

export function findAdapter(url: URL): SourceAdapter | null {
  return sourceAdapters.find((adapter) => adapter.supports(url)) ?? null;
}

export function getAdapterByType(type: SourceType): SourceAdapter | null {
  return sourceAdapters.find((adapter) => adapter.type === type) ?? null;
}

export function defaultMetadataTimeoutMs(): number {
  const parsed = Number(process.env.METADATA_TIMEOUT_MS ?? 8000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
}

/**
 * Phan giai metadata cho mot duong dan do quan tri vien dan vao.
 * Chi ho tro 3 nen tang co oEmbed/API chinh thuc. Khong boc DRM, khong tai file trai phep.
 */
export async function resolveMetadataFromUrl(
  rawUrl: string,
  context: Partial<AdapterContext> = {},
): Promise<ResolvedMetadata> {
  const input = (rawUrl ?? "").trim();

  if (!input) {
    throw new AdapterError("Vui lòng nhập đường dẫn bài nhạc.", "EMPTY_URL");
  }

  if (input.startsWith("/")) {
    throw new AdapterError(
      "Với file đã tải lên hệ thống, hãy dùng mục \"Tải file lên\" thay vì dán đường dẫn.",
      "UPLOAD_REQUIRED",
    );
  }

  const url = parseHttpUrl(input);
  assertAllowedHost(url);

  const sourceType = detectSourceType(url);
  const adapter = sourceType ? getAdapterByType(sourceType) : null;

  if (!adapter) {
    throw new MetadataUnavailableError(
      "Chỉ hỗ trợ YouTube, SoundCloud và TikTok. Với nguồn khác, vui lòng tải file nhạc lên hệ thống.",
    );
  }

  if (!adapter.supports(url)) {
    throw new MetadataUnavailableError(
      `Đường dẫn chưa đúng dạng mà ${adapter.label} hỗ trợ. Hãy kiểm tra lại.`,
    );
  }

  const resolved = await adapter.resolve(url, {
    timeoutMs: context.timeoutMs ?? defaultMetadataTimeoutMs(),
    youtubeApiKey: context.youtubeApiKey ?? process.env.YOUTUBE_API_KEY,
    soundcloudClientId: context.soundcloudClientId ?? process.env.SOUNDCLOUD_CLIENT_ID,
    origin: context.origin,
  });

  return {
    ...resolved,
    title: truncate(resolved.title, 300) ?? resolved.title,
  };
}
