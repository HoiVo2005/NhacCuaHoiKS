/**
 * Kiem tra hen gio tat nhac (sleep timer):
 *   npx tsx scripts/verify-sleep-timer.ts
 *
 * Phu: phep tinh thoi gian (src/lib/sleep-timer.ts), state/action trong store,
 * duong "het bai" cua dong co phat va viec nut hen gio da gan vao thanh phat.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  describeSleepTimer,
  formatClockTime,
  formatSleepRemaining,
  formatSleepTracks,
  normalizeSleepMinutes,
  normalizeSleepTracks,
  sleepDeadlineFrom,
  sleepDeadlineFromClock,
  sleepRemaining,
  SLEEP_TIMER_MAX_MS,
  SLEEP_TIMER_MAX_MINUTES,
  SLEEP_TIMER_MAX_TRACKS,
  SLEEP_TIMER_MIN_TRACKS,
  SLEEP_TIMER_TRACKS,
} from "../src/lib/sleep-timer";
import type { SongDTO } from "../src/types";
/*
 * Import tinh: trong Node, `createThrottledPersistStorage` tu chuyen sang storage trong bo nho
 * (xem `typeof window === "undefined"`), nen khong can gia lap `window` nhu script khac.
 */
import { usePlayerStore } from "../src/store/player-store";

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

