/**
 * Kiem tra bang mau dung cho CA HAI giao dien (sang / toi):
 *   npx tsx scripts/verify-theme.ts
 *
 * Cac loi da tung gap:
 * - Token chi dinh nghia o giao dien sang -> giao dien toi dung gia tri sai (chu trang tren nen nhat).
 * - Badge `default` dat chu trang tren nen tim nhat -> mat chu o giao dien sang.
 * - Canh bao dung mau bang nhat (`text-amber-200/300`) ma khong co bien the `dark:` -> mat chu o giao dien sang.
 * - Mau nguon phat (bieu do) de nguyen mau thuong hieu -> cyan/cam tren nen trang rat kho nhin.
 * - `theme-color` cua trinh duyet luon la mau toi -> thanh trinh duyet le mau tren giao dien sang.
 * - Khung video bi lech do `transform`/`translate` (xem `check:video`) - khong lien quan mau.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

/* ---------------------------------- Doc file CSS ------------------------------- */

const root = process.cwd();
const css = readFileSync(path.join(root, "src", "app", "globals.css"), "utf8");

function cssBlock(pattern: RegExp): string {
  const match = css.match(pattern);
  if (!match) throw new Error(`Khong tim thay khoi CSS: ${pattern}`);
  return match[1];
}

function tokensOf(body: string): Map<string, string> {
  const tokens = new Map<string, string>();

  for (const match of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(match[1], match[2].trim());
  }

  return tokens;
}

const lightTokens = tokensOf(cssBlock(/(?:^|\n):root\s*\{([\s\S]*?)\n\}/));
const darkTokens = tokensOf(cssBlock(/\n\.dark\s*\{([\s\S]*?)\n\}/));
const themeBlock = cssBlock(/@theme inline\s*\{([\s\S]*?)\n\}/);

/* ---------------------------- 1. Du token o ca hai giao dien -------------------- */

/** `--radius` chi can o `:root` vi la kich thuoc dung chung, khong doi theo giao dien */
const SHARED_TOKENS = new Set(["--radius"]);

const missingInDark = [...lightTokens.keys()].filter(
  (token) => !SHARED_TOKENS.has(token) && !darkTokens.has(token),
);
const missingInLight = [...darkTokens.keys()].filter((token) => !lightTokens.has(token));

check(
  "Giao dien toi dinh nghia du token cua giao dien sang",
  missingInDark.length === 0,
  missingInDark.join(", "),
);
check(
  "Giao dien sang dinh nghia du token cua giao dien toi",
  missingInLight.length === 0,
  missingInLight.join(", "),
);
check(
  "Hai giao dien cung so luong token",
  lightTokens.size === darkTokens.size + SHARED_TOKENS.size,
  `sang ${lightTokens.size} | toi ${darkTokens.size}`,
);

/* ------------------------- 2. Alias trong @theme tro toi token that -------------- */

const brokenAliases: string[] = [];
let aliasCount = 0;

for (const match of themeBlock.matchAll(/(--color-[a-z0-9-]+)\s*:\s*var\((--[a-z0-9-]+)\)/g)) {
  aliasCount += 1;
  const [, alias, target] = match;

  if (!lightTokens.has(target) || !darkTokens.has(target)) {
    brokenAliases.push(`${alias} -> ${target}`);
  }
}

check(
  "Moi alias `--color-*` trong @theme tro toi token co that",
  brokenAliases.length === 0,
  brokenAliases.join(", "),
);
check("Co alias mau cho Tailwind doc", aliasCount >= 30, `so alias: ${aliasCount}`);

/* ------------------------------- 3. Do tuong phan WCAG -------------------------- */

interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(value: string): Rgb | null {
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].replace(/./g, (char) => char + char) : hex[1];
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgb = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(/[,/]/).map((part) => Number.parseFloat(part.trim()));
    if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  }

  return null;
}

/** Dua mau trong suot ve mau dac (trai len nen) de tinh duoc do tuong phan */
function flatten(color: Rgb, background: Rgb): Rgb {
  if (color.a >= 1) return color;

  return {
    r: color.r * color.a + background.r * (1 - color.a),
    g: color.g * color.a + background.g * (1 - color.a),
    b: color.b * color.a + background.b * (1 - color.a),
    a: 1,
  };
}

