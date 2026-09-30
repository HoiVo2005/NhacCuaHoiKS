/**
 * Kiem chung hieu ung song nhac o phan chi tiet bai hat (trinh phat day du, CHI desktop):
 *   npx tsx scripts/verify-visualizer.ts
 *
 * Khoa lai bon dieu de khong lam hong lai:
 *  1. CHI hien + CHI chay tren desktop (dien thoai khong phai chay vong lap ve 56 cot).
 *  2. Cac ham tinh phai THUAN (khong `Math.random`) -> may chu va trinh duyet ve ra y het nhau.
 *  3. Phan tich am thanh THAT phai dung `captureStream()` (SAO CHEP luong); TUYET DOI khong dung
 *     `createMediaElementSource()` (doi duong phat -> mat kha nang nghe khi app ra nen, xem
 *     `needsWebAudioGraph`) va khong duoc noi analyser vao loa (se nghe 2 lan).
 *  4. Nguon nhung (YouTube/SoundCloud/TikTok) khong phan tich duoc -> phai co NHIP MO PHONG bam theo vi
 *     tri bai hat, khong duoc dung yen hoac sai nhieu so voi bai.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  levelToScale,
  simulatedLevels,
  smoothLevels,
  spectrumLevels,
  visualizerBars,
  VISUALIZER_ATTACK,
  VISUALIZER_BAR_COUNT,
  VISUALIZER_BEAT_MS,
  VISUALIZER_MIN_SCALE,
  VISUALIZER_RELEASE,
  VISUALIZER_REST_BASS,
  VISUALIZER_REST_TREBLE,
} from "@/lib/visualizer";

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

const read = (file: string) => readFileSync(path.join(process.cwd(), ...file.split("/")), "utf8");

/**
 * Bo chu thich khoi ma nguon truoc khi kiem.
 *
 * Vi sao can: tai lieu trong file CO NHAC den `Math.random()` (de giai thich vi sao khong dung), nen
 * neu tim chuoi tho se bao loi gia. O day chi kiem MA NGUON thuc su.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*\{\/\*[\s\S]*?\*\/\}$/gm, "");
}

/* ------------------------- 1. Cau hinh cot (muc nghi, do dam) ------------------------- */

const bars = visualizerBars();

check(`So cot mac dinh la ${VISUALIZER_BAR_COUNT}`, bars.length === VISUALIZER_BAR_COUNT, String(bars.length));
check(
  "Tat ca cot co muc nghi / do dam hop le",
  bars.every((bar) => Number.isFinite(bar.restLevel) && Number.isFinite(bar.opacity)),
);
check(
  "Muc nghi trong (0..1] (khong cot nao bang 0 -> khung song khong bi trong)",
  bars.every((bar) => bar.restLevel > 0 && bar.restLevel <= 1),
);
check(
  "Do dam trong 0.5..1 (cot phia cao mo hon nhung van nhin thay)",
  bars.every((bar) => bar.opacity >= 0.5 && bar.opacity <= 1),
);
check(
  "Cot tram cao hon cot cao (dai song co hinh ngay ca khi tam dung)",
  bars[0].restLevel === VISUALIZER_REST_BASS &&
    bars[bars.length - 1].restLevel === VISUALIZER_REST_TREBLE &&
    VISUALIZER_REST_BASS > VISUALIZER_REST_TREBLE,
);
check(
  "Muc nghi va do dam giam dan tu tram (trai) sang cao (phai)",
  bars.every((bar, index) => index === 0 || bar.restLevel <= bars[index - 1].restLevel) &&
    bars.every((bar, index) => index === 0 || bar.opacity <= bars[index - 1].opacity),
);

/* --------------------------- 2. Doc pho am thanh THAT (spectrum) --------------------------- */

const silentSpectrum = spectrumLevels(new Uint8Array(128), 8);
check(
  "Pho im lang -> moi cot bang 0",
  silentSpectrum.length === 8 && silentSpectrum.every((level) => level === 0),
);

const fullSpectrum = spectrumLevels(new Uint8Array(128).fill(255), 8);
check("Pho bao hoa (moi bin = 255) -> moi cot bang 1", fullSpectrum.every((level) => level === 1));

/** Tin hieu gia: chi nua dau pho (vung tram) co tin hieu */
const bassOnly = new Uint8Array(128);
for (let bin = 1; bin < 16; bin += 1) bassOnly[bin] = 255;

