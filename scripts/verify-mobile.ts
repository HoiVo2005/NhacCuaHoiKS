import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Kiem chung quy tac "giao dien dien thoai": npx tsx scripts/verify-mobile.ts
 *
 * Loi de gap nhat tren dien thoai ma khong the thay khi test tren desktop:
 *  1. iOS/Safari TU PHONG TO trang khi cham vao o nhap lieu co `font-size` < 16px -> rat kho chiu
 *     khi nhap lieu (o tim kiem, o hen gio, form quan tri).
 *  2. Cach "sua" sai la dat `maximum-scale=1` trong viewport: no chan luon thao tac chum 2 ngon tay
 *     de phong to -> nguoi mat thi luc / nguoi lon tuoi khong doc duoc.
 *  3. Rule chong zoom phai nam NGOAI moi `@layer`, neu khong `.text-xs` cua Tailwind (do uu tien
 *     cao hon `input`) se thang va tinh nang tro nen vo hieu.
 */

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

const root = process.cwd();

function source(relativePath: string): string {
  return readFileSync(path.join(root, ...relativePath.split("/")), "utf8");
}

const css = source("src/app/globals.css");
const layout = source("src/app/layout.tsx");
const mobileHook = source("src/hooks/use-is-mobile.ts");

/**
 * Bo comment truoc khi kiem tra MA NGUON.
 *
 * Vi sao can: ghi chu giai thich "KHONG dat `maximumScale: 1`" cung chua chu `maximumScale`, neu
 * kiem tra tho se bao loi gia (dung da gap khi viet bo kiem nay).
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const layoutCode = stripComments(layout);

/* ------------------ 1. Chong zoom khi focus o nhap lieu (iOS) ------------------ */

const zoomBlockStart = css.indexOf("Chong ZOOM khi cham vao o nhap lieu");
const zoomMediaStart = css.indexOf("@media (max-width: 639px)", zoomBlockStart);
const zoomFontSize = css.indexOf("font-size: 16px;", zoomMediaStart);
const lastComponent = css.indexOf(".safe-top");

check(
  "Co rule chong zoom cho o nhap lieu tren man hinh nho (<= 639px)",
  zoomBlockStart > 0 && zoomMediaStart > zoomBlockStart && zoomFontSize > zoomMediaStart,
);
check(
  "Rule dat SAU phan `@layer components` (ngoai moi layer -> thang duoc utility `text-xs`)",
  zoomBlockStart > lastComponent,
  `zoom block @${zoomBlockStart} vs .safe-top @${lastComponent}`,
);
check(
  "Ap dung cho ca textarea va select (khong chi input)",
  css.slice(zoomMediaStart, zoomFontSize).includes("textarea") &&
    css.slice(zoomMediaStart, zoomFontSize).includes("select"),
);
check(
  "Loai tru cac loai khong phai o nhap chu (tick/radio/thanh truot/bang mau/nut/file)",
  ["checkbox", "radio", "range", "color", "file", "submit", "button", "reset", "image"].every(
    (type) => css.slice(zoomMediaStart, zoomFontSize).includes(`[type="${type}"]`),
  ),
);
check(
  "Ghi chu noi ro ly do (Safari tu phong to khi chu < 16px) de nguoi sau khong xoa nham",
  css.includes("Safari") && css.includes("16px") && css.includes("maximum-scale"),
);

/* ------------------ 2. Khong chan thao tac phong to 2 ngon tay ------------------ */

check(
  "KHONG dung `maximumScale` / `userScalable: false` (giu kha nang chum 2 ngon tay de phong to)",
  !layoutCode.includes("maximumScale") && !layoutCode.includes("userScalable"),
);
check(
  "Van giu `initialScale: 1` + `width: device-width`",
  layoutCode.includes("initialScale: 1") && layoutCode.includes('width: "device-width"'),
);
check(
  "Layout ghi chu ro vi sao khong chan zoom (de khong bi them lai)",
  layout.includes("KHONG dat `maximumScale: 1`") && layout.includes("globals.css"),
);

/* ------------------ 3. Nhan dien dien thoai dung breakpoint `sm` ------------------ */

check(
  "Hook nhan dien mobile trung breakpoint `sm` (640px) cua Tailwind",
  mobileHook.includes('"(max-width: 639px)"'),
);
check(
  "Hook co gia tri rieng cho SSR (tranh lech hydration khi render tren server)",
  mobileHook.includes("getServerSnapshot") && mobileHook.includes("useSyncExternalStore"),
);

/* --------------------------------- Ket qua --------------------------------- */

const failed = results.filter((line) => line.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\nTONG KET: ${results.length - failed.length} PASS / ${failed.length} FAIL`);
process.exitCode = failed.length === 0 ? 0 : 1;
