import { readFileSync } from "node:fs";
import path from "node:path";

import {
  MEDIA_SESSION_ACTIONS,
  MEDIA_SESSION_POSITION_REFRESH_MS,
  MEDIA_SESSION_SEEK_STEP_SECONDS,
  mediaArtworkFor,
  mediaPositionStateFor,
  mediaSessionActionsFor,
  mediaSessionInfoFor,
  shouldRefreshMediaPosition,
} from "@/lib/media-session";
import {
  enableBackgroundAudioSession,
  supportsBackgroundAudioSession,
  type AudioSessionType,
} from "@/lib/audio-session";
import type { SongDTO, SourceType } from "@/types";

/**
 * Kiem chung "dieu khien tu khoa man hinh / tai nghe" (Media Session API):
 * npx tsx scripts/verify-media-session.ts
 *
 * Vi sao can khoa lai:
 *  1. `navigator.mediaSession.setPositionState()` NEM LOI khi duration <= 0 hoac position > duration
 *     (xay ra ngay khi bai vua nap, luc chua biet thoi luong) -> phai kiem tra truoc khi goi API.
 *  2. Anh bia tren man hinh khoa hien rat lon -> phai dung ban NET NHAT (maxresdefault), khong dung
 *     ban 480x360 nhu truoc day.
 *  3. Nguon khong tua duoc thi khong duoc dang ky nut tua (nut bam vao khong co tac dung).
 */

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

/** Bai nhac gia (khong can CSDL) */
function fakeSong(overrides: Partial<SongDTO> = {}): SongDTO {
  return {
    id: "song-media",
    title: "Bài thử",
    artist: "Ca sĩ thử",
    album: null,
    description: null,
    durationSeconds: 240,
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    sourceType: "YOUTUBE",
    sourceId: "dQw4w9WgXcQ",
    sourceUrl: null,
    streamUrl: null,
    embedUrl: null,
    playbackType: "EMBED",
    tags: [],
    genreId: null,
    genre: null,
    isPublished: true,
    playCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: null,
    ...overrides,
  };
}

/* --------------------- 1. Thong tin hien tren man hinh khoa --------------------- */

const youtubeInfo = mediaSessionInfoFor(fakeSong());

check("Tieu de bai lay dung ten bai", youtubeInfo.title === "Bài thử");
check("Nghe si lay dung", youtubeInfo.artist === "Ca sĩ thử");
check(
  "Khong ro nghe si -> hien \"Không rõ nghệ sĩ\" (khong de trong)",
  mediaSessionInfoFor(fakeSong({ artist: null })).artist === "Không rõ nghệ sĩ",
);
check(
  "Khong co album -> lay ten he thong lam nhan nhan dien",
  mediaSessionInfoFor(fakeSong({ album: null })).album.length > 0,
);
check("Co album thi uu tien album", mediaSessionInfoFor(fakeSong({ album: "Album thử" })).album === "Album thử");
check(
  "Anh bia dung ban NET NHAT (maxresdefault 1280x720), khong dung ban 480x360",
  youtubeInfo.artwork[0]?.src === "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg" &&
    youtubeInfo.artwork[0]?.sizes === "1280x720",
  String(youtubeInfo.artwork[0]?.src),
);
check("Khai bao dung kieu anh cho man hinh khoa", youtubeInfo.artwork[0]?.type === "image/jpeg");

const soundcloudArtwork = mediaArtworkFor(
  fakeSong({
    sourceType: "SOUNDCLOUD",
    thumbnailUrl: "https://i1.sndcdn.com/artworks-abc-def-t120x120.png",
  }),
);
check(
  "Bia SoundCloud: nang len 500x500 va giu kieu PNG",
  soundcloudArtwork[0]?.src === "https://i1.sndcdn.com/artworks-abc-def-t500x500.png" &&
    soundcloudArtwork[0]?.sizes === "500x500",
);
check(
  "Bai khong co bia -> khong khai bao artwork nao",
  mediaArtworkFor(fakeSong({ thumbnailUrl: null })).length === 0,
);

/* --------------------------- 2. Nut tren man hinh khoa --------------------------- */