const bassLevels = spectrumLevels(bassOnly, 16);
check(
  "Nhac tram -> cot ben trai (tram) cao hon han cot ben phai (cao)",
  bassLevels[0] > 0.5 && bassLevels[0] > bassLevels[bassLevels.length - 1],
  `trai=${bassLevels[0]} phai=${bassLevels[bassLevels.length - 1]}`,
);
check(
  "Moi cot deu trong 0..1 va khong NaN",
  bassLevels.every((level) => Number.isFinite(level) && level >= 0 && level <= 1),
);
check("Do dai mang = so cot yeu cau", spectrumLevels(bassOnly, 40).length === 40);
check(
  "Pho rong / gia tri bien khong lam vo ham",
  spectrumLevels([], 5).every((level) => level === 0) &&
    spectrumLevels([1], 5).every((level) => level === 0) &&
    spectrumLevels(new Uint8Array(64), 5, 0).every((level) => level === 0),
);

/* ------------------------------ 3. Tinh thuan (hydration) ------------------------------ */

check(
  "Sinh lai cho ket qua GIONG HET (khong dung Math.random -> khong lech hydration)",
  JSON.stringify(visualizerBars()) === JSON.stringify(bars) &&
    JSON.stringify(simulatedLevels(12.5)) === JSON.stringify(simulatedLevels(12.5)),
);
check(
  "Doi so cot duoc ton trong (dung cho man hinh hep hon)",
  visualizerBars(8).length === 8 && visualizerBars(1).length === 1,
);
check(
  "So cot khong hop le (0 / am) van tra ve it nhat 1 cot",
  visualizerBars(0).length === 1 && visualizerBars(-5).length === 1,
);
check(
  "Mot cot duy nhat khong bi NaN",
  Number.isFinite(visualizerBars(1)[0].restLevel) && Number.isFinite(simulatedLevels(3, 1)[0]),
);

/* ---------------- 4. Nhip MO PHONG cho nguon nhung (khong phan tich duoc am thanh) ---------------- */

const BEAT_SECONDS = VISUALIZER_BEAT_MS / 1000;
const onBeat = simulatedLevels(0, VISUALIZER_BAR_COUNT);
const beforeNextBeat = simulatedLevels(BEAT_SECONDS * 0.9, VISUALIZER_BAR_COUNT);
const lastBarIndex = VISUALIZER_BAR_COUNT - 1;

check(
  "Moi cot trong 0..1 o moi thoi diem",
  [0, 0.37, 1.2, 7.9, 123.45].every((seconds) =>
    simulatedLevels(seconds).every((level) => level >= 0 && level <= 1),
  ),
);
check(
  "Dung ngay phach: cot tram vot len manh (cao hon han luc sap sang phach)",
  onBeat[0] > beforeNextBeat[0],
  `phach=${onBeat[0]} truocPhach=${beforeNextBeat[0]}`,
);
check(
  "Cot tram an nhip manh hon cot cao (giong equalizer that)",
  onBeat[0] - beforeNextBeat[0] > onBeat[lastBarIndex] - beforeNextBeat[lastBarIndex],
);
check(
  "Hinh doi theo thoi diem bai hat (khong dung yen)",
  JSON.stringify(simulatedLevels(5)) !== JSON.stringify(simulatedLevels(5.4)),
);
check(
  "Tua bai -> hinh doi theo vi tri moi (khong bi le thuoc dong ho may)",
  JSON.stringify(simulatedLevels(30)) !== JSON.stringify(simulatedLevels(30.6)),
);
check(
  "Gia tri bat thuong (NaN / am / beatMs <= 0) khong lam vo ham",
  simulatedLevels(Number.NaN, 4).every((level) => Number.isFinite(level)) &&
    simulatedLevels(-5, 4).every((level) => Number.isFinite(level)) &&
    simulatedLevels(3, 4, 0).every((level) => Number.isFinite(level)),
);

/* ------------------------- 5. Lam muot + he so ve vao DOM ------------------------- */

const rising = smoothLevels([0, 0.2], [1, 1]);
const falling = smoothLevels([1, 0.2], [0, 0.2]);

