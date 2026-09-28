import { readFileSync } from "node:fs";
import path from "node:path";

import {
  isInsideOverlay,
  isTypingTarget,
  keysLabel,
  PLAYER_SHORTCUTS,
  resolveShortcut,
  SEEK_STEP_SECONDS,
  shortcutGroups,
  VOLUME_STEP_RATIO,
} from "@/lib/player-shortcuts";
import { openQuickSearch, registerQuickSearch } from "@/lib/quick-search";

/**
 * Kiem chung phim tat trinh phat: npx tsx scripts/verify-shortcuts.ts
 *  1. Doi phim -> hanh dong (ke ca cac truong hop PHAI BO QUA: dang go chu, dang mo hop thoai,
 *     co giu Ctrl/Cmd/Alt) - day la phan de lam nguoi dung kho chiu nhat neu sai.
 *  2. Bang tro giup du va khop voi cac hanh dong ma component thuc su xu ly.
 *  3. Cac manh ghep con nguyen (component mount o layout goc, store co trang thai, nut tren thanh phat).
 */

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

/** Vung trung tinh: khong phai o nhap lieu, khong nam trong hop thoai */
const plainTarget = { tagName: "DIV", closest: () => null } as unknown as EventTarget;
/** O nhap lieu / vung soan thao */
const typingTarget = (tagName: string) => ({ tagName, closest: () => null }) as unknown as EventTarget;
/** Phan tu nam trong hop thoai Radix */
const overlayTarget = {
  tagName: "DIV",
  closest: (selector: string) => (selector.includes("dialog") ? {} : null),
} as unknown as EventTarget;

function key(combo: string, extra: Record<string, boolean> = {}) {
  return { key: combo, ...extra };
}

/* --------------------------- 1. Phim -> hanh dong ---------------------------- */

check("Space = phat / tam dung", resolveShortcut(key(" "), plainTarget) === "playPause");
check("Space cua trinh duyet cu = phat / tam dung", resolveShortcut(key("Spacebar"), plainTarget) === "playPause");
check("Mui ten phai = tua tới", resolveShortcut(key("ArrowRight"), plainTarget) === "seekForward");
check("Mui ten trai = tua lai", resolveShortcut(key("ArrowLeft"), plainTarget) === "seekBack");
check(
  "Shift + mui ten phai = bai tiep theo",
  resolveShortcut(key("ArrowRight", { shiftKey: true }), plainTarget) === "next",
);
check(
  "Shift + mui ten trai = bai truoc",
  resolveShortcut(key("ArrowLeft", { shiftKey: true }), plainTarget) === "previous",
);
check("Mui ten len = tang am luong", resolveShortcut(key("ArrowUp"), plainTarget) === "volumeUp");
check("Mui ten xuong = giam am luong", resolveShortcut(key("ArrowDown"), plainTarget) === "volumeDown");
check("Dau hoi = mo bang phim tat", resolveShortcut(key("?"), plainTarget) === "help");

check("M = tat/bat tieng", resolveShortcut(key("m"), plainTarget) === "mute");
check("M hoa (co Shift) van hieu", resolveShortcut(key("M"), plainTarget) === "mute");
check("S = phat ngau nhien", resolveShortcut(key("s"), plainTarget) === "shuffle");
check("R = doi che do lap", resolveShortcut(key("r"), plainTarget) === "repeat");
check("L = yeu thich bai dang phat", resolveShortcut(key("l"), plainTarget) === "favorite");
check("Y = mo/dong loi bai hat (karaoke)", resolveShortcut(key("y"), plainTarget) === "lyrics");
check("Q = hang cho", resolveShortcut(key("q"), plainTarget) === "queue");
check("F = trinh phat day du", resolveShortcut(key("f"), plainTarget) === "fullPlayer");

check("Phim khac (x) khong bi hieu nham", resolveShortcut(key("x"), plainTarget) === null);
check("Enter khong phai phim tat trinh phat", resolveShortcut(key("Enter"), plainTarget) === null);
check("Escape de lop phu/trinh duyet xu ly", resolveShortcut(key("Escape"), plainTarget) === null);
check("Tab khong bi chan", resolveShortcut(key("Tab"), plainTarget) === null);