check("Moi lan bam nut tua la 10 giay", MEDIA_SESSION_SEEK_STEP_SECONDS === 10);
check(
  "Danh sach hanh dong duoc dang ky day du (play/pause/truoc/sau/tua/dung)",
  MEDIA_SESSION_ACTIONS.length === 8 &&
    ["play", "pause", "previoustrack", "nexttrack", "seekbackward", "seekforward", "seekto", "stop"].every(
      (action) => MEDIA_SESSION_ACTIONS.includes(action as (typeof MEDIA_SESSION_ACTIONS)[number]),
    ),
);
check(
  "Nguon tua duoc (YouTube) -> co nut tua tren man hinh khoa",
  ["seekbackward", "seekforward", "seekto"].every((action) =>
    mediaSessionActionsFor("YOUTUBE").includes(action as (typeof MEDIA_SESSION_ACTIONS)[number]),
  ),
);
check("Nguon tua duoc (file tai len) cung co nut tua", mediaSessionActionsFor("UPLOADED").includes("seekto"));
check(
  "Nguon khong tua duoc -> KHONG hien nut tua (khong de nut vo tac dung)",
  !mediaSessionActionsFor("SPOTIFY" as SourceType).includes("seekto") &&
    mediaSessionActionsFor("SPOTIFY" as SourceType).includes("nexttrack"),
);
check("Chua biet nguon (chua co bai) -> chi co nut co ban", !mediaSessionActionsFor(null).includes("seekto"));

/* ------------------------- 3. Thanh keo thoi gian ------------------------- */

check(
  "Chua biet thoi luong -> KHONG goi API (tranh loi setPositionState)",
  mediaPositionStateFor({ durationSeconds: 0, positionSeconds: 10 }) === null,
);
check(
  "Thoi luong khong hop le (NaN) -> null",
  mediaPositionStateFor({ durationSeconds: Number.NaN, positionSeconds: 10 }) === null,
);
check(
  "Toc do phat sai (<= 0) -> null",
  mediaPositionStateFor({ durationSeconds: 240, positionSeconds: 10, playbackRate: 0 }) === null,
);
check(
  "Vi tri vuot qua thoi luong -> kep lai trong khoang hop le",
  mediaPositionStateFor({ durationSeconds: 240, positionSeconds: 999 })?.position === 240,
);
check(
  "Vi tri am -> dua ve 0",
  mediaPositionStateFor({ durationSeconds: 240, positionSeconds: -5 })?.position === 0,
);
check(
  "Vi tri hop le -> giu nguyen kem toc do phat 1x",
  JSON.stringify(mediaPositionStateFor({ durationSeconds: 240, positionSeconds: 42.5 })) ===
    JSON.stringify({ duration: 240, position: 42.5, playbackRate: 1 }),
);

/* ------------------------ 5. Cac manh ghep trong ung dung ------------------------ */

const root = process.cwd();

function source(relativePath: string): string {
  return readFileSync(path.join(root, ...relativePath.split("/")), "utf8");
}

const bridgeSource = source("src/components/player/media-session-bridge.tsx");
const libSource = source("src/lib/media-session.ts");
const layoutSource = source("src/app/layout.tsx");
const readmeSource = source("README.md");

