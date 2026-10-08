/**
 * Kiem chung "phat tiep dung cho da nghe" khi trang/iframe bi tai lai:
 *   npx tsx scripts/verify-playback-restore.ts  (hoac npm run check:resume)
 *
 * Khoa hai nguyen nhan lam nguoi dung dang nghe do thi quay lai thay bai phat tu 0:00:
 *  1. Iframe nhung bi trinh duyet reload luc o nen dai (TikTok con autoplay=1 -> chay lai tu dau)
 *     ma trang me van chay -> vi tri bi da ve dau -> canh bao thut lui tu tua lai cho cu;
 *  2. Trang bi tai lai (bo nho thu hoi / mo lai PWA) -> hang duoc khoi phu tu localStorage nhung
 *     vi tri thi khong -> chot vi tri luc dang phat de lan tai lai noi tiep, van khong phuc vu
 *     phien cu da dung (tinh nang "nghe tiep tu cho dung" cu van bi go theo yeu cau).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  findRestartSeekTarget,
  PLAYBACK_SNAPSHOT_INTERVAL_MS,
  PLAYBACK_SNAPSHOT_KEY,
  PLAYBACK_SNAPSHOT_MAX_AGE_MS,
  PLAYBACK_SNAPSHOT_MIN_SECONDS,
  readPlaybackSnapshot,
  RESTART_DROP_SECONDS,
  RESTART_END_TOLERANCE_SECONDS,
  RESTART_MIN_PEAK_SECONDS,
  resolveResumeStartAt,
  writePlaybackSnapshot,
  type PlaybackSnapshot,
} from "@/lib/playback-restore";

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

function source(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), ...relativePath.split("/")), "utf8");
}

/* ------------------- 1. Quyet dinh vi tri bat dau khi nap lai bai ------------------- */

const now = 1_700_000_000_000;

/** Vua dang nghe bai nay 2 phut truoc khi trang bi an */
const active: PlaybackSnapshot = {
  songId: "song-1",
  seconds: 137,
  wasPlaying: true,
  at: now - 60_000,
};

check("Han phuc vu la 15 phut", PLAYBACK_SNAPSHOT_MAX_AGE_MS === 15 * 60_000);
check("Duoi 5 giay thi khong can noi", PLAYBACK_SNAPSHOT_MIN_SECONDS === 5);
check("Chot dinh ky khi dang phat moi 10 giay", PLAYBACK_SNAPSHOT_INTERVAL_MS === 10_000);

check(
  "Dang phat + cung bai + con han -> noi dung cho da nghe",
  resolveResumeStartAt({ snapshot: active, songId: "song-1", now }) === 137,
);
check(
  "Khong co snapshot -> phat tu dau",
  resolveResumeStartAt({ snapshot: null, songId: "song-1", now }) === null,
);
check(
  "Bai khac -> khong noi (dung khi bam vua bai khac)",
  resolveResumeStartAt({ snapshot: active, songId: "song-2", now }) === null,
);
check(
  "Luc chot dang TAM DUNG -> phat tu dau (tinh nang nghe tiep cu van bi go)",
  resolveResumeStartAt({ snapshot: { ...active, wasPlaying: false }, songId: "song-1", now }) === null,
);
check(
  "Qua han 15 phut -> khong noi (phien cu)",
  resolveResumeStartAt({
    snapshot: { ...active, at: now - PLAYBACK_SNAPSHOT_MAX_AGE_MS - 1 },
    songId: "song-1",
    now,
  }) === null,
);
check(
  "Vua chot (con trong han) -> van noi duoc",
  resolveResumeStartAt({
    snapshot: { ...active, at: now - PLAYBACK_SNAPSHOT_MAX_AGE_MS + 1_000 },
    songId: "song-1",
    now,
  }) === 137,
);
check(
  "Tuoi am (dong ho bi doi) -> khong tin",
  resolveResumeStartAt({ snapshot: { ...active, at: now + 60_000 }, songId: "song-1", now }) === null,
);
check(
  "Vi tri qua nho (< 5 giay) -> khong can noi",
  resolveResumeStartAt({
    snapshot: { ...active, seconds: PLAYBACK_SNAPSHOT_MIN_SECONDS - 1 },
    songId: "song-1",
    now,
  }) === null,
);
check(
  "Vi tri khong hop le (NaN) -> khong noi",
  resolveResumeStartAt({ snapshot: { ...active, seconds: Number.NaN }, songId: "song-1", now }) === null,
);

/* ----------------------- 2. Doc/ghi snapshot vao localStorage ----------------------- */

/** Moc localStorage de test ham doc/ghi trong Node */
const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
};

writePlaybackSnapshot(active);
const roundTrip = readPlaybackSnapshot();
check(
  "Ghi -> doc lai duoc dung du lieu",
  roundTrip !== null &&
    roundTrip.songId === active.songId &&
    roundTrip.seconds === active.seconds &&
    roundTrip.wasPlaying === true,
  JSON.stringify(roundTrip),
);

writePlaybackSnapshot(null);
check("Xoa snapshot duoc (dung mot lan la het)", readPlaybackSnapshot() === null);

