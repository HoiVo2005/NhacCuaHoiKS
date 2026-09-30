/**
 * Kiem chung hieu ung song nhac o phan chi tiet bai hat (trinh phat day du):
 *   npx tsx scripts/verify-visualizer.ts
 *
 * Khoa lai ba dieu de khong lam hong lai:
 *  1. Hieu ung CHI hien tren desktop (`hidden lg:block`) - dien thoai khong phai chay 56 cot animation.
 *  2. Cau hinh cot phai THUAN TINH (khong `Math.random`) -> may chu va trinh duyet ve ra y het nhau
 *     (neu khong se lech hydration - React canh bao va hieu ung giat khi mo trinh phat).
 *  3. Hieu ung KHONG duoc dung Web Audio (`AnalyserNode`/`createMediaElementSource`): am thanh se bi
 *     iOS chan khi app ra nen - dung loi vua sua o `needsWebAudioGraph`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  VISUALIZER_BAR_COUNT,
  VISUALIZER_MAX_DELAY_MS,
  VISUALIZER_MAX_DURATION_MS,
  VISUALIZER_MIN_DURATION_MS,
  visualizerBars,
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

/* ------------------------------- 1. So cot va bien do ------------------------------- */

const bars = visualizerBars();

check(`So cot mac dinh la ${VISUALIZER_BAR_COUNT}`, bars.length === VISUALIZER_BAR_COUNT, String(bars.length));
check("Tat ca cot co gia tri hop le", bars.every((bar) =>
  Number.isFinite(bar.delayMs) &&
  Number.isFinite(bar.durationMs) &&
  Number.isFinite(bar.minHeightPercent) &&
  Number.isFinite(bar.opacity),
));
check(
  "Do tre nam trong 0.." + VISUALIZER_MAX_DELAY_MS + " ms",
  bars.every((bar) => bar.delayMs >= 0 && bar.delayMs <= VISUALIZER_MAX_DELAY_MS),
);
check(
  "Chu ky nhun nam trong khoang cho phep (khong cot nao nhun qua nhanh/cham)",
  bars.every(
    (bar) => bar.durationMs >= VISUALIZER_MIN_DURATION_MS && bar.durationMs <= VISUALIZER_MAX_DURATION_MS,
  ),
);
check(
  "Chieu cao luc nghi trong 16..62% (khong cot nao bang 0 -> khung song khong bi trong)",
  bars.every((bar) => bar.minHeightPercent >= 16 && bar.minHeightPercent <= 62),
);
check(
  "Do dam trong 0.25..1 (cot hai ben mo dan nhung van nhin thay)",
  bars.every((bar) => bar.opacity >= 0.25 && bar.opacity <= 1),
);

/* --------------------------- 2. Hinh dang "song" mong muon --------------------------- */

const tallest = Math.max(...bars.map((bar) => bar.minHeightPercent));
const centerIndex = Math.floor((bars.length - 1) / 2);
const edgeMinHeight = Math.min(bars[0].minHeightPercent, bars[bars.length - 1].minHeightPercent);
const edgeOpacity = Math.min(bars[0].opacity, bars[bars.length - 1].opacity);

check("Cot giua cao nhat (dang song)", bars[centerIndex].minHeightPercent === tallest);
check(
  "Hai mep thap hon cot giua (bien do giam dan)",
  edgeMinHeight < bars[centerIndex].minHeightPercent,
);
check(
  "Doi xung: hai cot cach deu tam co cung chieu cao",
  bars.every((bar, index) => bar.minHeightPercent === bars[bars.length - 1 - index].minHeightPercent),
);
check(
  "Do dam giam dan ra hai mep (van trong nguong nhin thay duoc)",
  bars[centerIndex].opacity > edgeOpacity && edgeOpacity >= 0.25,
  `giua=${bars[centerIndex].opacity} mep=${edgeOpacity}`,
);

/* ------------------------------ 3. Tinh thuan (hydration) ------------------------------ */

check(
  "Sinh lai cho ket qua GIONG HET (khong dung Math.random -> khong lech hydration)",
  JSON.stringify(visualizerBars()) === JSON.stringify(bars),
);
check(
  "Doi so cot duoc ton trong (dung cho man hinh hep hon)",
  visualizerBars(8).length === 8 && visualizerBars(1).length === 1,
);
check(
  "So cot khong hop le (0 / am) van tra ve it nhat 1 cot",
  visualizerBars(0).length === 1 && visualizerBars(-5).length === 1,
);
check("Mot cot duy nhat khong bi NaN", Number.isFinite(visualizerBars(1)[0].minHeightPercent));

/* ------------------------------- 4. Manh ghep giao dien ------------------------------- */

const component = read("src/components/player/now-playing-visualizer.tsx");
const fullPlayer = read("src/components/player/full-player.tsx");
const visualizerLib = read("src/lib/visualizer.ts");
const css = read("src/app/globals.css");

check(
  "Chi hien tren desktop (hidden lg:block) - dien thoai khong chay hieu ung",
  component.includes('"relative hidden w-full select-none lg:block"'),
);
check(
  "Dung keyframe `equalize` co san (nho vay tu tat khi nguoi dung bat giam chuyen dong)",
  component.includes("animate-equalize") && css.includes(".animate-equalize"),
);
check(
  "Co trong danh sach tat khi bat 'giam chuyen dong' cua he dieu hanh",
  /prefers-reduced-motion[\s\S]{0,600}\.animate-equalize/.test(css),
);
check(
  "Tam dung thi dung han animation (chi nhan `animate-equalize` khi dang phat)",
  component.includes("isPlaying && \"animate-equalize\""),
);
check(
  "Khong dung Web Audio (khong AnalyserNode/AudioContext) - tranh lam mat kha nang nghe khi ra nen",
  !component.includes("AudioContext") &&
    !component.includes("createMediaElementSource") &&
    !component.includes("AnalyserNode") &&
    visualizerLib.includes("needsWebAudioGraph"),
);
check(
  "Khong dung Math.random (nguyen nhan lech hydration)",
  !stripComments(component).includes("Math.random") &&
    !stripComments(visualizerLib).includes("Math.random"),
);
check(
  "Trang tri -> aria-hidden (khong doc 56 cot cho trinh doc man hinh)",
  component.includes('aria-hidden="true"'),
);
check(
  "Dung mau thuong hieu gradient + nam trong luong trang cua trinh phat day du",
  component.includes("bg-gradient-brand") && fullPlayer.includes("<NowPlayingVisualizer />"),
);
check(
  "Co ghi chu vi sao chi desktop va vi sao khong dung Web Audio",
  component.includes("CHỈ hiện trên desktop") && visualizerLib.includes("CHỈ desktop"),
);

/* ---------------------------------- Ket qua ---------------------------------- */

const failures = results.filter((line) => line.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
process.exitCode = failures.length === 0 ? 0 : 1;
