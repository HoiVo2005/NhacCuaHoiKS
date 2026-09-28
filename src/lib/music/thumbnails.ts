/**
 * Anh bia (thumbnail) cua bai nhac - noi DUY NHAT quyet dinh dung ban anh nao.
 *
 * Van de da gap: bai YouTube duoc luu `hqdefault.jpg` (480x360, lai la khung 4:3 co vien den)
 * nen khi hien thi o khung vuong / khung lon, anh bi keo gian -> trong MO. YouTube luon co ban
 * `maxresdefault.jpg` (1280x720, dung 16:9) cho video dang 16:9; video cu / video doc thi chi con
 * `sddefault` (640x480) hoac `hqdefault` (480x360).
 *
 * Vi vay luat o day:
 *  1. LUON xin ban net nhat (`SHARP_YOUTUBE_QUALITY`).
 *  2. Neu ban net nhat khong ton tai (YouTube tra 404), the `<img>` se tu tut xuong ban thap hon
 *     theo `thumbnailFallbackUrls` -> khong bao gio mat anh, chi doi chat luong.
 *  3. URL da luu trong CSDL duoc NANG CAP luc tra ve DTO (`upgradeThumbnailUrl` trong
 *     `src/lib/mappers.ts`) nen khong can migrate du lieu cu.
 */

/** Ban net nhat cho video 16:9: 1280x720 (khong vien den) */
export const SHARP_YOUTUBE_QUALITY = "maxresdefault";

/**
 * Thu tu chat luong cua YouTube, net nhat truoc.
 * `sddefault`/`hqdefault` la khung 4:3 co vien den -> chi dung khi ban net hon khong ton tai.
 */
export const YOUTUBE_THUMBNAIL_QUALITIES = ["maxresdefault", "sddefault", "hqdefault"] as const;

export type YouTubeThumbnailQuality = (typeof YOUTUBE_THUMBNAIL_QUALITIES)[number];

/** Ban net nhat SoundCloud cung cap cho bia: 500x500 */
export const SHARP_SOUNDCLOUD_ARTWORK_SIZE = "t500x500";

/** Chuoi cac co anh MA SoundCloud co the tra ve (`-t500x500`, `-large`, `-original`...) */
const SOUNDCLOUD_ARTWORK_PATTERN =
  /^(https?:\/\/[\w.-]*sndcdn\.com\/[^?#]+?)-(t\d+x\d+|original|large|small|tiny|mini|badge)\.(jpe?g|png|webp)$/i;

/**
 * URL bia cua YouTube: `i.ytimg.com/vi/<videoId>/<quality>.jpg` (hoac `img.youtube.com`,
 * ban `_webp`). Phan truy van (`?sqp=...`) bi bo qua khi nhan dang.
 */
const YOUTUBE_THUMBNAIL_PATTERN =
  /^https?:\/\/(?:[\w-]+\.)*(?:ytimg\.com|youtube\.com)(?::\d+)?\/vi(?:_webp)?\/([A-Za-z0-9_-]{6,20})\/([a-z0-9]+)\.(jpe?g|png|webp)$/i;

export interface YouTubeThumbnailRef {
  videoId: string;
  /** Chat luong ghi trong URL (`maxresdefault`, `hqdefault`, `mqdefault`...) */
  quality: string;
}

/** Bo phan truy van/gom phan tu - CHI dung cho URL YouTube (ID + co nam trong duong dan, khong phu
 * thuoc query). URL cua nguon khac (TikTok `?x-expires=...`, gstatic `?q=tbn:...`) phai giu nguyen. */
function stripQuery(url: string): string {
  return url.split("#")[0].split("?")[0].trim();
}

/** Them URL vao cuoi danh sach neu chua co (giu nguyen thu tu uu tien) */
function appendUnique(urls: string[], url: string): string[] {
  if (!urls.some((candidate) => candidate.toLowerCase() === url.toLowerCase())) urls.push(url);
  return urls;
}

/** URL bia YouTube theo chat luong mong muon (mac dinh: ban net nhat) */
export function buildYouTubeThumbnailUrl(
  videoId: string,
  quality: YouTubeThumbnailQuality = SHARP_YOUTUBE_QUALITY,
): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

/** Nhan dang URL bia YouTube; tra ve null khi khong phai URL bia YouTube */
export function parseYouTubeThumbnailUrl(url: string | null | undefined): YouTubeThumbnailRef | null {
  const clean = stripQuery(url ?? "");
  if (!clean) return null;

  const match = clean.match(YOUTUBE_THUMBNAIL_PATTERN);
  if (!match) return null;

  return { videoId: match[1], quality: match[2].toLowerCase() };
}

/**
 * Nang cap bia SoundCloud len 500x500.
 *
 * URL goc dang `...artworks-<id>-<hash>-t120x120.jpg` (nhieu bai cu chi co co nho) nen doi sang
 * `-t500x500`; rieng `-original` (ban goc) giu nguyen vi da net nhat.
 */
export function upgradeSoundCloudArtworkUrl(url: string): string {
  const match = url.match(SOUNDCLOUD_ARTWORK_PATTERN);
  if (!match) return url;

  const [, base, size, extension] = match;
  if (size.toLowerCase() === "original") return url;

  return `${base}-${SHARP_SOUNDCLOUD_ARTWORK_SIZE}.${extension}`;
}

/**
 * Danh sach URL anh nen thu theo thu tu (phan tu dau la ban net nhat).
 *
 * Dung cho the `<img>`: anh dau tien tai loi (video cu khong co `maxresdefault`) thi thu tiep
 * phan tu sau. URL khong thuoc YouTube/SoundCloud (file tai len, TikTok...) giu nguyen.
 */
export function thumbnailFallbackUrls(url: string | null | undefined): string[] {
  // LUU Y: khong cat query ngay tu dau - URL cua TikTok/gstatic va link co chu ky phai giu NGUYEN VEN.
  const raw = (url ?? "").trim();
  if (!raw) return [];

  const youtube = parseYouTubeThumbnailUrl(raw);
  if (youtube) {
    const urls = YOUTUBE_THUMBNAIL_QUALITIES.map((quality) =>
      buildYouTubeThumbnailUrl(youtube.videoId, quality),
    );
    // URL goc co the la co khac (mqdefault / default / ban _webp) -> them lam phuong an cuoi
    return appendUnique(urls, stripQuery(raw));
  }

  const soundcloud = upgradeSoundCloudArtworkUrl(raw);
  if (soundcloud !== raw) return appendUnique([soundcloud], raw);

  return [raw];
}

/**
 * Ban net nhat cho URL dang co (dung khi tra DTO / luu CSDL).
 * URL khong nhan dang duoc tra ve nguyen ven; URL rong tra ve null.
 */
export function upgradeThumbnailUrl(url: string | null | undefined): string | null {
  return thumbnailFallbackUrls(url)[0] ?? null;
}

/** Thu tu uu tien trong `snippet.thumbnails` cua YouTube Data API (net nhat truoc) */
export const YOUTUBE_API_THUMBNAIL_ORDER = ["maxres", "standard", "high", "medium", "default"] as const;

/**
 * Chon bia net nhat tu `snippet.thumbnails` cua YouTube Data API.
 * API chi tra nhung co dang co, nen phai duyet theo thu tu thay vi lay dai `high`.
 */
export function pickBestYouTubeApiThumbnail(
  thumbnails: Record<string, { url?: string } | undefined> | undefined,
): string | null {
  if (!thumbnails) return null;

  for (const key of YOUTUBE_API_THUMBNAIL_ORDER) {
    const url = thumbnails[key]?.url;
    if (url) return url;
  }

  return null;
}