store.set(PLAYBACK_SNAPSHOT_KEY, "{khong phai json");
check("JSON hong -> doc duoc null, khong lam hong trinh phat", readPlaybackSnapshot() === null);

/* ------------------- 3. Canh bao media tu tai lai ve dau ------------------- */

const base = { peak: 120, duration: 240, switching: false, pendingSeek: null as number | null };

check(
  "Muc phat hien: thut lui toi thieu 10s / nghe du 10s / chua du 5s cuoi bai",
  RESTART_DROP_SECONDS === 10 && RESTART_MIN_PEAK_SECONDS === 10 && RESTART_END_TOLERANCE_SECONDS === 5,
);
check(
  "Media nhay ve dau khi dang nghe do -> tua lai cho cu (120s)",
  findRestartSeekTarget({ ...base, seconds: 0 }) === 120,
);
check(
  "Thut lui chua du 10 giay -> bo qua (dao dong binh thuong)",
  findRestartSeekTarget({ ...base, seconds: 111 }) === null,
);
check(
  "Thut dung 10 giay -> phat hien duoc",
  findRestartSeekTarget({ ...base, seconds: 110 }) === 120,
);
check(
  "Dang chuyen bai -> khong tua",
  findRestartSeekTarget({ ...base, seconds: 0, switching: true }) === null,
);
check(
  "Nguoi dung vua sua -> de store xu ly pendingSeek",
  findRestartSeekTarget({ ...base, seconds: 0, pendingSeek: 30 }) === null,
);
check(
  "Moi nghe duoc 8 giay -> chua du de sua",
  findRestartSeekTarget({ ...base, peak: 8, seconds: 0 }) === null,
);
check(
  "Gan het bai ma phat lai -> het bai/binh thuong, khong tua",
  findRestartSeekTarget({ ...base, peak: 237, seconds: 0 }) === null,
);
check(
  "Chua biet duration van phat hien duoc (iframe chua bao)",
  findRestartSeekTarget({ ...base, duration: 0, seconds: 0 }) === 120,
);
check(
  "Vi tri khong hop le -> bo qua",
  findRestartSeekTarget({ ...base, seconds: Number.NaN }) === null,
);

/* --------------------------- 4. Cac manh ghep noi day --------------------------- */

const engineSource = source("src/components/player/player-engine.tsx");
const audioEngineSource = source("src/components/player/engines/audio-engine.ts");
const restoreLibSource = source("src/lib/playback-restore.ts");
const readmeSource = source("README.md");

check(
  "Chot vi tri khi trang bi an + khi sap dong tab (pagehide)",
  engineSource.includes("savePlaybackSnapshot();") &&
    engineSource.includes('window.addEventListener("pagehide", savePlaybackSnapshot)'),
);
check(
  "Nap bai voi vi tri phuc vu (khong con load tu dau hard-code)",
  engineSource.includes("resolveResumeStartAt({") &&
    engineSource.includes("engine.load(current, resumeAt)") &&
    !engineSource.includes("engine.load(current, 0)"),
);
check(
  "Snapshot dung mot lan la xoa SAU khi nap xong (StrictMode chay 2 lan van doc duoc)",
  engineSource.includes("writePlaybackSnapshot(null)"),
);
check(
  "Trang tai lai -> tu PHAT TIEP phien nghe (khong can bam Phat)",
  engineSource.includes("resolveAutoPlay(wasPlaying || shouldResumeSession") &&
    engineSource.includes("shouldResumeSession = resumeAt > 0"),
);
check(
  "Chot vi tri: luc an trang/sap dong + moi luc doi phat/tam dung + dinh ky khi dang phat",
  engineSource.includes("savePlaybackSnapshot();") &&
    engineSource.includes("setInterval(savePlaybackSnapshot, PLAYBACK_SNAPSHOT_INTERVAL_MS)") &&
    engineSource.includes('window.addEventListener("pagehide", savePlaybackSnapshot)'),
);
check(
  "Canh bao media tai lai -> tu tua lai cho cu",
  engineSource.includes("findRestartSeekTarget({") &&
    engineSource.includes("latest.seek(restartTarget)") &&
    engineSource.includes("peakRef.current = currentTime"),
);
check(
  "Tua do nguoi dung dat lai dinh (khong lam hong canh bao tai lai)",
  engineSource.includes("peakRef.current = seekRequest.seconds"),
);
check(
  "File tai len: dat vi tri SAU load() (load() reset ve 0 -> truoc day startAt bi mat)",
  audioEngineSource.indexOf("this.audio.load()") <
    audioEngineSource.indexOf("this.audio.currentTime = Math.max(0, startAt)"),
);
check(
  "Tu dung 15 phut + muc thut lui 10s co dang trong lib",
  restoreLibSource.includes("PLAYBACK_SNAPSHOT_MAX_AGE_MS = 15 * 60_000") &&
    restoreLibSource.includes("RESTART_DROP_SECONDS = 10"),
);
check(
  "README ghi hanh vi + lenh kiem chung",
  readmeSource.includes("playback-restore") && readmeSource.includes("check:resume"),
);

/* --------------------------------- Ket qua --------------------------------- */

const failures = results.filter((line) => line.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
process.exitCode = failures.length === 0 ? 0 : 1;