check("Ctrl + phim KHONG kich hoat trinh phat", resolveShortcut(key("m", { ctrlKey: true }), plainTarget) === null);
check(
  "Cmd + phim KHONG kich hoat trinh phat",
  resolveShortcut(key("ArrowRight", { metaKey: true }), plainTarget) === null,
);
check(
  "Alt + phim KHONG kich hoat trinh phat",
  resolveShortcut(key("ArrowUp", { altKey: true }), plainTarget) === null,
);

/* --------------------- 1b. Tim kiem nhanh (⌘/Ctrl + K) --------------------- */
/*
 * Phim nay co giu Ctrl/Cmd nen phai duoc kiem tra TRUOC luat "giu Ctrl/Cmd thi bo qua".
 * No cung la lenh toan cuc: dang go o nhap lieu van phai mo duoc (giong Slack/YouTube).
 */

check(
  "Cmd + K = mo o tim kiem nhanh",
  resolveShortcut(key("k", { metaKey: true }), plainTarget) === "quickSearch",
);
check(
  "Ctrl + K = mo o tim kiem nhanh",
  resolveShortcut(key("k", { ctrlKey: true }), plainTarget) === "quickSearch",
);
check(
  "Ctrl + K khi dang go trong o nhap lieu VAN mo duoc (lenh toan cuc)",
  resolveShortcut(key("k", { ctrlKey: true }), typingTarget("INPUT")) === "quickSearch",
);
check(
  "Ctrl + Shift + K (phim cua trinh duyet) khong bi chiem",
  resolveShortcut(key("K", { ctrlKey: true, shiftKey: true }), plainTarget) === null,
);
check(
  "Ctrl + Alt + K khong bi chiem",
  resolveShortcut(key("k", { ctrlKey: true, altKey: true }), plainTarget) === null,
);
check(
  "Trong hop thoai thi nhuong phim tim kiem cho lop phu",
  resolveShortcut(key("k", { ctrlKey: true }), overlayTarget) === null,
);
check(
  "Bang tro giup co liet ke phim tim kiem nhanh",
  PLAYER_SHORTCUTS.some((item) => item.action === "quickSearch"),
);

/* Cau noi den o tim kiem: khong duoc nem loi khi trang khong co o tim kiem */
const quickSearchCalls: string[] = [];
registerQuickSearch(() => quickSearchCalls.push("focus"));
check("openQuickSearch() goi dung ham da dang ky", openQuickSearch() && quickSearchCalls.length === 1);
registerQuickSearch(null);
check(
  "Trang khong co o tim kiem -> tra ve false (khong nem loi)",
  openQuickSearch() === false,
);

/* ---------------------------- 2. Truong hop bo qua --------------------------- */

check("Dang go trong o input -> bo qua", resolveShortcut(key(" "), typingTarget("INPUT")) === null);
check("Dang go trong textarea -> bo qua", resolveShortcut(key("s"), typingTarget("TEXTAREA")) === null);
check("Dang o select -> bo qua", resolveShortcut(key("ArrowDown"), typingTarget("SELECT")) === null);
check(
  "Vung soan thao (contenteditable) -> bo qua",
  resolveShortcut(
    key("m"),
    { tagName: "DIV", isContentEditable: true, closest: () => null } as unknown as EventTarget,
  ) === null,
);
check("Nam trong hop thoai Radix -> bo qua (uu tien lop phu)", resolveShortcut(key(" "), overlayTarget) === null);
check(
  "Nam trong menu Radix -> bo qua (mui ten thuoc ve menu)",
  resolveShortcut(
    key("ArrowDown"),
    {
      tagName: "DIV",
      closest: (selector: string) => (selector.includes("menu") ? {} : null),
    } as unknown as EventTarget,
  ) === null,
);
check("Khong co target (window) van hoat dong", resolveShortcut(key(" "), null) === "playPause");
check(
  "isTypingTarget nhan dung o nhap lieu",
  isTypingTarget(typingTarget("INPUT")) && !isTypingTarget(plainTarget),
);
check("isInsideOverlay nhan dung lop phu", isInsideOverlay(overlayTarget) && !isInsideOverlay(plainTarget));