check(
  "Cau noi kiem tra API co ton tai truoc khi dung (HTTP thuong / trinh duyet cu)",
  bridgeSource.includes("navigator as Navigator & { mediaSession?: MediaSessionLike }") &&
    bridgeSource.includes("if (!session) return;"),
);
check(
  "Thong tin bai nhac duoc day len man hinh khoa khi doi bai",
  bridgeSource.includes("mediaSessionInfoFor(current)") && bridgeSource.includes("session.metadata ="),
);
check(
  "Chi dang ky hanh dong ma nguon phat ho tro (dung PLAYER_CAPABILITIES)",
  bridgeSource.includes("mediaSessionActionsFor(sourceType)") && bridgeSource.includes("supported.has(action)"),
);
check(
  "Moi hanh dong deu duoc bao ve (trinh duyet khong ho tro thi bo qua, khong lam vo trang)",
  (bridgeSource.match(/try \{/g) ?? []).length >= 3,
);
check(
  "Go het handler khi component bi go (khong giu tham chieu den store)",
  bridgeSource.includes("session.setActionHandler(action, null)"),
);
check(
  "Cap nhat trang thai dang phat de man hinh khoa hien dung bieu tuong play/pause",
  bridgeSource.includes('session.playbackState = hasCurrent ? (isPlaying ? "playing" : "paused") : "none"'),
);
check(
  "Thanh keo thoi gian chi cap nhat khi du dieu kien (khong goi API moi lan bao tien do)",
  bridgeSource.includes("shouldRefreshMediaPosition(") && bridgeSource.includes("session.setPositionState(state)"),
);
check(
  "Anh bia lay tu nguon net nhat dung chung (khong tao duong dan bia rieng)",
  libSource.includes("thumbnailFallbackUrls(song.thumbnailUrl)"),
);
check("Cau noi duoc mount mot lan o layout goc", layoutSource.includes("<MediaSessionBridge />"));
check(
  "README ghi lai tinh nang + lenh kiem chung",
  readmeSource.includes("check:media") && readmeSource.includes("màn hình khoá"),
);

/* ------------------------ 4. Nhip cap nhat vi tri ------------------------ */

check("Nhip cap nhat vi tri la 5 giay khi dang phat", MEDIA_SESSION_POSITION_REFRESH_MS === 5_000);
check(
  "Vi tri khong doi -> khong cap nhat",
  !shouldRefreshMediaPosition({
    isPlaying: true,
    positionSeconds: 42.2,
    lastSeconds: 42,
    lastAt: 0,
    now: 10_000,
  }),
);
check(
  "Dang phat, chua du 5 giay -> khong cap nhat (tiet kiem CPU)",
  !shouldRefreshMediaPosition({ isPlaying: true, positionSeconds: 45, lastSeconds: 42, lastAt: 1_000, now: 2_000 }),
);
check(
  "Dang phat, du 5 giay -> cap nhat",
  shouldRefreshMediaPosition({ isPlaying: true, positionSeconds: 48, lastSeconds: 42, lastAt: 1_000, now: 6_500 }),
);
check(
  "Tam dung / vua tua -> cap nhat ngay (man hinh khoa hien dung vi tri)",
  shouldRefreshMediaPosition({ isPlaying: false, positionSeconds: 45, lastSeconds: 42, lastAt: 1_000, now: 1_500 }),
);

/* ------------- 6. Nghe nhac khi app ra nen (iOS Audio Session API) ------------- */

const audioSessionSource = source("src/lib/audio-session.ts");
const audioEngineSource = source("src/components/player/engines/audio-engine.ts");
const engineSource = source("src/components/player/player-engine.tsx");

check(
  "Trinh duyet cu (khong co audioSession) -> bo qua, khong vo trang",
  !supportsBackgroundAudioSession(null) &&
    !supportsBackgroundAudioSession(undefined) &&
    !supportsBackgroundAudioSession({}) &&
    !enableBackgroundAudioSession({}),
);

const audioSessionHost = { audioSession: { type: "auto" as AudioSessionType } };
check(
  "Safari 16.4+: dat type = playback (iOS khong con coi la am thanh nen/ambient)",
  supportsBackgroundAudioSession(audioSessionHost) && enableBackgroundAudioSession(audioSessionHost),
  audioSessionHost.audioSession.type,
);

/* Trinh duyet co API nhung bo qua viec dat gia tri -> khong duoc bao thanh cong gia */
const ignoringHost = { audioSession: { type: "ambient" as AudioSessionType } };
Object.defineProperty(ignoringHost.audioSession, "type", {
  get: () => "ambient",
  set: () => undefined,
  configurable: true,
});
check("Trinh duyet bo qua viec dat type -> tra ve false", !enableBackgroundAudioSession(ignoringHost));

/* Truy cap `navigator.audioSession` nem loi -> khong duoc lam hong trinh phat */
const throwingHost = {
  get audioSession(): { type: AudioSessionType } {
    throw new Error("khong cho doc");
  },
};
check(
  "Trinh duyet nem loi khi truy cap audioSession -> tra ve false (khong lam hong trinh phat)",
  !enableBackgroundAudioSession(throwingHost),
);

check(
  "Dat phien audio TRUOC khi tao do thi am luong va phat file tai len",
  audioEngineSource.includes("applyBackgroundAudioSession();") &&
    audioEngineSource.indexOf("applyBackgroundAudioSession();") <
      audioEngineSource.indexOf("this.ensureGraph();"),
);

check(
  "Trinh phat dat phien audio ngay khi mount (truoc khi AudioContext duoc tao)",
  /applyBackgroundAudioSession\(\);\s*\}, \[\]\);/.test(engineSource) &&
    engineSource.includes('from "@/lib/audio-session"'),
);

check(
  "Moi loi goi API deu duoc bao ve (khong lam vo trang tren trinh duyet khong ho tro)",
  audioSessionSource.includes('session.type = "playback"') && audioSessionSource.includes("} catch {"),
);

check(
  "README ghi ro gioi han theo phien ban iOS + nguon nhung khong nghe duoc o nen",
  readmeSource.includes("audioSession") &&
    readmeSource.includes("iOS 17.5+") &&
    readmeSource.includes("KHÔNG nghe được ở nền"),
);

/* --------------------------------- Ket qua --------------------------------- */

const failed = results.filter((line) => line.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\nTONG KET: ${results.length - failed.length} PASS / ${failed.length} FAIL`);
process.exitCode = failed.length === 0 ? 0 : 1;