function luminance(color: Rgb): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

function contrast(a: Rgb, b: Rgb): number {
  const first = luminance(a);
  const second = luminance(b);

  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** [mau chu/phan tu, mau nen, nguong]: chu thuong 4.5, chu tieu de 7, mau trang tri 3, vien 1.1 */
const CONTRAST_PAIRS: [string, string, number][] = [
  ["--foreground", "--background", 7],
  ["--foreground", "--card", 7],
  ["--foreground", "--surface", 7],
  ["--card-foreground", "--card", 7],
  ["--popover-foreground", "--popover", 7],
  ["--muted-foreground", "--background", 4.5],
  ["--muted-foreground", "--card", 4.5],
  ["--secondary-foreground", "--secondary", 4.5],
  ["--accent-foreground", "--accent", 4.5],
  ["--primary-foreground", "--primary", 4.5],
  ["--destructive-foreground", "--destructive", 4.5],
  ["--primary", "--background", 4.5],
  ["--success", "--background", 4.5],
  ["--warning", "--background", 4.5],
  ["--destructive", "--background", 4.5],
  ["--primary-soft-foreground", "--primary-soft", 4.5],
  ["--success-soft-foreground", "--success-soft", 4.5],
  ["--warning-soft-foreground", "--warning-soft", 4.5],
  ["--destructive-soft-foreground", "--destructive-soft", 4.5],
  ["--source-youtube", "--card", 3],
  ["--source-soundcloud", "--card", 3],
  ["--source-tiktok", "--card", 3],
  ["--source-uploaded", "--card", 3],
  ["--brand", "--background", 3],
  ["--brand-alt", "--background", 3],
  ["--brand-sky", "--background", 3],
  /*
   * Nut/logo/avatar dung `bg-gradient-brand` + CHU TRANG (khong dung `--primary-foreground`):
   * moi moc gradient phai du tuong phan voi chu trang o CA HAI giao dien - day la ly do
   * 2 moc gradient (`--brand-grad-*`) duoc chon dam hon mau chu dao #3A80F6.
   */
  ["#ffffff", "--brand-grad-from", 4.5],
  ["#ffffff", "--brand-grad-to", 4.5],
  /*
   * LUU Y: KHONG dat chu trang truc tiep tren mau phang `--brand` (#3A80F6):
   * tuong phan chi 3.75 (< 4.5). Vut/logo/nhan dung `bg-gradient-brand` (2 moc dam hon)
   * hoac `--primary` (ban dam cua mau chu dao o giao dien sang).
   */
  ["--border", "--card", 1.1],
  ["--border-strong", "--card", 1.1],
];

for (const [themeName, tokens] of [
  ["sang", lightTokens],
  ["toi", darkTokens],
] as const) {
  const failures: string[] = [];

  for (const [foregroundToken, backgroundToken, minimum] of CONTRAST_PAIRS) {
    // Cho phep dung mau literal (vi du "#ffffff") ben canh token
    const foregroundValue = foregroundToken.startsWith("#")
      ? foregroundToken
      : tokens.get(foregroundToken);
    const backgroundValue = backgroundToken.startsWith("#")
      ? backgroundToken
      : tokens.get(backgroundToken);

    if (!foregroundValue || !backgroundValue) {
      failures.push(`${foregroundToken}/${backgroundToken}: thieu token`);
      continue;
    }

    const foreground = parseColor(foregroundValue);
    const background = parseColor(backgroundValue);

    if (!foreground || !background) {
      failures.push(`${foregroundToken}/${backgroundToken}: khong doc duoc mau`);
      continue;
    }

    const base = parseColor(tokens.get("--background") ?? "#ffffff") ?? background;
    const solid = flatten(background, base);
    const ratio = contrast(flatten(foreground, solid), solid);

    if (ratio < minimum) {
      failures.push(`${foregroundToken}/${backgroundToken} = ${ratio.toFixed(2)} (can ${minimum})`);
    }
  }

  check(
    `Tuong phan mau giao dien ${themeName} dat nguong WCAG`,
    failures.length === 0,
    failures.join(" | "),
  );
}

/* ------------------------ 4. Quet mau bang "nhat" trong ma nguon ----------------- */

function collectFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);

    if (statSync(full).isDirectory()) {
      if (entry === "generated") continue;
      files.push(...collectFiles(full));
      continue;
    }

    if (/\.(tsx|ts)$/.test(entry)) files.push(full);
  }

  return files;
}