function readSource(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

function makeSong(id: string): SongDTO {
  return {
    id,
    title: `Bai ${id}`,
    sourceType: "UPLOADED",
    streamUrl: `/api/files/audio/${id}.mp3`,
  } as unknown as SongDTO;
}

// --------------------------------------------------- 1. Phep tinh thoi gian
check("formatSleepRemaining: 90 giay -> 1:30", formatSleepRemaining(90_000) === "1:30");
check("formatSleepRemaining: lam tron len theo giay", formatSleepRemaining(3_900_001) === "1:05:01");
check("formatSleepRemaining: 0 -> 0:00", formatSleepRemaining(0) === "0:00");
check("formatSleepRemaining: so am -> 0:00", formatSleepRemaining(-5_000) === "0:00");
check("sleepRemaining: chua hen gio -> 0", sleepRemaining(null) === 0);
check("sleepRemaining: da qua han -> 0 (khong am)", sleepRemaining(1_000, 4_000) === 0);
check("sleepRemaining: con dung 6 giay", sleepRemaining(10_000, 4_000) === 6_000);
check("sleepDeadlineFrom: 30 phut", sleepDeadlineFrom(30, 1_000) === 1_801_000);
check("sleepDeadlineFrom: chan gia tri vo ly (< 1 phut -> 1 phut)", sleepDeadlineFrom(0, 0) === 60_000);
check("sleepDeadlineFrom: chan tran 12 gio", sleepDeadlineFrom(99_999, 0) === SLEEP_TIMER_MAX_MS);

// ---------------------------------- 1b. Tu chon gio tat (so phut bat ky / gio dong ho)
check("normalizeSleepMinutes: 45 -> 45", normalizeSleepMinutes(45) === 45);
check("normalizeSleepMinutes: 12,4 -> 12 (lam tron)", normalizeSleepMinutes(12.4) === 12);
check(
  "normalizeSleepMinutes: tran 720 phut (12 gio) duoc chap nhan",
  normalizeSleepMinutes(SLEEP_TIMER_MAX_MINUTES) === 720,
);
check("normalizeSleepMinutes: 0 phut -> null (bao loi)", normalizeSleepMinutes(0) === null);
check("normalizeSleepMinutes: 721 phut -> null (qua tran)", normalizeSleepMinutes(721) === null);
check("normalizeSleepMinutes: am -> null", normalizeSleepMinutes(-30) === null);
check("normalizeSleepMinutes: o nhap rong -> null", normalizeSleepMinutes(Number("")) === null);
check("normalizeSleepMinutes: chu -> null", normalizeSleepMinutes(Number("abc")) === null);

/** Moc gio theo dong ho may (thang 6 - khong co chuyen gio mua he) */
const clockAt = (day: number, hour: number, minute: number, second = 0) =>
  new Date(2024, 5, day, hour, minute, second, 0).getTime();
const nowEvening = clockAt(10, 21, 15, 30);

check(
  "sleepDeadlineFromClock: 23:30 con trong ngay -> dung hom nay",
  sleepDeadlineFromClock("23:30", nowEvening) === clockAt(10, 23, 30),
);
check(
  "sleepDeadlineFromClock: 20:00 da qua -> hieu la ngay mai",
  sleepDeadlineFromClock("20:00", nowEvening) === clockAt(11, 20, 0),
);
check(
  "sleepDeadlineFromClock: chon dung phut hien tai -> tat sau 1 phut",
  sleepDeadlineFromClock("21:15", nowEvening) === nowEvening + 60_000,
);
check(
  "sleepDeadlineFromClock: bo khoang trang thua",
  sleepDeadlineFromClock("  23:30 ", nowEvening) === clockAt(10, 23, 30),
);
check("sleepDeadlineFromClock: 25:00 -> null", sleepDeadlineFromClock("25:00", nowEvening) === null);
check("sleepDeadlineFromClock: 21:75 -> null", sleepDeadlineFromClock("21:75", nowEvening) === null);
check("sleepDeadlineFromClock: 21:5 -> null (thieu phut)", sleepDeadlineFromClock("21:5", nowEvening) === null);
check("sleepDeadlineFromClock: chu -> null", sleepDeadlineFromClock("toi nay", nowEvening) === null);

check("formatClockTime: 23:30 -> '23:30'", formatClockTime(clockAt(10, 23, 30)) === "23:30");
check("formatClockTime: 7:05 -> '07:05'", formatClockTime(clockAt(10, 7, 5)) === "07:05");
check("formatClockTime: chua hen gio -> chuoi rong", formatClockTime(null) === "");
check(
  "describeSleepTimer: hien ca gio tat lan thoi gian con lai",
  describeSleepTimer("countdown", clockAt(11, 23, 30), clockAt(11, 23, 0)) ===
    "Hẹn giờ: tắt nhạc sau 30:00 (lúc 23:30)",
  describeSleepTimer("countdown", clockAt(11, 23, 30), clockAt(11, 23, 0)),
);

// ------------------------- 1c. Tat sau N bai (so bai tinh ca bai dang phat)
check("SLEEP_TIMER_TRACKS: co moc 1/2/3/5/10 bai", SLEEP_TIMER_TRACKS.join(",") === "1,2,3,5,10");
check("normalizeSleepTracks: 3 -> 3 bai", normalizeSleepTracks(3) === 3);
check("normalizeSleepTracks: 2,6 -> 3 (lam tron)", normalizeSleepTracks(2.6) === 3);
check(
  "normalizeSleepTracks: tran 99 bai duoc chap nhan",
  normalizeSleepTracks(SLEEP_TIMER_MAX_TRACKS) === 99,
);
check(
  "normalizeSleepTracks: 0 bai -> null (khong hen duoc 0 bai)",
  normalizeSleepTracks(SLEEP_TIMER_MIN_TRACKS - 1) === null,
);
check("normalizeSleepTracks: 100 bai -> null (qua tran)", normalizeSleepTracks(100) === null);
check("normalizeSleepTracks: am -> null", normalizeSleepTracks(-2) === null);
check("normalizeSleepTracks: o nhap rong -> null", normalizeSleepTracks(Number("")) === null);
check("normalizeSleepTracks: chu -> null", normalizeSleepTracks(Number("ba bai")) === null);
check("formatSleepTracks: 4 -> '4 bai'", formatSleepTracks(4) === "4 bài");
check("formatSleepTracks: 1 -> 'het bai nay'", formatSleepTracks(1) === "hết bài này");
check(
  "describeSleepTimer: hen 3 bai -> noi ro con 3 bai",
  describeSleepTimer("tracks", null, Date.now(), 3) ===
    "Hẹn giờ: tắt nhạc sau 3 bài nữa (kể cả bài đang phát)",
  describeSleepTimer("tracks", null, Date.now(), 3),
);
check(
  "describeSleepTimer: con 1 bai -> tuong duong 'het bai nay'",
  describeSleepTimer("tracks", null, Date.now(), 1) === "Hẹn giờ: tắt nhạc khi hết bài này",
);

// ------------------------------------------ 2. Hen gio dem nguoc trong store
const store = usePlayerStore;

check(
  "Mac dinh: hen gio dang tat",
  store.getState().sleepMode === "off" && store.getState().sleepEndsAt === null,
  `${store.getState().sleepMode} / ${store.getState().sleepEndsAt}`,
);

store.getState().playQueue([makeSong("sleep-1"), makeSong("sleep-2")]);
check("Phat nhac de thu hen gio", store.getState().isPlaying === true);

store.getState().setSleepTimer(15);
const armed = store.getState();
check(
  "setSleepTimer(15): bat kieu dem nguoc",
  armed.sleepMode === "countdown" && armed.sleepEndsAt !== null,
  `${armed.sleepMode} / ${armed.sleepEndsAt}`,
);
check(
  "setSleepTimer(15): hen dung 15 phut",
  Math.abs(sleepRemaining(armed.sleepEndsAt) - 900_000) <= 1_000,
  String(sleepRemaining(armed.sleepEndsAt)),
);

const deadline = armed.sleepEndsAt ?? 0;

store.getState().tickSleepTimer(deadline - 1);
check(
  "Chua het gio: van dang phat, hen gio con nguyen",
  store.getState().isPlaying === true && store.getState().sleepMode === "countdown",
  `${store.getState().isPlaying} / ${store.getState().sleepMode}`,
);

const fired = store.getState().tickSleepTimer(deadline);
check("Het gio: dong ho bao da tat nhac", fired === true);
check(
  "Het gio: tam dung phat va tat hen gio",
  store.getState().isPlaying === false &&
    store.getState().sleepMode === "off" &&
    store.getState().sleepEndsAt === null,
  `${store.getState().isPlaying} / ${store.getState().sleepMode}`,
);
check("Khi khong hen gio: dong ho khong lam gi", store.getState().tickSleepTimer() === false);

// --------------------------------- 3. Hen gio theo SO BAI ("con N bai nua thi tat")
store.getState().setPlaying(true);
store.getState().setSleepAfterTracks(3);
check(
  "setSleepAfterTracks(3): hen dung 3 bai, khong dung moc thoi gian",
  store.getState().sleepMode === "tracks" &&
    store.getState().sleepTracksLeft === 3 &&
    store.getState().sleepTracksTotal === 3 &&
    store.getState().sleepEndsAt === null,
  `${store.getState().sleepMode} / ${store.getState().sleepTracksLeft}`,
);

check("Bai 1/3 het: van tu chuyen bai", store.getState().handleTrackEnded() === true);
check("Bai 1/3 het: con 2 bai", store.getState().sleepTracksLeft === 2, String(store.getState().sleepTracksLeft));
check("Bai 2/3 het: van tu chuyen bai", store.getState().handleTrackEnded() === true);
check("Bai 2/3 het: con 1 bai", store.getState().sleepTracksLeft === 1, String(store.getState().sleepTracksLeft));
check("Bai cuoi (3/3) het: KHONG tu chuyen bai", store.getState().handleTrackEnded() === false);
check(
  "Bai cuoi het: dung phat va tat han hen gio",
  store.getState().isPlaying === false &&
    store.getState().sleepMode === "off" &&
    store.getState().sleepTracksLeft === 0 &&
    store.getState().sleepTracksTotal === 0,
  `${store.getState().isPlaying} / ${store.getState().sleepMode}`,
);

store.getState().setPlaying(true);
store.getState().setSleepAfterTracks(1);
check(
  "setSleepAfterTracks(1) = 'het bai nay thi tat': het bai -> dung luon",
  store.getState().sleepMode === "tracks" &&
    store.getState().sleepTracksLeft === 1 &&
    store.getState().handleTrackEnded() === false,
  `${store.getState().sleepMode} / ${store.getState().sleepTracksLeft}`,
);

store.getState().setSleepAfterTracks(0);
check(
  "setSleepAfterTracks(0): chan gia tri vo ly -> toi thieu 1 bai",
  store.getState().sleepTracksLeft === SLEEP_TIMER_MIN_TRACKS,
  String(store.getState().sleepTracksLeft),
);
store.getState().setSleepAfterTracks(500);
check(
  "setSleepAfterTracks(500): chan tran -> 99 bai",
  store.getState().sleepTracksLeft === SLEEP_TIMER_MAX_TRACKS,
  String(store.getState().sleepTracksLeft),
);
store.getState().setSleepAfterTracks(Number("abc"));
check(
  "setSleepAfterTracks(rac): ve mac dinh 1 bai",
  store.getState().sleepTracksLeft === SLEEP_TIMER_MIN_TRACKS,
  String(store.getState().sleepTracksLeft),
);

store.getState().clearSleepTimer();

store.getState().setPlaying(true);
check("Het bai binh thuong: van tu chuyen bai", store.getState().handleTrackEnded() === true);

store.getState().setSleepTimer(5);
store.getState().clearSleepTimer();
check(
  "clearSleepTimer: tat han hen gio",
  store.getState().sleepMode === "off" &&
    store.getState().sleepEndsAt === null &&
    store.getState().sleepTracksLeft === 0 &&
    store.getState().sleepTracksTotal === 0,
  `${store.getState().sleepMode} / ${store.getState().sleepEndsAt}`,
);

// ------------------------------- 3b. Tu chon moc gio (kieu “tat luc 23:30”)
store.getState().setSleepTimerAt(Date.now() + 45 * 60_000);
check(
  "setSleepTimerAt: hen theo moc tuy chon (45 phut nua)",
  store.getState().sleepMode === "countdown" &&
    Math.abs(sleepRemaining(store.getState().sleepEndsAt) - 2_700_000) <= 1_000,
  String(sleepRemaining(store.getState().sleepEndsAt)),
);

store.getState().setSleepTimerAt(Date.now() - 60 * 60_000);
const pastRemaining = sleepRemaining(store.getState().sleepEndsAt);
check(
  "setSleepTimerAt: moc da qua -> luon nam o tuong lai (khong tat ngay lap tuc)",
  pastRemaining > 0 && pastRemaining <= 31_000,
  String(pastRemaining),
);

store.getState().setSleepTimerAt(Date.now() + 100 * 60 * 60_000);
const farRemaining = sleepRemaining(store.getState().sleepEndsAt);
check(
  "setSleepTimerAt: chan tran 24 gio",
  farRemaining > 23 * 60 * 60_000 && farRemaining <= 24 * 60 * 60_000,
  String(farRemaining),
);

store.getState().clearSleepTimer();

// ---------------------------------------------- 4. Luu tru & giao dien
const storeSource = readSource("src/store/player-store.ts");
const partializeBlock = storeSource.slice(storeSource.indexOf("partialize:"));
check(
  "Hen gio khong luu vao localStorage (mo lai trang khong con hen gio cu)",
  partializeBlock.length > 0 &&
    !partializeBlock.includes("sleepMode") &&
    !partializeBlock.includes("sleepTracksLeft") &&
    !partializeBlock.includes("sleepTracksTotal"),
);
check(
  "Hang cho het -> hen gio theo so bai tu tat (khong hien nhan 'con 3 bai' sai)",
  storeSource.includes("...NO_TRACK_SLEEP"),
);

const barSource = readSource("src/components/player/player-bar.tsx");
check("Thanh phat co nut hen gio", barSource.includes("<SleepTimerButton />"));

const buttonSource = readSource("src/components/player/sleep-timer-button.tsx");
check(
  "Nut hen gio co cac moc phut + moc so bai + nut tat",
  buttonSource.includes("SLEEP_TIMER_MINUTES") &&
    buttonSource.includes("SLEEP_TIMER_TRACKS") &&
    buttonSource.includes("setSleepAfterTracks") &&
    buttonSource.includes("clearSleepTimer"),
);
check(
  "Nut hen gio dung icon DONG HO (khong phai hinh mat trang)",
  buttonSource.includes("<Clock") && !buttonSource.includes("Moon"),
);
check(
  "Menu hen gio mo LEN TREN (thanh phat sat day man hinh, mo xuong se bi cat)",
  buttonSource.includes('side="top"'),
);
check(
  "Menu hen gio co o TU CHON: so phut bat ky + moc gio dong ho",
  buttonSource.includes('type="number"') &&
    buttonSource.includes('type="time"') &&
    buttonSource.includes("normalizeSleepMinutes") &&
    buttonSource.includes("setSleepTimerAt"),
);
check(
  "Nhap sai thi bao loi (khong hen bua)",
  buttonSource.includes("setError(") && buttonSource.includes("SLEEP_TIMER_MAX_MINUTES"),
);
check(
  "Menu hen gio co o TU CHON so bai (1-99)",
  buttonSource.includes("normalizeSleepTracks") &&
    buttonSource.includes('placeholder="Số bài"') &&
    buttonSource.includes('aria-label="Số bài tự chọn"'),
);
check(
  "Nut hen gio hien so bai con lai tren thanh phat",
  buttonSource.includes("formatSleepTracks") && buttonSource.includes("sleepTracksLeft"),
);
check(
  "Menu dong ngay sau khi hen xong (nut dieu khien trang thai mo/dong)",
  buttonSource.includes("open={open}") && buttonSource.includes("onOpenChange={handleOpenChange}"),
);

const dropdownSource = readSource("src/components/ui/dropdown.tsx");
check(
  "Bam vao o nhap trong menu khong lam dong menu",
  dropdownSource.includes(
    'const KEEP_OPEN_SELECTOR = "input, textarea, select, [data-dropdown-keep-open]"',
  ) && dropdownSource.includes(".closest(KEEP_OPEN_SELECTOR)"),
);
check(
  "Nut tu chon giu menu mo de con hien loi nhap sai",
  buttonSource.includes("data-dropdown-keep-open"),
);
check(
  "Dong ho van dung khi tab bi an (kiem tra lai theo moi thay doi cua store)",
  buttonSource.includes("usePlayerStore.subscribe") && buttonSource.includes("tickSleepTimer"),
);
check(
  "Nhan dem nguoc hien tren nut",
  buttonSource.includes("formatSleepRemaining") && buttonSource.includes("tabular-nums"),
);

const engineSource = readSource("src/components/player/player-engine.tsx");
check("Dong co dung phat khi het bai neu dang hen gio", engineSource.includes("handleTrackEnded"));

/* --------------------- Man hinh dien thoai: panel rong --------------------- */
const mobileHookSource = readSource("src/hooks/use-is-mobile.ts");
const queuePanelSource = readSource("src/components/player/queue-panel.tsx");

check(
  "Dien thoai: hen gio hien panel rong giong 'Danh sach phat' (khong con menu nho sat mep duoi)",
  buttonSource.includes("useIsMobile") &&
    buttonSource.includes('role="dialog"') &&
    buttonSource.includes("w-[min(93vw,380px)]") &&
    buttonSource.includes("animate-slide-up") &&
    buttonSource.includes("fixed bottom-36 right-3"),
);
check(
  "Panel hen gio va panel Danh sach phat dung CUNG bo class (nhin giong nhau)",
  queuePanelSource.includes("fixed bottom-36 right-3") &&
    buttonSource.includes("fixed bottom-36 right-3") &&
    queuePanelSource.includes("glass safe-bottom animate-slide-up") &&
    buttonSource.includes("glass safe-bottom animate-slide-up"),
);
check(
  "Desktop van la menu nho mo len tren (khong doi hanh vi cu)",
  buttonSource.includes('side="top"') && buttonSource.includes("min-w-64 max-h-[70vh]"),
);
check(
  "Noi dung hen gio chi viet MOT lan, dung lai cho ca hai cach trinh bay",
  buttonSource.includes("const panelContent") &&
    (buttonSource.match(/\{panelContent\}/g) ?? []).length >= 2,
);
check(
  "Panel mobile dong duoc bang nut X / nut Dong / phim Esc",
  buttonSource.includes("onClick={closeMenu}") &&
    buttonSource.includes('event.key === "Escape"') &&
    buttonSource.includes("Đóng"),
);
check(
  "Nut hen gio tren mobile TU xu ly mo/dong panel (khong con `Dropdown` boc ngoai)",
  /*
   * Loi da gap that: doi sang panel rong cho mobile nhung quen gan su kien click (lop `Dropdown`
   * cu chinh la thu bat click) -> bam nut khong co gi xay ra. Kiem tra nay khoa lai.
   */
  buttonSource.includes("onClick={() => handleOpenChange(!open)}") &&
    buttonSource.includes('role="button"') &&
    buttonSource.includes("aria-expanded={open}"),
);
check(
  "Mo bang ban phim duoc (Enter / Space) giong nhu menu desktop",
  buttonSource.includes('event.key === "Enter"') && buttonSource.includes('event.key === " "'),
);
check(
  "Mo hen gio thi dong 'Danh sach phat' (hai panel cung vi tri, khong de chong nhau)",
  buttonSource.includes("usePlayerStore.getState().queueOpen") &&
    buttonSource.includes("toggleQueue()"),
);
check(
  "Hook nhan dien mobile: matchMedia 640px + co gia tri cho SSR (khong lech hydration)",
  mobileHookSource.includes('export const MOBILE_MEDIA_QUERY = "(max-width: 639px)"') &&
    mobileHookSource.includes("useSyncExternalStore") &&
    mobileHookSource.includes("getServerSnapshot"),
);

const failures = results.filter((line) => line.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
process.exitCode = failures.length === 0 ? 0 : 1;
