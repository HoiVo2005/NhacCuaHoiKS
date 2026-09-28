/**
 * Cau noi giua phim tat (⌘/Ctrl + K, hoac "/") va o tim kiem tren header.
 *
 * Vi sao can: o tim kiem nam trong `Topbar` (chi co o khu nghe nhac/quan tri), con phim tat lai
 * thuoc he thong phim tat toan cuc (`src/lib/player-shortcuts.ts` + `PlayerShortcuts` - mount o
 * layout goc). Hai noi khong biet nhau nen truoc day phim ⌘/Ctrl + K bi xu ly RIENG trong Topbar
 * va khong xuat hien trong bang tro giup (`?`) va cung khong co test tu dong.
 *
 * Nay: Topbar dang ky ham focus cua no vao day, he thong phim tat goi `openQuickSearch()`.
 * Module thuan JS (khong dung DOM) nen kiem chung duoc bang `npm run check:shortcuts`.
 */

type QuickSearchHandler = () => void;

let handler: QuickSearchHandler | null = null;

/** Dang ky lai ham focus (goi voi `null` khi Topbar unmount) */
export function registerQuickSearch(next: QuickSearchHandler | null): void {
  handler = next;
}

/** Ham focus hien tai (null = trang khong co o tim kiem, vi du trang dang nhap) */
export function quickSearchTarget(): QuickSearchHandler | null {
  return handler;
}

/**
 * Mo o tim kiem nhanh. Tra ve `false` khi trang hien tai khong co o tim kiem
 * (luc do phim tat khong lam gi ca - khong duoc nem loi).
 */
export function openQuickSearch(): boolean {
  if (!handler) return false;
  handler();
  return true;
}
