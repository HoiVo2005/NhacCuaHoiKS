import type { SourceType } from "@/types";

/** Nhan dien nen tang dua tren ten mien */
export function detectSourceType(url: URL): SourceType | null {
  const host = url.hostname.toLowerCase();

  if (
    host === "youtu.be" ||
    host.endsWith("youtube.com") ||
    host.endsWith("youtube-nocookie.com")
  ) {
    return "YOUTUBE";
  }

  if (host.endsWith("soundcloud.com")) {
    return "SOUNDCLOUD";
  }

  if (host.endsWith("tiktok.com")) {
    return "TIKTOK";
  }

  return null;
}

/** Lay videoId tu moi dang URL YouTube pho bien */
export function extractYouTubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/+$/, "");

  if (host === "youtu.be") {
    const id = path.split("/").filter(Boolean)[0];
    return id && isValidYouTubeId(id) ? id : null;
  }

  const queryId = url.searchParams.get("v");
  if (queryId && isValidYouTubeId(queryId)) return queryId;

  const segments = path.split("/").filter(Boolean);
  const keywordIndex = segments.findIndex((segment) =>
    ["embed", "shorts", "live", "v"].includes(segment),
  );

  if (keywordIndex >= 0 && segments[keywordIndex + 1]) {
    const id = segments[keywordIndex + 1];
    return isValidYouTubeId(id) ? id : null;
  }

  return null;
}

function isValidYouTubeId(value: string): boolean {
  return /^[A-Za-z0-9_-]{6,20}$/.test(value);
}

/** Lay postId cua TikTok: /@user/video/123 hoac /player/v1/123 */
export function extractTikTokPostId(url: URL): string | null {
  const segments = url.pathname.split("/").filter(Boolean);

  const videoIndex = segments.indexOf("video");
  if (videoIndex >= 0 && segments[videoIndex + 1]) {
    const id = segments[videoIndex + 1];
    if (/^\d{6,25}$/.test(id)) return id;
  }

  const playerIndex = segments.lastIndexOf("v1");
  if (playerIndex >= 0 && segments[playerIndex + 1]) {
    const id = segments[playerIndex + 1];
    if (/^\d{6,25}$/.test(id)) return id;
  }

  return null;
}

export function buildYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

/*
 * Bia YouTube da chuyen sang `src/lib/music/thumbnails.ts` (luon lay ban net nhat + tu ha cap
 * khi ban net nhat khong ton tai). Xem `buildYouTubeThumbnailUrl` / `thumbnailFallbackUrls`.
 */

export function buildSoundCloudEmbedUrl(trackUrl: string): string {
  const params = new URLSearchParams({
    url: trackUrl,
    color: "#3a80f6",
    auto_play: "false",
    hide_related: "true",
    show_comments: "false",
    show_user: "true",
    show_reposts: "false",
    show_teaser: "false",
    visual: "true",
  });

  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

export function buildTikTokEmbedUrl(postId: string): string {
  const params = new URLSearchParams({
    autoplay: "0",
    loop: "0",
    controls: "1",
    progress_bar: "1",
    play_button: "0",
    volume_control: "0",
    fullscreen_button: "1",
    timestamp: "1",
    music_info: "0",
    description: "0",
    rel: "0",
    native_context_menu: "0",
  });

  return `https://www.tiktok.com/player/v1/${postId}?${params.toString()}`;
}
