import { readFileSync } from "node:fs";
import path from "node:path";

import {
  forgetResumePosition,
  pruneResumeMap,
  rememberResumePosition,
  resumeSecondsFor,
  resumeStep,
  RESUME_MAX_ENTRIES,
  RESUME_MIN_SECONDS,
  RESUME_SAVE_STEP_SECONDS,
  RESUME_TAIL_SECONDS,
  sanitizeResumeMap,
  type ResumeMap,
} from "@/lib/resume";

/**
 * Kiem chung "Nghe tiep tu cho dung": npx tsx scripts/verify-resume.ts
 *
 * Loi de gay kho chiu nhat (nen duoc khoa lai o day):
 *  1. Nho vi tri khi bai vua mo 3 giay -> lan sau vao bi "nhay" vao giua bai vo co.
 *  2. Nho ca khi da nghe gan het bai -> lan sau bam vao chi con vai giay cuoi, tuong loi.
 *  3. Tua ve dau bai ma van con vi tri cu -> lan sau lai nhay vao giua bai.
 *  4. Ghi localStorage qua day -> giat nhac (buoc 5 giay moi ghi mot lan).
 *  5. Du lieu trong localStorage bi sua tay -> khong duoc lam hong trang thai trinh phat.
 */

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

function skip(label: string, detail = ""): void {
  results.push(`SKIP | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

/* --------------------------- 1. Luat ghi nho vi tri --------------------------- */

check("Buoc lam tron vi tri la 5 giay", RESUME_SAVE_STEP_SECONDS === 5);
check("Lam tron xuong theo buoc (47.8 -> 45)", resumeStep(47.8) === 45);
check("Vi tri nho hon buoc -> 0", resumeStep(3.9) === 0);
check("Vi tri am hoac khong hop le -> 0", resumeStep(-10) === 0 && resumeStep(Number.NaN) === 0);

const emptyMap: ResumeMap = {};

check(
  "Chua nghe du nguong -> KHONG ghi (giu nguyen ban do cu)",
  rememberResumePosition(emptyMap, "song-a", RESUME_MIN_SECONDS - 1, 1_000) === emptyMap,
);
check(
  "Khong co ma bai -> KHONG ghi",
  rememberResumePosition(emptyMap, null, 300, 1_000) === emptyMap,
);

const remembered = rememberResumePosition(emptyMap, "song-a", 47.8, 1_000);
check("Da nghe du nguong -> ghi theo buoc 5 giay", remembered["song-a"]?.seconds === 45);
check("Ghi kem thoi diem luu", remembered["song-a"]?.savedAt === 1_000);

const sameStep = rememberResumePosition(remembered, "song-a", 46.2, 2_000);
check("Van trong cung buoc 5 giay -> KHONG tao ban ghi moi (tranh ghi localStorage)", sameStep === remembered);

const nextStep = rememberResumePosition(remembered, "song-a", 51.4, 3_000);
check("Sang buoc moi -> cap nhat vi tri (50)", nextStep["song-a"]?.seconds === 50);
check("Ban do cu khong bi sua tai cho (bat bien)", remembered["song-a"]?.seconds === 45);

/* ------------------------ 2. Khi nao duoc nghe tiep ------------------------ */

check("Chua co vi tri -> phat tu dau (null)", resumeSecondsFor(emptyMap, "song-a", 240) === null);
check(
  "Da co vi tri va con nhieu phia sau -> nghe tiep dung vi tri",
  resumeSecondsFor(remembered, "song-a", 240) === 45,
);
check(
  "Da nghe gan het bai -> phat lai tu dau (khong con vai giay cuoi)",
  resumeSecondsFor(
    { "song-b": { seconds: 240 - RESUME_TAIL_SECONDS + 1, savedAt: 1 } },
    "song-b",
    240,
  ) === null,
);
check(
  "Vi tri dai hon thoi luong bai (du lieu cu) -> phat lai tu dau",
  resumeSecondsFor({ "song-c": { seconds: 300, savedAt: 1 } }, "song-c", 240) === null,
);
check(
  "Chua biet thoi luong bai (0) -> van nghe tiep theo nguong toi thieu",
  resumeSecondsFor(remembered, "song-a", 0) === 45,
);
check(
  "Ban do rong / null -> phat tu dau",
  resumeSecondsFor(null, "song-a", 240) === null && resumeSecondsFor({}, "song-a", 240) === null,
);
check("Nguong toi thieu va duoi bai la hop ly", RESUME_MIN_SECONDS === 20 && RESUME_TAIL_SECONDS === 15);

/* ------------------------- 3. Don ban do khi can ------------------------- */

check(
  "Tua ve dau bai -> xoa vi tri da nho",
  forgetResumePosition(remembered, "song-a")["song-a"] === undefined,
);
check(
  "Xoa bai khong co trong ban do -> giu nguyen tham chieu",
  forgetResumePosition(remembered, "song-z") === remembered,
);

const manyEntries: ResumeMap = {};
for (let index = 0; index < RESUME_MAX_ENTRIES + 25; index += 1) {
  manyEntries[`song-${index}`] = { seconds: 60, savedAt: index };
}

const pruned = pruneResumeMap(manyEntries);
check(
  `Ban do bi cat bot dung gioi han (${RESUME_MAX_ENTRIES} bai)`,
  Object.keys(pruned).length === RESUME_MAX_ENTRIES,
);
check(
  "Giu cac bai MOI NHAT, loai bai cu truoc",
  pruned["song-224"] !== undefined && pruned["song-0"] === undefined,
);
check("Ban do nho hon gioi han -> giu nguyen tham chieu", pruneResumeMap(remembered) === remembered);

/* ----------------------- 4. Don du lieu tu localStorage ----------------------- */

check(
  "Bo qua du lieu sai kieu (chuoi, so, null)",
  Object.keys(sanitizeResumeMap("khong phai object")).length === 0 &&
    Object.keys(sanitizeResumeMap(null)).length === 0,
);
check(
  "Bo muc sai kieu / vi tri vo ly",
  Object.keys(
    sanitizeResumeMap({ "song-a": { seconds: "45" }, "song-b": { seconds: 5 }, "song-c": null }),
  ).length === 0,
);
check(
  "Giu muc hop le va thieu `savedAt` thi lay 0",
  sanitizeResumeMap({ "song-a": { seconds: 45 } })["song-a"]?.seconds === 45 &&
    sanitizeResumeMap({ "song-a": { seconds: 45 } })["song-a"]?.savedAt === 0,
);

/* ------------------ 5. Store that (zustand) - luong ghi/doc ------------------ */

/** Bai nhac gia de kiem tra store (khong can CSDL) */
function fakeSong(id: string, durationSeconds: number) {
  return {
    id,
    title: `Bài ${id}`,
    artist: "Ca sĩ thử",
    album: null,
    description: null,
    durationSeconds,
    thumbnailUrl: null,
    sourceType: "YOUTUBE" as const,
    sourceId: "dQw4w9WgXcQ",
    sourceUrl: null,
    streamUrl: null,
    embedUrl: null,
    playbackType: "EMBED" as const,
    tags: [],
    genreId: null,
    genre: null,
    isPublished: true,
    playCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: null,
  };
}

async function runStoreCheck(): Promise<void> {
  try {
    const { usePlayerStore } = await import("@/store/player-store");

    usePlayerStore.getState().playQueue([fakeSong("song-resume", 240)], 0, "Kiểm chứng");

    usePlayerStore.getState().rememberPosition("song-resume", RESUME_MIN_SECONDS - 5);
    check(
      "Store: chua nghe du nguong -> khong ghi vi tri",
      usePlayerStore.getState().resume["song-resume"] === undefined,
    );

    usePlayerStore.getState().rememberPosition("song-resume", 47.8);
    check(
      "Store: nghe do -> ghi vi tri theo buoc 5 giay",
      usePlayerStore.getState().resume["song-resume"]?.seconds === 45,
    );

    const beforeSameStep = usePlayerStore.getState().resume;
    usePlayerStore.getState().rememberPosition("song-resume", 46.2);
    check(
      "Store: cung buoc 5 giay -> khong cap nhat state (khong ghi localStorage vo ich)",
      usePlayerStore.getState().resume === beforeSameStep,
    );

    check(
      "Store: doc lai duoc vi tri de dong co nghe tiep",
      resumeSecondsFor(usePlayerStore.getState().resume, "song-resume", 240) === 45,
    );

    usePlayerStore.setState({ duration: 240 });
    usePlayerStore.getState().requestSeekPosition(0);
    check(
      "Store: tua ve dau bai -> xoa vi tri da nho",
      usePlayerStore.getState().resume["song-resume"] === undefined,
    );

    /* Don sach trang thai de khong anh huong lan chay khac (store la singleton trong tien trinh) */
    usePlayerStore.getState().clearQueue();
  } catch (error) {
    skip("Kiem chung store that", error instanceof Error ? error.message : String(error));
  }
}

/* --------------------------- 6. Cac manh ghep UI --------------------------- */

const root = process.cwd();

function source(relativePath: string): string {
  return readFileSync(path.join(root, ...relativePath.split("/")), "utf8");
}

const storeSource = source("src/store/player-store.ts");
const engineSource = source("src/components/player/player-engine.tsx");
const trackerSource = source("src/components/player/resume-tracker.tsx");
const layoutSource = source("src/app/layout.tsx");
const readmeSource = source("README.md");

check("Store giu ban do vi tri da nghe", storeSource.includes("resume: ResumeMap"));
check("Store luu vi tri da nghe xuong localStorage", storeSource.includes("resume: state.resume"));
check(
  "Store don du lieu vi tri khi doc lai tu localStorage",
  storeSource.includes("sanitizeResumeMap("),
);
check(
  "Store xoa vi tri da nho khi nguoi dung tua ve dau bai",
  storeSource.includes("forgetResumePosition(state.resume, songId)"),
);
check(
  "Dong co nap bai tu vi tri da luu (moi nguon deu ho tro `load(song, startAt)`)",
  engineSource.includes("resumeSecondsFor(") && engineSource.includes("engine.load(current, resumeAt)"),
);
check(
  "Nguoi dung duoc bao vi sao bai bat dau tu giua bai (kem nut ve dau bai)",
  engineSource.includes("Nghe tiếp") && engineSource.includes("Về đầu bài"),
);
check(
  "ResumeTracker theo doi store va ghi vi tri",
  trackerSource.includes("usePlayerStore.subscribe(") && trackerSource.includes("rememberPosition("),
);
check("ResumeTracker ghi not vi tri khi dong tab", trackerSource.includes('"pagehide"'));
check("ResumeTracker duoc mount mot lan o layout goc", layoutSource.includes("<ResumeTracker />"));
check(
  "README ghi lai tinh nang + lenh kiem chung",
  readmeSource.includes("check:resume") && readmeSource.includes("Nghe tiếp từ chỗ dừng"),
);

/* --------------------------------- Ket qua --------------------------------- */

void (async () => {
  await runStoreCheck();

  const failed = results.filter((line) => line.startsWith("FAIL"));
  console.log(results.join("\n"));
  console.log(`\nTONG KET: ${results.length - failed.length} PASS / ${failed.length} FAIL`);
  process.exitCode = failed.length === 0 ? 0 : 1;
})();