/** Mau bang rat nhat (50..300) chi hop voi nen toi -> bat buoc phai co bien the `dark:` */
const LIGHT_ONLY_TEXT =
  /text-(?:amber|emerald|rose|red|sky|violet|pink|cyan|blue|green|yellow|orange|lime|teal|indigo|purple|fuchsia)-(?:50|100|200|300)\b/;

/** Mau trang cung dinh cung chi hop voi nen toi */
const HARDCODED_WHITE = /\b(?:bg|border)-white\//;

const offenders: string[] = [];

for (const file of [
  ...collectFiles(path.join(root, "src", "components")),
  ...collectFiles(path.join(root, "src", "app")),
]) {
  const relative = path.relative(root, file).replace(/\\/g, "/");

  for (const literal of readFileSync(file, "utf8").match(/"[^"\n]*"|`[^`\n]*`/g) ?? []) {
    if (literal.includes("dark:")) continue;

    const badText = literal.match(LIGHT_ONLY_TEXT);
    const badWhite = literal.match(HARDCODED_WHITE);

    if (badText) offenders.push(`${relative}: ${badText[0]}`);
    else if (badWhite) offenders.push(`${relative}: ${badWhite[0]}`);
  }
}

check(
  "Khong con mau bang nhat / mau trang cung dinh thieu bien the `dark:`",
  offenders.length === 0,
  offenders.slice(0, 8).join(" | "),
);

/* ------------------------- 5. theme-color cua trinh duyet ----------------------- */

const rootLayout = readFileSync(path.join(root, "src", "app", "layout.tsx"), "utf8");
check(
  "theme-color co ca ban sang lan ban toi (khong le mau thanh trinh duyet)",
  rootLayout.includes("prefers-color-scheme: light") &&
    rootLayout.includes("prefers-color-scheme: dark"),
);

/* ------------------------- 6. Mau chu dao #3A80F6 duoc dung dong bo --------------------- */

const brandHex = "#3a80f6";

check(
  "Mau chu dao #3A80F6 co mat o CA HAI giao dien (--brand)",
  lightTokens.get("--brand")?.toLowerCase() === brandHex &&
    darkTokens.get("--brand")?.toLowerCase() === brandHex,
  `sang ${lightTokens.get("--brand")} | toi ${darkTokens.get("--brand")}`,
);
check(
  "Giao dien toi dung dung mau chu dao cho `--primary`",
  darkTokens.get("--primary")?.toLowerCase() === brandHex,
  String(darkTokens.get("--primary")),
);
check(
  "Giao dien sang dung sac dam cua mau chu dao cho `--primary` (du tuong phan chu)",
  ["#2563eb", "#1d4ed8", "#1e40af"].includes((lightTokens.get("--primary") ?? "").toLowerCase()),
  String(lightTokens.get("--primary")),
);
check(
  "Bo token `--neon-*` cu da duoc thay hoan toan bang `--brand*`",
  ![...lightTokens.keys(), ...darkTokens.keys()].some((token) => token.startsWith("--neon-")) &&
    !css.includes("--neon-"),
);
check(
  "`--ring` (vong focus) dung mau chu dao",
  lightTokens.get("--ring")?.toLowerCase() === brandHex &&
    darkTokens.get("--ring")?.toLowerCase() === brandHex,
);
check(
  "Manifest PWA dung mau chu dao",
  readFileSync(path.join(root, "public", "manifest.webmanifest"), "utf8")
    .toLowerCase()
    .includes(brandHex),
);
check(
  "Logo (favicon) dung ho mau xanh cua chu dao, khong con mau tim/hong cu",
  !readFileSync(path.join(root, "public", "logo.svg"), "utf8").includes("#8b5cf6") &&
    readFileSync(path.join(root, "public", "logo.svg"), "utf8").includes("#3a80f6"),
);

