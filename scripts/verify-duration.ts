/**
 * Kiem tra thoi luong bai nhac (lay dung thoi gian, khong can API key):
 *   npx tsx scripts/verify-duration.ts
 */
import { extractYouTubeDurationFromHtml } from "../src/lib/music/adapters/youtube";
import { parseSoundCloudTrackPage } from "../src/lib/music/adapters/soundcloud";
import {
  DURATION_TOLERANCE_SECONDS,
  MAX_DURATION_SECONDS,
  shouldSyncDuration,
} from "../src/lib/duration";

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

// ------------------------------------------- 1. Quy tac dong bo thoi luong
check("CSDL chua biet thoi luong -> luu lai", shouldSyncDuration(0, 214));
check("Khop thoi luong -> khong ghi lai", !shouldSyncDuration(214, 214));
check(
  `Lech trong khoang cho phep (${DURATION_TOLERANCE_SECONDS}s) -> khong ghi lai`,
  !shouldSyncDuration(214, 214 + DURATION_TOLERANCE_SECONDS),
);
check("Lech qua nhieu -> ghi de con so dung", shouldSyncDuration(214, 214 + DURATION_TOLERANCE_SECONDS + 1));
check("Trinh phat bao 0 -> bo qua", !shouldSyncDuration(214, 0));
check("Trinh phat bao so am -> bo qua", !shouldSyncDuration(0, -5));
check(`Qua ${MAX_DURATION_SECONDS}s (24 gio) -> bo qua`, !shouldSyncDuration(0, MAX_DURATION_SECONDS + 1));

// --------------------------------- 2. Thoi luong YouTube doc tu trang xem video
const youtubeHtml = `
  <script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"dQw4w9WgXcQ","lengthSeconds":"214","title":"Demo"}</script>
`;
check("YouTube: doc dung lengthSeconds", extractYouTubeDurationFromHtml(youtubeHtml) === 214);

const youtubeApproxHtml = `{"streamingData":{"adaptiveFormats":[{"approxDurationMs":"215500"}]}}`;
check("YouTube: du phong bang approxDurationMs", extractYouTubeDurationFromHtml(youtubeApproxHtml) === 216);

check("YouTube: trang khong co thoi luong -> 0", extractYouTubeDurationFromHtml("<html></html>") === 0);

// ----------------------------------- 3. Thoi luong SoundCloud tu du lieu cong khai
const soundcloudHtml = `
<meta property="og:title" content="Flickermood">
<meta property="og:image" content="https://i1.sndcdn.com/artworks-abc-large.jpg">
<meta property="og:description" content="Mo ta">
<script>window.__sc_hydration = [{"hydratable":"sound","data":{"kind":"track","duration":214000,"genre":"Electronic","user":{"username":"Forss"}}}]</script>
`;

const soundcloud = parseSoundCloudTrackPage(soundcloudHtml);
check("SoundCloud: doc dung ten bai", soundcloud.title === "Flickermood", String(soundcloud.title));
check("SoundCloud: doc dung nghe si", soundcloud.artist === "Forss", String(soundcloud.artist));
check(
  "SoundCloud: doc dung thoi luong (ms -> giay)",
  soundcloud.durationSeconds === 214,
  String(soundcloud.durationSeconds),
);
check("SoundCloud: doc dung the loai", soundcloud.genre === "Electronic", String(soundcloud.genre));

const soundcloudFullDurationHtml = `<script>{"full_duration":187500,"user":{"username":"Ai do"}}</script>`;
check(
  "SoundCloud: du phong bang full_duration",
  parseSoundCloudTrackPage(soundcloudFullDurationHtml).durationSeconds === 188,
  String(parseSoundCloudTrackPage(soundcloudFullDurationHtml).durationSeconds),
);

const soundcloudNoDuration = parseSoundCloudTrackPage("<meta property=\"og:title\" content=\"Bai hat\">");
check(
  "SoundCloud: khong co thoi luong -> 0 (trinh phat se bo sung)",
  soundcloudNoDuration.durationSeconds === 0,
  String(soundcloudNoDuration.durationSeconds),
);

const failures = results.filter((line) => line.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
process.exitCode = failures.length === 0 ? 0 : 1;
