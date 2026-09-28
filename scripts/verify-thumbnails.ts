import "dotenv/config";

import { readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/db/prisma";
import { toPlaylistDTO, toSongDTO, type PlaylistRow, type SongRow } from "@/lib/mappers";
import {
  buildYouTubeThumbnailUrl,
  parseYouTubeThumbnailUrl,
  pickBestYouTubeApiThumbnail,
  thumbnailFallbackUrls,
  upgradeThumbnailUrl,
  YOUTUBE_THUMBNAIL_QUALITIES,
} from "@/lib/music/thumbnails";

/**
 * Kiem chung "anh bia net": npx tsx scripts/verify-thumbnails.ts
 *
 * Loi da tung gap: moi bai YouTube luu `hqdefault.jpg` (480x360, khung 4:3 co vien den) nen khi hien
 * thi o khung vuong / khung lon, anh bi keo gian -> MO. Script nay khoa lai:
 *  1. Luat nang cap URL (thuan JS): YouTube -> `maxresdefault` (1280x720), SoundCloud -> 500x500,
 *     URL khac (file tai len, TikTok) giu nguyen.
 *  2. Chuoi du phong: net truoc - mo sau, khong trung lap, van con `hqdefault` lam phuong an cuoi
 *     (YouTube luon co co nay) -> khong bao gio mat anh.
 *  3. Tang DTO (`src/lib/mappers.ts`) da nang cap -> bai CU trong CSDL cung hien ban net, khong can migrate.
 *  4. Cac manh ghep UI: moi cho hien bia deu dung `<Artwork>` (tu ha cap khi anh loi), khong con `<img>` tho.
 *  5. CSDL + mang: bai YouTube that su co ban net hon `hqdefault` (kiem tra bang HEAD; mat mang thi SKIP).
 */

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

function skip(label: string, detail = ""): void {
  results.push(`SKIP | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

/* ---------------------------- 1. Nang cap URL anh bia ---------------------------- */

const VIDEO_ID = "dQw4w9WgXcQ";
const sharpYouTube = `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`;
const mediumYouTube = `https://i.ytimg.com/vi/${VIDEO_ID}/sddefault.jpg`;
const hqYouTube = `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`;

const soundcloudSmall = "https://i1.sndcdn.com/artworks-jzEqFvyxStTMifDj-DMtQhA-t120x120.jpg";
const soundcloudSharp = "https://i1.sndcdn.com/artworks-jzEqFvyxStTMifDj-DMtQhA-t500x500.jpg";
const uploadedImage = "/api/files/images/2026/09/abc-cover.png";
const tiktokImage = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcAbC&s=10";

check(
  "Ham tao URL bia YouTube mac dinh la ban net nhat (maxresdefault 1280x720)",
  buildYouTubeThumbnailUrl(VIDEO_ID) === sharpYouTube,
);
check(
  "Nang cap bia YouTube hqdefault -> maxresdefault",
  upgradeThumbnailUrl(hqYouTube) === sharpYouTube,
  String(upgradeThumbnailUrl(hqYouTube)),
);
check(
  "Nang cap URL YouTube co tham so truy van (?sqp=... van nhan dang duoc)",
  upgradeThumbnailUrl(`${hqYouTube}?sqp=abc123&rs=AOn4CL`) === sharpYouTube,
);
check(
  "Nhan dang duoc ca dang _webp cua YouTube",
  parseYouTubeThumbnailUrl(`https://i.ytimg.com/vi_webp/${VIDEO_ID}/mqdefault.webp`)?.quality ===
    "mqdefault",
);
check(
  "Bia khong phai YouTube (vi du gstatic cua TikTok) giu nguyen",
  upgradeThumbnailUrl(tiktokImage) === tiktokImage,
);
check(
  "URL bia nguon khac duoc giu NGUYEN VEN ca phan query (khong bi cat thanh link hong)",
  thumbnailFallbackUrls(tiktokImage).join(" ") === tiktokImage,
  thumbnailFallbackUrls(tiktokImage).join(" | "),
);
check(
  "Link bia co chu ky/het han (TikTok CDN) khong bi sua doi",
  upgradeThumbnailUrl("https://p16-sign-va.tiktokcdn.com/abc.jpeg?x-expires=123&x-signature=xyz") ===
    "https://p16-sign-va.tiktokcdn.com/abc.jpeg?x-expires=123&x-signature=xyz",
);
check("Anh tai len noi bo giu nguyen", upgradeThumbnailUrl(uploadedImage) === uploadedImage);
check("Khong co URL -> null (khong tao URL rac)", upgradeThumbnailUrl(null) === null);
check("URL rong -> null", upgradeThumbnailUrl("   ") === null);
check(
  "Bia SoundCloud co nho (-t120x120) -> 500x500",
  upgradeThumbnailUrl(soundcloudSmall) === soundcloudSharp,
  String(upgradeThumbnailUrl(soundcloudSmall)),
);
check(
  "Bia SoundCloud ban goc (-original) duoc giu nguyen (da net nhat)",
  upgradeThumbnailUrl("https://i1.sndcdn.com/artworks-abc-def-original.jpg") ===
    "https://i1.sndcdn.com/artworks-abc-def-original.jpg",
);
check(
  "Bia SoundCloud da 500x500 thi khong doi",
  upgradeThumbnailUrl(soundcloudSharp) === soundcloudSharp,
);

/* ------------------------------ 2. Chuoi du phong ------------------------------ */

const chain = thumbnailFallbackUrls(hqYouTube);

check(
  "Chuoi du phong bat dau bang ban net nhat va di tu net -> mo",
  chain.join(" ") === [sharpYouTube, mediumYouTube, hqYouTube].join(" "),
  chain.join(" | "),
);
check("Chuoi du phong khong lap lai URL nao", new Set(chain).size === chain.length);
check(
  "Chuoi du phong cua bai luu co la (mqdefault) van co hqdefault lam phuong an cuoi",
  thumbnailFallbackUrls(`https://i.ytimg.com/vi/${VIDEO_ID}/mqdefault.jpg`).includes(hqYouTube),
);
check(
  "Moi co trong chuoi deu la co that cua YouTube",
  YOUTUBE_THUMBNAIL_QUALITIES.every((quality) => chain.some((url) => url.endsWith(`${quality}.jpg`))),
);
check(
  "Chuoi du phong SoundCloud: 500x500 truoc, URL goc sau (khong bao gio mat anh)",
  thumbnailFallbackUrls(soundcloudSmall).join(" ") === `${soundcloudSharp} ${soundcloudSmall}`,
);
check(
  "Khong co URL -> chuoi rong (component hien khung ♪)",
  thumbnailFallbackUrls(null).length === 0,
);

/* --------------------- 3. Chon bia tu YouTube Data API --------------------- */

check(
  "Data API: uu tien maxres khi video co",
  pickBestYouTubeApiThumbnail({
    default: { url: "d.jpg" },
    high: { url: "h.jpg" },
    maxres: { url: "m.jpg" },
  }) === "m.jpg",
);
check(
  "Data API: thieu maxres thi lay standard roi moi den high",
  pickBestYouTubeApiThumbnail({ high: { url: "h.jpg" }, standard: { url: "s.jpg" } }) === "s.jpg",
);
check("Data API: khong co du lieu -> null", pickBestYouTubeApiThumbnail(undefined) === null);

/* ------------------------- 4. Tang DTO + manh ghep UI ------------------------- */

/** Ban ghi Song gia de kiem tra mapper (khong can CSDL) */
function fakeSongRow(thumbnailUrl: string | null): SongRow {
  return {
    id: "song-test",
    title: "Bài thử",
    artist: "Ca sĩ thử",
    album: null,
    description: null,
    durationSeconds: 200,
    thumbnailUrl,
    sourceType: "YOUTUBE",
    sourceId: VIDEO_ID,
    sourceUrl: null,
    streamUrl: null,
    embedUrl: null,
    playbackType: "EMBED",
    tags: null,
    genreId: null,
    isPublished: true,
    playCount: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: null,
  } as unknown as SongRow;
}

check(
  "DTO bai nhac nang cap bia len ban net nhat (bai cu trong CSDL khong can migrate)",
  toSongDTO(fakeSongRow(hqYouTube)).thumbnailUrl === sharpYouTube,
  String(toSongDTO(fakeSongRow(hqYouTube)).thumbnailUrl),
);
check(
  "DTO bai nhac khong co bia -> null (khong hien anh vo)",
  toSongDTO(fakeSongRow(null)).thumbnailUrl === null,
);
check(
  "DTO playlist cung nang cap bia",
  toPlaylistDTO({
    id: "playlist-test",
    name: "Playlist thử",
    description: null,
    coverUrl: hqYouTube,
    isPublic: false,
    isFeatured: false,
    ownerId: "user-test",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  } as unknown as PlaylistRow).coverUrl === sharpYouTube,
);

const root = process.cwd();

function source(relativePath: string): string {
  return readFileSync(path.join(root, ...relativePath.split("/")), "utf8");
}

const artworkSource = source("src/components/ui/artwork.tsx");
const mapperSource = source("src/lib/mappers.ts");
const youtubeAdapterSource = source("src/lib/music/adapters/youtube.ts");
const detectSource = source("src/lib/music/detect.ts");
const readmeSource = source("README.md");

check(
  "Artwork la client component (can bat su kien onError)",
  artworkSource.startsWith('"use client"'),
);
check(
  "Artwork tu ha cap chat luong khi anh loi",
  artworkSource.includes("onError") && artworkSource.includes("thumbnailFallbackUrls"),
);
check("Artwork co khung ♪ khi het anh", artworkSource.includes("♪"));
check(
  "Mapper nang cap bia bai nhac khi tra DTO",
  mapperSource.includes("thumbnailUrl: upgradeThumbnailUrl(song.thumbnailUrl)"),
);
check(
  "Mapper nang cap bia playlist khi tra DTO",
  mapperSource.includes("coverUrl: upgradeThumbnailUrl(playlist.coverUrl)"),
);
check(
  "Adapter YouTube khong con xin ban hqdefault (mo)",
  !youtubeAdapterSource.includes("hqdefault.jpg"),
);
check(
  "Adapter YouTube nang cap bia tra ve tu oEmbed",
  youtubeAdapterSource.includes("upgradeThumbnailUrl(oEmbed.thumbnail_url)"),
);
check(
  "Adapter YouTube chon bia net nhat tu Data API",
  youtubeAdapterSource.includes("pickBestYouTubeApiThumbnail"),
);
check(
  "Ham tao bia cu trong detect.ts da duoc go (chi con mot noi quyet dinh)",
  !detectSource.includes("function buildYouTubeThumbnail("),
);
check(
  "README ghi lai quy uoc anh bia net",
  readmeSource.includes("maxresdefault") && readmeSource.includes("check:thumbs"),
);

/** Cac cho hien anh bia trong giao dien (phai dung <Artwork>, khong dung <img> tho) */
const ARTWORK_VIEWS = [
  "src/components/layout/topbar.tsx",
  "src/components/admin/admin-songs-table.tsx",
  "src/components/admin/admin-playlist-manager.tsx",
  "src/components/music/song-card.tsx",
  "src/components/music/song-row.tsx",
  "src/components/music/hero-highlight.tsx",
  "src/components/music/playlist-card.tsx",
  "src/components/music/playlist-manager.tsx",
  "src/components/music/playlist-detail-view.tsx",
  "src/components/player/player-bar.tsx",
  "src/components/player/full-player.tsx",
  "src/components/player/queue-panel.tsx",
];

const rawImageFiles = ARTWORK_VIEWS.filter((file) => /<img[\s/>]/.test(source(file)));
check(
  "Moi cho hien bia deu dung <Artwork> (khong con <img> tho)",
  rawImageFiles.length === 0,
  rawImageFiles.join(", "),
);
check(
  "Cac cho hien bia deu da import Artwork",
  ARTWORK_VIEWS.every((file) => source(file).includes('from "@/components/ui/artwork"')),
);

/* ------------------------------ 5. CSDL + mang ------------------------------ */

interface YoutubeSong {
  videoId: string;
  title: string;
}

async function runDatabaseCheck(): Promise<YoutubeSong[]> {
  const youtubeSongs: YoutubeSong[] = [];

  try {
    const rows = await prisma.song.findMany({ take: 200, orderBy: { createdAt: "desc" } });

    const youtubeRows = rows.filter((row) => row.sourceType === "YOUTUBE");
    const staleSharp = youtubeRows.filter(
      (row) => !toSongDTO(row).thumbnailUrl?.endsWith("maxresdefault.jpg"),
    );

    check(
      `Moi bai YouTube trong CSDL deu hien ban net nhat (${youtubeRows.length} bai)`,
      staleSharp.length === 0,
      staleSharp
        .slice(0, 3)
        .map((row) => `${row.title}: ${String(row.thumbnailUrl)}`)
        .join(" ; "),
    );

    /*
     * Bai YouTube khong con ban maxres (video cu / video doc) thi DTO van tro toi maxresdefault,
     * va the <img> tu ha cap -> chuoi du phong phai co it nhat 1 URL that su tai duoc.
     */
    check(
      "Moi bai YouTube deu co chuoi du phong (khong bao gio hien anh vo)",
      youtubeRows.every((row) => thumbnailFallbackUrls(buildYouTubeThumbnailUrl(row.sourceId ?? "")).length >= 3),
    );

    const otherRows = rows.filter((row) => row.sourceType !== "YOUTUBE");
    check(
      "Bai nguon khac (SoundCloud/TikTok/tai len) khong bi doi bia",
      otherRows.every(
        (row) => toSongDTO(row).thumbnailUrl === upgradeThumbnailUrl(row.thumbnailUrl),
      ),
    );

    youtubeSongs.push(
      ...youtubeRows
        .filter((row) => (row.sourceId ?? "").length > 0)
        .slice(0, 6)
        .map((row) => ({ videoId: row.sourceId ?? "", title: row.title })),
    );

    if (youtubeRows.length === 0) {
      skip("Anh bia YouTube that su (khong co bai YouTube nao trong CSDL)");
    }
  } catch (error) {
    skip("Kiem tra anh bia tren CSDL that", error instanceof Error ? error.message : String(error));
  }

  return youtubeSongs;
}

/** Ket qua HEAD mot URL anh; `ok = null` = khong ket luan duoc (mat mang / khong ho tro HEAD) */
interface HeadResult {
  ok: boolean | null;
  bytes: number;
}

async function headAvailable(url: string): Promise<HeadResult> {
  try {
    const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    if (response.status === 405 || response.status === 501) return { ok: null, bytes: 0 };

    return { ok: response.ok, bytes: Number(response.headers.get("content-length") ?? 0) };
  } catch {
    return { ok: null, bytes: 0 };
  }
}

/**
 * Kiem tra that tren i.ytimg.com: chuoi du phong co dung khi ban net nhat khong ton tai
 * (video cu / video doc), va ban net nhat co THAT SU net hon `hqdefault` (dung luong lon hon
 * = nhieu chi tiet hon; day chinh la ly do anh bi mo truoc day). Mat mang thi bao SKIP.
 */
async function runNetworkCheck(videos: YoutubeSong[]): Promise<void> {
  for (const video of videos) {
    const candidates = thumbnailFallbackUrls(buildYouTubeThumbnailUrl(video.videoId));
    const heads: HeadResult[] = [];

    for (const url of candidates) {
      heads.push(await headAvailable(url));
    }

    if (heads.every((result) => result.ok === null)) {
      skip("Anh bia YouTube that su", "khong ket noi duoc toi i.ytimg.com");
      return;
    }

    const detail = candidates
      .map((url, index) => {
        const name = url.split("/").pop() ?? url;
        const state = heads[index].ok === null ? "?" : heads[index].ok ? "200" : "404";
        const size = heads[index].bytes > 0 ? ` ~${Math.round(heads[index].bytes / 1024)}KB` : "";
        return `${name} ${state}${size}`;
      })
      .join(" | ");

    check(
      `Bai "${video.title}" luon co anh tai duoc (chuoi du phong dung)`,
      heads.some((result) => result.ok === true),
      detail,
    );

    const sharp = heads[0];
    const hq = heads[heads.length - 1];

    if (sharp.ok === true && hq.ok === true && sharp.bytes > 0 && hq.bytes > 0) {
      check(
        `Bai "${video.title}": ban net nhat nang hon hqdefault (nhieu chi tiet hon)`,
        sharp.bytes > hq.bytes,
        `net nhat ${sharp.bytes} bytes > hqdefault ${hq.bytes} bytes`,
      );
    }
  }
}

/** In ket qua va dat ma thoat */
function report(): void {
  const failed = results.filter((line) => line.startsWith("FAIL"));
  console.log(results.join("\n"));
  console.log(`\nTONG KET: ${results.length - failed.length} PASS / ${failed.length} FAIL`);
  process.exitCode = failed.length === 0 ? 0 : 1;
}

void (async () => {
  const youtubeSongs = await runDatabaseCheck();
  if (process.env.SKIP_NETWORK !== "1") await runNetworkCheck(youtubeSongs);
  await prisma.$disconnect().catch(() => undefined);
  report();
})();