/** Khong con mau thuong hieu cu nam rai rac trong ma nguon */
const OLD_BRAND_HEXES = ["#7c3aed", "#8b5cf6", "#db2777", "#0e7490", "#ec4899", "#22d3ee"];
const leftovers: string[] = [];

for (const file of [
  ...collectFiles(path.join(root, "src")),
  ...collectFiles(path.join(root, "scripts")),
]) {
  const relative = path.relative(root, file).replace(/\\/g, "/");
  if (relative.includes("generated/")) continue;
  // Bo qua chinh script nay (no chua danh sach ma mau cu de di tim)
  if (relative === "scripts/verify-theme.ts") continue;

  const content = readFileSync(file, "utf8").toLowerCase();
  for (const hex of OLD_BRAND_HEXES) {
    if (content.includes(hex)) leftovers.push(`${relative}: ${hex}`);
  }
}

check(
  "Khong con ma mau thuong hieu cu trong ma nguon",
  leftovers.length === 0,
  leftovers.slice(0, 8).join(" | "),
);
check(
  "Bien `--brand` / `--brand-alt` / `--brand-sky` duoc khai bao cho Tailwind",
  ["--color-brand", "--color-brand-alt", "--color-brand-sky"].every((alias) =>
    themeBlock.includes(alias),
  ),
);

/* ---------------------- 7. He thong thiet ke dung lai (design system) ------------- */

/** Utility phai co trong globals.css de moi component dung chung mot "card primitive" */
const DESIGN_UTILITIES = [
  "card-surface",
  "lift",
  "art-frame",
  "hero-mesh",
  "hairline",
  "chip-glass",
  "equalize-bars",
  "glow-brand",
];

const missingUtilities = DESIGN_UTILITIES.filter((name) => !css.includes("." + name));
check(
  "globals.css co du utility dung lai cua he thong thiet ke",
  missingUtilities.length === 0,
  missingUtilities.join(", "),
);

/*
 * Loi that: `bg-gradient-brand` tung khai bao trong `@layer components` (khong phai `@utility`)
 * nen Tailwind v4 KHONG sinh duoc bien the `data-[state=checked]:bg-gradient-brand` - class
 * thuong trong lop components khong duoc ap bien the. Hau qua: o tick (thu vien nhac, playlist,
 * lich su nghe) o giao dien SANG giu nen `bg-surface/70` (gan trang) nhung dau tich lai mau
 * trang (`text-white`) => nguoi dung khong thay dau tích, chi giao dien toi moi thay.
 */