check(
  "Cot vot len theo attack, roi xuong theo release (roi cham hon)",
  Math.abs(rising[0] - VISUALIZER_ATTACK) < 1e-9 &&
    Math.abs(falling[0] - (1 - VISUALIZER_RELEASE)) < 1e-9,
  `len=${rising[0]} xuong=${falling[0]}`,
);
check(
  "Lam muot khong bao gio day gia tri ra ngoai 0..1",
  smoothLevels([0.9, 0.9], [1, 0]).every((level) => level >= 0 && level <= 1),
);
check(
  "Mang lech do dai -> lay do dai ngan hon (khong NaN)",
  smoothLevels([0], [0.5, 0.5]).length === 1,
);
check(
  "levelToScale luon trong [MIN_SCALE, 1] va NaN -> MIN_SCALE",
  [0, 0.5, 1, 2, -1, Number.NaN].every((level) => {
    const scale = levelToScale(level);

    return scale >= VISUALIZER_MIN_SCALE && scale <= 1;
  }) && levelToScale(Number.NaN) === VISUALIZER_MIN_SCALE,
);

/* --------------------------- 6. Manh ghep giao dien + hook --------------------------- */

const component = read("src/components/player/now-playing-visualizer.tsx");
const fullPlayer = read("src/components/player/full-player.tsx");
const visualizerLib = read("src/lib/visualizer.ts");
const hook = read("src/hooks/use-visualizer-levels.ts");
const mediaQueryHook = read("src/hooks/use-media-query.ts");
const audioBridge = read("src/components/player/audio-source.ts");
const playerEngine = read("src/components/player/player-engine.tsx");
const css = read("src/app/globals.css");

check(
  "Chi hien tren desktop (hidden lg:block)",
  component.includes('"relative hidden w-full select-none lg:block"'),
);
check(
  "Chi CHAY tren desktop va tat khi may bat 'giam chuyen dong' (mac dinh ton trong cai dat)",
  component.includes("useIsDesktop") &&
    component.includes("usePrefersReducedMotion") &&
    component.includes("const motionBlocked = reduceMotion && !forceMotion") &&
    component.includes("const motionAllowed = isDesktop && !motionBlocked") &&
    component.includes("enabled: motionAllowed") &&
    mediaQueryHook.includes('"(min-width: 1024px)"') &&
    mediaQueryHook.includes('"(prefers-reduced-motion: reduce)"'),
);
check(
  "May bat 'giam chuyen dong' van co nut TU BAT hieu ung + nho lua chon",
  component.includes("Bật hiệu ứng") &&
    component.includes("setMotionOverride(true)") &&
    component.includes("readMotionOverride") &&
    component.includes('MOTION_STORAGE_KEY = "nhaccuahoiks-visualizer-motion"') &&
    component.includes('localStorage.setItem(MOTION_STORAGE_KEY, "on")'),
);
check(
  "Lua chon doc qua `useSyncExternalStore` (khong setState trong effect) + an toan SSR",
  component.includes("useSyncExternalStore(") &&
    component.includes("getMotionServerSnapshot") &&
    /* Bo chu thich truoc khi kiem: tai lieu CO NHAC `useEffect` de giai thich vi sao khong dung */
    !stripComments(component).includes("useEffect"),
);
check(
  "Nhan noi RO ly do dung yen (khong de nguoi dung tuong tinh nang hong)",
  component.includes("Máy đang bật “giảm chuyển động” — hiệu ứng tạm tắt"),
);
check(
  "Nut bam nam NGOAI vung aria-hidden (khong vi pham tro nang)",
  component.includes('<div aria-hidden="true" data-slot="now-playing-bars">') &&
    component.includes('data-slot="now-playing-visualizer-status"') &&
    component.indexOf('data-slot="now-playing-bars"') <
      component.indexOf('data-slot="now-playing-visualizer-status"'),
);
check(
  "LUOI AN TOAN: vong lap JS chua cho muc nao ma nhac dang chay -> van nhun bang keyframe equalize",
  component.includes('const cssFallback = isPlaying && motionAllowed && mode === "idle"') &&
    component.includes('cssFallback && "animate-equalize"') &&
    component.includes('transform: cssFallback ? "none" :') &&
    css.includes("@keyframes equalize") &&
    css.includes("--animate-equalize: equalize"),
);
check(
  "Ve bang `transform: scaleY` + goc day cot (chay tren GPU, khong re-render React)",
  component.includes("scaleY(${levelToScale(") &&
    component.includes("origin-bottom") &&
    component.includes("bar.style.transform"),
);
check(
  "Khong dung Math.random (nguyen nhan lech hydration)",
  !stripComments(component).includes("Math.random") &&
    !stripComments(visualizerLib).includes("Math.random") &&
    !stripComments(hook).includes("Math.random"),
);
check(
  "Trang tri -> aria-hidden (khong doc hang chuc cot cho trinh doc man hinh)",
  component.includes('aria-hidden="true"'),
);
check(
  "Dung mau thuong hieu gradient + nam trong luong trang cua trinh phat day du",
  component.includes("bg-gradient-brand") && fullPlayer.includes("<NowPlayingVisualizer />"),
);
check(
  "Noi ro song dang bam vao dau ('Sóng theo nhạc' / 'Nhịp theo bài hát')",
  component.includes('"Sóng theo nhạc"') && component.includes('"Nhịp theo bài hát"'),
);

