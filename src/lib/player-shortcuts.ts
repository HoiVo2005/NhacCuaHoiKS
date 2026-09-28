/**
 * Quy tac phim tat cho trinh phat nhac (toan cuc, khong phu thuoc trang nao).
 *
 * Vi sao tach ra lib thuan:
 *  - Day la phan de "vo" nhat khi nguoi dung go chu vao o tim kiem (go "s" ma nhac bat
 *    ngau nhien...). Quy tac "bo qua khi dang go / dang mo hop thoai" phai kiem chung duoc
 *    bang `npm run check:shortcuts` truoc khi gan vao DOM that.
 */

export type ShortcutAction =
  | "playPause"
  | "seekBack"
  | "seekForward"
  | "previous"
  | "next"
  | "volumeUp"
  | "volumeDown"
  | "mute"
  | "shuffle"
  | "repeat"
  | "favorite"
  | "lyrics"
  | "queue"
  | "fullPlayer"
  | "quickSearch"
  | "help";

export interface ShortcutDefinition {
  action: ShortcutAction;
  /** Nhan hien tren bang tro giup, vi du ["Shift", "→"] */
  keys: string[];
  label: string;
  group: ShortcutGroup;
}

export type ShortcutGroup = "Phát nhạc" | "Âm thanh" | "Giao diện";

export const SHORTCUT_GROUPS: ShortcutGroup[] = ["Phát nhạc", "Âm thanh", "Giao diện"];

/** Moi lan bam ← / → tua 5 giay */
export const SEEK_STEP_SECONDS = 5;

/** Moi lan bam ↑ / ↓ doi am luong 5% */
export const VOLUME_STEP_RATIO = 0.05;

export const PLAYER_SHORTCUTS: ShortcutDefinition[] = [
  { action: "playPause", keys: ["Space"], label: "Phát / tạm dừng", group: "Phát nhạc" },
  { action: "seekBack", keys: ["←"], label: `Tua lại ${SEEK_STEP_SECONDS} giây`, group: "Phát nhạc" },
  { action: "seekForward", keys: ["→"], label: `Tua tới ${SEEK_STEP_SECONDS} giây`, group: "Phát nhạc" },
  { action: "previous", keys: ["Shift", "←"], label: "Bài trước", group: "Phát nhạc" },
  { action: "next", keys: ["Shift", "→"], label: "Bài tiếp theo", group: "Phát nhạc" },
  { action: "favorite", keys: ["L"], label: "Thêm / bỏ yêu thích bài đang phát", group: "Phát nhạc" },
  { action: "volumeUp", keys: ["↑"], label: "Tăng âm lượng", group: "Âm thanh" },
  { action: "volumeDown", keys: ["↓"], label: "Giảm âm lượng", group: "Âm thanh" },
  { action: "mute", keys: ["M"], label: "Tắt / bật tiếng", group: "Âm thanh" },
  { action: "shuffle", keys: ["S"], label: "Bật / tắt phát ngẫu nhiên", group: "Giao diện" },
  { action: "repeat", keys: ["R"], label: "Đổi chế độ lặp lại (tắt → cả danh sách → một bài)", group: "Giao diện" },
  { action: "lyrics", keys: ["Y"], label: "Mở / đóng lời bài hát (karaoke)", group: "Giao diện" },
  { action: "queue", keys: ["Q"], label: "Mở / đóng hàng chờ", group: "Giao diện" },
  { action: "fullPlayer", keys: ["F"], label: "Mở / đóng trình phát đầy đủ", group: "Giao diện" },
  {
    action: "quickSearch",
    keys: ["Ctrl/⌘", "K"],
    label: "Mở ô tìm kiếm nhanh (phím / cũng dùng được)",
    group: "Giao diện",
  },
  { action: "help", keys: ["?"], label: "Mở bảng phím tắt này", group: "Giao diện" },
];

/** Nhan hien thi cua mot to hop phim: ["Shift", "→"] -> "Shift + →" */
export function keysLabel(keys: string[]): string {
  return keys.join(" + ");
}

/** Bang phim tat chia theo nhom, dung cho hop thoai tro giup */
export function shortcutGroups(): { label: ShortcutGroup; items: ShortcutDefinition[] }[] {
  return SHORTCUT_GROUPS.map((label) => ({
    label,
    items: PLAYER_SHORTCUTS.filter((item) => item.group === label),
  })).filter((group) => group.items.length > 0);
}

interface EventLike {
  tagName?: string;
  isContentEditable?: boolean;
}

/**
 * Nguoi dung dang go chu? (o tim kiem, o nhap lieu, trinh soan thao...)
 * Khi dang go thi moi phim tat deu bi bo qua, tru phim nguoi dung tu bam trong o do.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as EventLike | null;
  if (!element) return false;
  if (element.isContentEditable) return true;

  const tag = element.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** Dang mo hop thoai / menu cua Radix? (luc do phim duoc uu tien cho lop phu) */
export function isInsideOverlay(target: EventTarget | null): boolean {
  const element = target as { closest?: (selector: string) => Element | null } | null;
  if (!element || typeof element.closest !== "function") return false;

  return element.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]') !== null;
}

export interface ShortcutEventLike {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/**
 * Doi su kien ban phim thanh hanh dong cua trinh phat (null = khong phai phim tat cua trinh phat).
 *
 * Nhung truong hop bi bo qua:
 *  - Co giu Ctrl / Cmd / Alt (tranh de len phim tat cua trinh duyet va cua he thong).
 *  - Dang go chu trong o nhap lieu (`isTypingTarget`).
 *  - Dang o trong hop thoai / menu Radix (`isInsideOverlay`) - luc do mui ten va chu cai
 *    thuoc ve lop phu dang mo (vi du menu hen gio).
 */
export function resolveShortcut(event: ShortcutEventLike, target: EventTarget | null = null): ShortcutAction | null {
  const withModifier = event.ctrlKey || event.metaKey;

  /*
   * ⌘/Ctrl + K = mở ô tìm kiếm nhanh. Phải kiểm tra TRƯỚC luật "có giữ Ctrl/Cmd thì bỏ qua" (vì
   * chính nó dùng Ctrl/Cmd) và không phụ thuộc việc đang gõ ở đâu - đây là lệnh toàn cục của ứng
   * dụng (giống Slack/YouTube). Trong hộp thoại thì nhường phím cho lớp phủ đang mở.
   */
  if (withModifier && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
    return isInsideOverlay(target) ? null : "quickSearch";
  }

  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (isTypingTarget(target) || isInsideOverlay(target)) return null;

  const shift = event.shiftKey ?? false;

  switch (event.key) {
    case " ":
    case "Spacebar":
      return "playPause";
    case "ArrowRight":
      return shift ? "next" : "seekForward";
    case "ArrowLeft":
      return shift ? "previous" : "seekBack";
    case "ArrowUp":
      return "volumeUp";
    case "ArrowDown":
      return "volumeDown";
    case "?":
      return "help";
    default:
      break;
  }

  // Phim chu: nhan ca chu thuong lan chu hoa (co Shift) de tranh phai nho dung Shift
  switch (event.key.toLowerCase()) {
    case "m":
      return "mute";
    case "s":
      return "shuffle";
    case "r":
      return "repeat";
    case "l":
      return "favorite";
    case "y":
      return "lyrics";
    case "q":
      return "queue";
    case "f":
      return "fullPlayer";
    default:
      return null;
  }
}