check(
  "Utility `bg-gradient-brand` khai bao bang @utility (de dung duoc voi bien the)",
  /@utility\s+bg-gradient-brand\s*\{/.test(css) &&
    !/@layer components\s*\{[\s\S]*?\.bg-gradient-brand\s*\{/.test(css),
);
check(
  "Checkbox dung `data-[state=checked]:bg-gradient-brand` (dau tich trang tren nen gradient)",
  readFileSync(path.join(root, "src", "components", "ui", "checkbox.tsx"), "utf8").includes(
    "data-[state=checked]:bg-gradient-brand",
  ),
);

check(
  "Co 4 cap do bong o CA HAI giao dien (soft/card/float/brand)",
  ["--elev-soft", "--elev-card", "--elev-float", "--elev-brand"].every(
    (token) => lightTokens.has(token) && darkTokens.has(token),
  ),
);
check(
  "Do bong duoc alias cho Tailwind (shadow-soft/card/float/brand)",
  ["--shadow-soft", "--shadow-card", "--shadow-float", "--shadow-brand"].every((alias) =>
    themeBlock.includes(alias),
  ),
);
check(
  "Co chuyen dong fade-up (section hien dan) va shimmer (khung xuong)",
  css.includes("@keyframes fade-up") &&
    css.includes("@keyframes shimmer") &&
    themeBlock.includes("--animate-fade-up") &&
    themeBlock.includes("--animate-shimmer"),
);

/* Cac component da dung chung utility thay vi tu viet CSS rieng */
const AUDIT_FILES: [string, string[]][] = [
  ["src/components/music/song-card.tsx", ["card-surface", "art-frame", "lift", "equalize-bars"]],
  ["src/components/music/playlist-card.tsx", ["card-surface", "art-frame", "lift"]],
  ["src/components/music/song-row.tsx", ["art-frame", "equalize-bars"]],
  ["src/components/music/section-header.tsx", ["hairline"]],
  ["src/components/music/hero-highlight.tsx", ["art-frame", "chip-glass", "equalize-bars"]],
  ["src/app/music/page.tsx", ["hero-mesh", "SectionHeader", "HeroHighlight"]],
  ["src/components/layout/app-sidebar.tsx", ["navSectionsFor", "aria-current", "hairline"]],
  ["src/components/layout/page-skeleton.tsx", ["animate-shimmer", "card-surface"]],
];

const auditProblems: string[] = [];

for (const [file, needles] of AUDIT_FILES) {
  const content = readFileSync(path.join(root, file), "utf8");
  for (const needle of needles) {
    if (!content.includes(needle)) auditProblems.push(`${file}: thieu ${needle}`);
  }
}

check(
  "Cac component dung chung he thong thiet ke (khong tu viet CSS rieng)",
  auditProblems.length === 0,
  auditProblems.slice(0, 8).join(" | "),
);
check(
  "Trang chu co the 'phat nhanh' bai noi bat (trang chu chinh la san pham)",
  readFileSync(path.join(root, "src", "app", "music", "page.tsx"), "utf8").includes(
    "listTopSongs",
  ) &&
    readFileSync(path.join(root, "src", "components", "music", "hero-highlight.tsx"), "utf8").includes(
      "playQueue",
    ),
);

/* ------------------------------- 8. Rieng cho dien thoai -------------------------- */

const songCardSource = readFileSync(
  path.join(root, "src", "components", "music", "song-card.tsx"),
  "utf8",
);
const playlistCardSource = readFileSync(
  path.join(root, "src", "components", "music", "playlist-card.tsx"),
  "utf8",
);
const homeSource = readFileSync(path.join(root, "src", "app", "music", "page.tsx"), "utf8");
const sectionHeaderSource = readFileSync(path.join(root, "src", "components", "music", "section-header.tsx"), "utf8");
const heroSource = readFileSync(
  path.join(root, "src", "components", "music", "hero-highlight.tsx"),
  "utf8",
);

check(
  "Nut phat tren the bai nhac hien san tren dien thoai (khong phu thuoc hover)",
  songCardSource.includes("translate-y-0") &&
    songCardSource.includes("opacity-100") &&
    songCardSource.includes("sm:group-hover:opacity-100"),
);
check(
  "Nut phat tren the playlist cung vay",
  playlistCardSource.includes("sm:group-hover:opacity-100") &&
    playlistCardSource.includes("opacity-100"),
);
check(
  "Watermark hero nho hon tren man hinh hep (size-40 -> sm:size-56)",
  homeSource.includes("size-40 rounded-[2rem] sm:size-56"),
);
check(
  "Nut hanh dong chinh cao >= 44px tren dien thoai (h-11 sm:h-10)",
  homeSource.split("h-11 w-full rounded-full sm:h-10 sm:w-auto").length - 1 === 3 &&
    heroSource.includes("h-9 rounded-full px-3.5 sm:h-8"),
);
/*
 * Loi that da gap tren dien thoai: `flex-1` (flex-basis: 0) trong mot hang `flex-wrap`
 * khong lam nut xuong dong - nut chi tran ra ngoai khung roi bi hero `overflow-hidden` cat.
 * Vi vay tren dien thoai nut phai la `w-full` (xep doc), chi tu dong rong o man hinh lon.
 */
check("Hang CTA trong hero khong dung flex-1 (tran ngang tren dien thoai)", !homeSource.includes("flex-1 rounded-full"));
check(
  "Cot hero co min-w-0 (grid item khong bi keo rong theo min-content cua con)",
  homeSource.includes("min-w-0 space-y-4") &&
    homeSource.includes("w-full min-w-0 lg:max-w-md lg:justify-self-end"),
);
check(
  "Tieu de shelf xuong dong tren man hinh hep thay vi bi cat (line-clamp-2)",
  sectionHeaderSource.includes("line-clamp-2") && sectionHeaderSource.includes("sm:truncate"),
);
check(
  "Nhan nguon phat trong the noi bat co lai duoc tren man hinh hep",
  heroSource.includes("min-w-0 flex-1 truncate text-[10px]"),
);

check(
  "Ngan keo mobile dung 100dvh (khong bi thanh dia chi che)",
  readFileSync(path.join(root, "src", "components", "layout", "app-sidebar.tsx"), "utf8").includes(
    "100dvh",
  ),
);
check(
  "Ton trong cai dat giam chuyen dong cua he dieu hanh (prefers-reduced-motion)",
  css.includes("@media (prefers-reduced-motion: reduce)") &&
    /prefers-reduced-motion[\s\S]{0,400}animation: none !important/.test(css),
);
check(
  "Vung an toan cho iPhone (safe-area) van duoc dung",
  css.includes(".safe-bottom") && css.includes(".safe-top"),
);

/* ------------------------------ 9. Dashboard quan tri ----------------------------- */

const adminDashboardSource = readFileSync(path.join(root, "src", "app", "admin", "page.tsx"), "utf8");
const adminCardsSource = readFileSync(
  path.join(root, "src", "components", "admin", "dashboard-cards.tsx"),
  "utf8",
);
const adminChartsSource = readFileSync(path.join(root, "src", "components", "admin", "charts.tsx"), "utf8");

/*
 * Loi that tren dien thoai: header dat `flex-wrap justify-between` nen dong mo ta dai chay xuong
 * duoi hai nut hanh dong roi bi cat; 4 the so lieu xep 1 cot lam trang dai vai man hinh va rat thua.
 */
check(
  "Tong quan admin: tieu de + mo ta xep doc tren dien thoai (khong chung hang voi nut)",
  adminDashboardSource.includes("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between") &&
    adminDashboardSource.includes("line-clamp-2 text-sm text-muted-foreground sm:truncate"),
);
check(
  "Tong quan admin: hai nut hanh dong full-width tren dien thoai",
  adminDashboardSource.split("h-10 w-full justify-center sm:h-9 sm:w-auto").length - 1 === 2,
);
check(
  "Tong quan admin: luoi so lieu 2 cot ngay tren dien thoai",
  adminCardsSource.includes("grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4"),
);
/*
 * Loi that: the trong luoi co `min-width: auto`, chuoi `truncate` (nowrap) ben trong keo
 * min-content cua the len 403px trong khi man hinh chi con 358px -> ca trang bi tran ngang 29px.
 */
check(
  "Tong quan admin: moi the trong luoi deu min-w-0 (khong keo tran ngang)",
  (adminDashboardSource.match(/<Card className="card-surface min-w-0">/g) ?? []).length === 5 &&
    adminCardsSource.includes("card-surface relative min-w-0 overflow-hidden"),
);
check(
  "Tong quan admin: bieu do 14 ngay co gian theo khung (khong con ep be rong toi thieu)",
  !adminChartsSource.includes("min-w-[560px]") &&
    !adminChartsSource.includes("overflow-x-auto") &&
    adminChartsSource.includes("preserveAspectRatio=\"none\"") &&
    adminChartsSource.includes("vectorEffect=\"non-scaling-stroke\""),
);
check(
  "Tong quan admin: bang xep hang cat duoc ten dai (min-w-0 + truncate)",
  adminChartsSource.includes("export function RankedList") &&
    adminChartsSource.includes("className=\"min-w-0 flex-1\""),
);

const failed = results.filter((line) => line.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\nTONG KET: ${results.length - failed.length} PASS / ${failed.length} FAIL`);
process.exitCode = failed.length === 0 ? 0 : 1;

