/**
 * Kiem tra toc do / do muot khi phat nhac:
 *   npx tsx scripts/verify-playback-perf.ts
 *
 * Gom 2 phan:
 *  1. Kiem tra ma nguon (khong can server): route phuc vu file nhac phai STREAM theo Range thay vi
 *     doc ca file vao RAM; trinh phat phai "ham nong" API cua nen tang truoc khi nguoi dung bam phat;
 *     the <audio> phai tai truoc du lieu; trang thai luu xuong localStorage phai duoc tiet che ghi;
 *     khung video khong ghi lai style khong doi khi cuon.
 *  2. Kiem tra bang HTTP that (can `npm run dev` hoac `npm start` dang chay): tao mot file tam trong
 *     storage noi bo roi kiem tra 200 / 206 / 416 / 304 va tung byte tra ve co dung khong.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { getLocalStorageRoot, resolveLocalPath } from "../src/lib/storage";

const BASE = process.env.SMOKE_BASE || "http://localhost:3000";

/** File tam dung de kiem tra stream (nam trong storage noi bo, xoa sau khi kiem tra) */
const PROBE_KEY = "__verify-playback-perf.bin";
const PROBE_SIZE = 1_500_000;

const results: string[] = [];
let skipped = 0;

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

function skip(label: string, detail = ""): void {
  skipped += 1;
  results.push(`SKIP | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

const read = (file: string): string => readFileSync(path.join(process.cwd(), file), "utf8");

/** ------------------------------------------------------------------ 1. Ma nguon */
function checkSources(): void {
  const route = read(path.join("src", "app", "api", "files", "[...path]", "route.ts"));
  const engine = read(path.join("src", "components", "player", "player-engine.tsx"));
  const youtube = read(path.join("src", "components", "player", "engines", "youtube-engine.ts"));
  const soundcloud = read(path.join("src", "components", "player", "engines", "soundcloud-engine.ts"));
  const audio = read(path.join("src", "components", "player", "engines", "audio-engine.ts"));
  const store = read(path.join("src", "store", "player-store.ts"));
  const storage = read(path.join("src", "lib", "throttled-storage.ts"));
  const videoStage = read(path.join("src", "components", "player", "video-stage.ts"));

  check(
    "Route file nhac STREAM theo khoang byte (khong doc ca file vao RAM)",
    route.includes("createReadStream(filePath, { start, end })") &&
      route.includes("Readable.toWeb(") &&
      !route.includes("readFile("),
  );
  check(
    "Route ho tro day du dang Range (bytes=a-b, bytes=a-, bytes=-n)",
    route.includes("function parseRange(") &&
      route.includes("if (!rawStart)") &&
      route.includes("Math.max(0, totalSize - suffix)"),
  );
  check(
    "Route tra 416 khi Range ngoai file + 304 theo ETag (khong tai lai file khong doi)",
    route.includes("status: 416") &&
      route.includes('"content-range": `bytes */${totalSize}`') &&
      route.includes("status: 304") &&
      route.includes("if-none-match"),
  );

  check(
    "The <audio> tai truoc du lieu cua bai dang phat (preload=auto)",
    engine.includes('preload="auto"') && !engine.includes('preload="metadata"'),
  );
  check(
    "Trinh phat ham nong API nen tang khi trang ranh (mot lan moi phien)",
    engine.includes("warmedUpRef") &&
      engine.includes("requestIdleCallback") &&
      engine.includes("ensureEngineForSource(sourceType)?.prewarm?.()"),
  );
  check(
    "Khong ham nong tren mang 2G / che do tiet kiem du lieu",
    engine.includes("connection?.saveData") && engine.includes('"slow-2g"'),
  );
  check(
    "YouTube: ham nong tao san iframe player truoc khi bam phat",
    youtube.includes("prewarm(): void") && youtube.includes("void this.ensureReady();"),
  );
  check(
    "SoundCloud: ham nong tai truoc Widget API",
    soundcloud.includes("prewarm(): void") &&
      soundcloud.includes("void loadSoundCloudWidgetApi();"),
  );
  check(
    "File tai len: ham nong bat the <audio> tai truoc",
    audio.includes("prewarm(): void") && audio.includes('this.audio.preload = "auto";'),
  );

  check(
    "Trang thai phat ghi xuong localStorage co TIET CHE (khong ghi moi tick tien do)",
    store.includes("createThrottledPersistStorage<PersistedPlayerState>()") &&
      storage.includes("setTimeout(write, delayMs)") &&
      storage.includes("JSON.stringify(value)"),
  );
  check(
    "Ghi not trang thai khi tab bi an / dong (khong mat bai dang nghe)",
    storage.includes('window.addEventListener("pagehide", write)') &&
      storage.includes('visibilityState === "hidden"'),
  );
  check(
    "Khung video bo qua lan ghi style khong doi khi cuon",
    videoStage.includes("const previous = applied.get(property);") &&
      videoStage.includes("if (previous === value) continue;"),
  );
}

/** -------------------------------------------------------- 2. Kiem tra bang HTTP */
interface Probe {
  status: number;
  headers: Headers;
  body: Uint8Array | null;
}

async function probe(pathname: string, init?: RequestInit): Promise<Probe> {
  const response = await fetch(`${BASE}${pathname}`, init);
  const body =
    response.status === 304 || response.status === 416
      ? null
      : new Uint8Array(await response.arrayBuffer());

  return { status: response.status, headers: response.headers, body };
}

async function serverReachable(): Promise<boolean> {
  try {
    await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(4_000) });
    return true;
  } catch {
    return false;
  }
}

async function checkHttp(): Promise<void> {
  if (!(await serverReachable())) {
    skip(
      "Kiem tra HTTP (200 / 206 / 416 / 304 + tung byte tra ve)",
      `khong ket noi duoc ${BASE} - hay chay \`npm run dev\` roi chay lai`,
    );
    return;
  }

  const filePath = resolveLocalPath(PROBE_KEY);
  if (!filePath) {
    check("Tao duoc file tam trong storage noi bo", false, PROBE_KEY);
    return;
  }

  // Noi dung xac dinh truoc de doi chieu tung byte tra ve
  const content = Buffer.alloc(PROBE_SIZE);
  for (let index = 0; index < PROBE_SIZE; index += 1) content[index] = index % 251;

  await mkdir(getLocalStorageRoot(), { recursive: true });
  await writeFile(filePath, content);

  try {
    const url = `/api/files/${PROBE_KEY}`;

    const full = await probe(url);
    check(
      "Tai toan bo file: 200 + bao ho tro Range",
      full.status === 200 &&
        full.headers.get("accept-ranges") === "bytes" &&
        full.headers.get("content-length") === String(PROBE_SIZE) &&
        full.body?.byteLength === PROBE_SIZE,
      `status=${full.status} | length=${full.headers.get("content-length")} | nhan=${full.body?.byteLength}`,
    );

    const etag = full.headers.get("etag") ?? "";
    check(
      "Co ETag + Last-Modified (de trinh duyet hoi lai bang 304)",
      etag.length > 0 && Boolean(full.headers.get("last-modified")),
    );

    const notModified = await probe(url, { headers: { "if-none-match": etag } });
    check(
      "File khong doi: 304 (khong doc lai noi dung)",
      notModified.status === 304 && notModified.body === null,
      `status=${notModified.status}`,
    );

    const head = await probe(url, { method: "HEAD" });
    check(
      "HEAD: tra header dung kich thuoc, khong tra noi dung",
      head.status === 200 && head.headers.get("content-length") === String(PROBE_SIZE),
      `status=${head.status} | length=${head.headers.get("content-length")}`,
    );

    // Doan GIUA file (dung khi seek / phat tiep): khong duoc doc tu dau file
    const middleStart = 900_000;
    const middleEnd = middleStart + 65_535;
    const started = performance.now();
    const middle = await probe(url, { headers: { range: `bytes=${middleStart}-${middleEnd}` } });
    const elapsedMs = Math.round(performance.now() - started);

    check(
      "Range giua file: 206 + content-range dung + du byte",
      middle.status === 206 &&
        middle.headers.get("content-range") === `bytes ${middleStart}-${middleEnd}/${PROBE_SIZE}` &&
        middle.body?.byteLength === middleEnd - middleStart + 1,
      `status=${middle.status} | content-range=${middle.headers.get("content-range")} | nhan=${middle.body?.byteLength}`,
    );
    check(
      "Byte tra ve dung vi tri trong file (khong lech)",
      Boolean(
        middle.body &&
          middle.body[0] === middleStart % 251 &&
          middle.body[middle.body.byteLength - 1] === middleEnd % 251,
      ),
    );
    check("Doan 64KB tra ve nhanh (< 1s)", elapsedMs < 1000, `${elapsedMs}ms`);

    const openEnded = await probe(url, { headers: { range: `bytes=${PROBE_SIZE - 500}-` } });
    check(
      "Range mo cuoi (bytes=a-): dung 500 byte cuoi",
      openEnded.status === 206 &&
        openEnded.headers.get("content-range") ===
          `bytes ${PROBE_SIZE - 500}-${PROBE_SIZE - 1}/${PROBE_SIZE}` &&
        openEnded.body?.byteLength === 500,
      `content-range=${openEnded.headers.get("content-range")} | nhan=${openEnded.body?.byteLength}`,
    );

    const suffix = await probe(url, { headers: { range: "bytes=-500" } });
    check(
      "Range dang suffix (bytes=-n): 500 byte cuoi",
      suffix.status === 206 &&
        suffix.headers.get("content-range") ===
          `bytes ${PROBE_SIZE - 500}-${PROBE_SIZE - 1}/${PROBE_SIZE}` &&
        suffix.body?.byteLength === 500,
      `content-range=${suffix.headers.get("content-range")} | nhan=${suffix.body?.byteLength}`,
    );

    const beyond = await probe(url, { headers: { range: `bytes=${PROBE_SIZE}-` } });
    check(
      "Range ngoai file: 416 + tong kich thuoc (client tu xu ly)",
      beyond.status === 416 && beyond.headers.get("content-range") === `bytes */${PROBE_SIZE}`,
      `status=${beyond.status} | content-range=${beyond.headers.get("content-range")}`,
    );
  } finally {
    await unlink(filePath).catch(() => undefined);
  }
}

async function main(): Promise<void> {
  checkSources();
  await checkHttp();

  const failures = results.filter((line) => line.startsWith("FAIL"));
  const passed = results.length - failures.length - skipped;

  console.log(results.join("\n"));
  console.log(
    `\nTONG KET: ${passed} PASS / ${failures.length} FAIL${skipped ? ` / ${skipped} SKIP` : ""}`,
  );
  process.exitCode = failures.length === 0 ? 0 : 1;
}

void main().catch((error) => {
  console.error("VERIFY PLAYBACK PERF FAILED:", error);
  process.exitCode = 1;
});