/* ----------------------------- 3. Bang tro giup ----------------------------- */

check("Buoc tua 5 giay", SEEK_STEP_SECONDS === 5);
check("Buoc am luong 5%", VOLUME_STEP_RATIO === 0.05);
check(
  "Moi phim tat deu co nhan va to hop phim",
  PLAYER_SHORTCUTS.every((item) => item.label.length > 0 && item.keys.length > 0),
);
check(
  "Khong co phim tat nao trung nhau",
  new Set(PLAYER_SHORTCUTS.map((item) => item.action)).size === PLAYER_SHORTCUTS.length,
);
check(
  "Nhan to hop phim hien thi dung",
  keysLabel(["Shift", "→"]) === "Shift + →" && keysLabel(["Space"]) === "Space",
);

const groups = shortcutGroups();
check("Bang tro giup chia theo nhom", groups.length === 3, groups.map((group) => group.label).join(" / "));
check(
  "Moi phim tat nam trong mot nhom",
  groups.reduce((total, group) => total + group.items.length, 0) === PLAYER_SHORTCUTS.length,
);

/* -------------------------------- 4. Manh ghep ------------------------------- */

const root = process.cwd();
const componentSource = readFileSync(path.join(root, "src", "components", "player", "player-shortcuts.tsx"), "utf8");
const layoutSource = readFileSync(path.join(root, "src", "app", "layout.tsx"), "utf8");
const storeSource = readFileSync(path.join(root, "src", "store", "player-store.ts"), "utf8");
const barSource = readFileSync(path.join(root, "src", "components", "player", "player-bar.tsx"), "utf8");
const topbarSource = readFileSync(path.join(root, "src", "components", "layout", "topbar.tsx"), "utf8");

check(
  "Component gan phim tat toan cuc vao window",
  componentSource.includes('window.addEventListener("keydown"'),
);
check("Component go bo listener khi unmount", componentSource.includes('window.removeEventListener("keydown"'));
check(
  "Component dung phim tat toi hanh dong cua trinh phat",
  componentSource.includes("resolveShortcut(event, event.target)"),
);
check(
  "Moi hanh dong trong bang deu duoc xu ly that trong component",
  PLAYER_SHORTCUTS.every((item) => componentSource.includes(`case "${item.action}"`)),
);
check("Component mount mot lan o layout goc", layoutSource.includes("<PlayerShortcuts />"));

check(
  "Store giu trang thai bang phim tat",
  storeSource.includes("shortcutsOpen: boolean") &&
    storeSource.includes("toggleShortcuts") &&
    storeSource.includes("setShortcutsOpen"),
);
check(
  "Bang phim tat KHONG luu vao localStorage (mo lai trang la dong)",
  !/partialize:[\s\S]*?shortcutsOpen:/.test(storeSource),
);
check(
  "Thanh phat co nut mo bang phim tat",
  barSource.includes("toggleShortcuts()") && barSource.includes('title="Phím tắt (?)"'),
);
check(
  "Phim tim kiem nhanh duoc xu ly trong component phim tat",
  componentSource.includes('case "quickSearch"') && componentSource.includes("openQuickSearch()"),
);
check(
  "O tim kiem tren header dang ky voi he thong phim tat (khong xu ly rieng nua)",
  topbarSource.includes("registerQuickSearch(focusSearch)") &&
    !topbarSource.includes('event.key.toLowerCase() === "k"'),
);
check("Topbar van giu phim / de mo o tim kiem", topbarSource.includes('event.key !== "/"'));
check(
  "Chua co bai nao dang phat thi phim tim kiem van chay (chi chan cac phim cua trinh phat)",
  componentSource.includes('action !== "help" && action !== "quickSearch"'),
);
check(
  "Phim L yeu thich: dang nhap truoc khi goi API (khong bao loi kho hieu)",
  componentSource.includes("/api/songs/") && componentSource.includes("Đăng nhập để lưu bài nhạc yêu thích"),
);

const failed = results.filter((line) => line.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\nTONG KET: ${results.length - failed.length} PASS / ${failed.length} FAIL`);
process.exitCode = failed.length === 0 ? 0 : 1;