/* --------------- 7. Phan tich am thanh: captureStream, KHONG reroute am thanh --------------- */

check(
  "Phan tich am thanh that bang `captureStream()` (sao chep luong) + `createMediaStreamSource`",
  hook.includes("captureStream") && hook.includes("createMediaStreamSource"),
);
check(
  "TUYET DOI khong dung `createMediaElementSource` (lam mat kha nang nghe khi app ra nen)",
  !stripComments(hook).includes("createMediaElementSource") &&
    !stripComments(component).includes("createMediaElementSource") &&
    hook.includes("needsWebAudioGraph"),
);
check(
  "Analyser KHONG duoc noi vao loa (neu noi se nghe hai lan)",
  !stripComments(hook).includes("context.destination"),
);
check(
  "Trinh duyet khong ho tro captureStream (Safari) -> tu roi ve nhip mo phong, khong loi",
  hook.includes('typeof media.captureStream !== "function"') && hook.includes("allowSpectrum = false"),
);
check(
  "Im lang bat thuong (luong bi chan) -> bo phan tich, quay ve nhip mo phong",
  hook.includes("SILENT_FRAMES_LIMIT") && hook.includes("silentFrames"),
);
check(
  "Chi doc pho cua file noi bo (UPLOADED) - nguon nhung nam trong iframe khac mien",
  hook.includes('state.current?.sourceType === "UPLOADED"'),
);

/* ------------------- 8. Vong lap ve: tiet kiem pin, khong re-render, don sach ------------------- */

check(
  "Vong lap dung requestAnimationFrame va huy khi unmount",
  hook.includes("window.requestAnimationFrame") && hook.includes("window.cancelAnimationFrame"),
);
check(
  "Khong ve khi trang bi an + tam dung bo doc pho (tiet kiem pin)",
  hook.includes('document.visibilityState === "hidden"') && hook.includes("spectrum?.suspend()"),
);
check(
  "Doc trang thai qua `getState()` moi khung hinh (khong re-render React 60 lan/giay)",
  hook.includes("usePlayerStore.getState()") && !hook.includes("usePlayerStore(("),
);
check(
  "Nhip mo phong canh lai theo vi tri bai hat khi nguoi dung tua",
  hook.includes("SEEK_JUMP_SECONDS") && hook.includes("beatMs = (seconds * 1000) % VISUALIZER_BEAT_MS"),
);
check(
  "Cau noi the <audio>: PlayerEngine dang ky, hook theo doi",
  audioBridge.includes("registerAudioElement") &&
    audioBridge.includes("watchAudioElement") &&
    playerEngine.includes("registerAudioElement(audioRef.current)") &&
    hook.includes("watchAudioElement(ensureSpectrum)"),
);
check(
  "Tat khi 'giam chuyen dong' bang ca CSS (quang sang) lan JS (vong lap)",
  /prefers-reduced-motion[\s\S]{0,900}\.animate-pulse-glow/.test(css),
);
check(
  "Co ghi chu vi sao chi desktop va vi sao khong dung createMediaElementSource",
  component.includes("CHỈ hiện trên desktop") && visualizerLib.includes("createMediaElementSource"),
);
check(
  "README ghi lai hanh vi (phan tich that cho file noi bo, nhip mo phong cho nguon nhung) + lenh kiem",
  read("README.md").includes("captureStream") &&
    read("README.md").includes("Nhịp theo bài hát") &&
    read("README.md").includes("check:visualizer"),
);

/* ---------------------------------- Ket qua ---------------------------------- */

const failures = results.filter((line) => line.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
process.exitCode = failures.length === 0 ? 0 : 1;
