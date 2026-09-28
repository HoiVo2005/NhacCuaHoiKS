/**
 * Kiem tra hop thoai xac nhan (thu vien Radix AlertDialog) + tick chon xoa nhanh:
 *   npx tsx scripts/verify-dialogs.ts
 *
 * Khang dinh:
 *  - Khong con window.confirm() nao trong src/ (da thay bang hop thoai cua thu vien)
 *  - ConfirmProvider duoc mount o layout goc; 6 noi dung deu dung useConfirm()
 *  - Cac danh sach lon co Checkbox + BulkActionBar + goi API bulk tuong ung
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

/** Liet ke tat ca file .ts/.tsx trong mot thu muc (de quet window.confirm) */
function listSourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    const info = statSync(fullPath);

    if (info.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }

    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) files.push(fullPath);
  }

  return files;
}

// ------------------------------------ 1. Khong con window.confirm trong ma nguon
const offenders = listSourceFiles(path.join(process.cwd(), "src")).filter((file) =>
  readFileSync(file, "utf8").includes("window.confirm"),
);

check(
  "Khong con window.confirm() trong src/",
  offenders.length === 0,
  offenders.map((file) => path.relative(process.cwd(), file)).join(", "),
);

// -------------------------------------------- 2. Bo UI thu vien + provider
const layout = read("src/app/layout.tsx");
const confirmDialog = read("src/components/ui/confirm-dialog.tsx");
const alertDialogUi = read("src/components/ui/alert-dialog.tsx");
const checkboxUi = read("src/components/ui/checkbox.tsx");
const bulkBarUi = read("src/components/ui/bulk-action-bar.tsx");

check("Layout goc boc <ConfirmProvider>", layout.includes("<ConfirmProvider>"));
check(
  "Hop thoai dung thu vien Radix AlertDialog",
  alertDialogUi.includes("@radix-ui/react-alert-dialog") &&
    confirmDialog.includes("AlertDialogContent"),
);
check("Co hook useConfirm() dang Promise", confirmDialog.includes("export function useConfirm"));
check("Checkbox dung Radix UI", checkboxUi.includes("@radix-ui/react-checkbox"));
check("Thanh thao tac hang loat co mat", bulkBarUi.includes('data-slot="bulk-action-bar"'));

// --------------------------------- 3. Cac noi dung dung hop thoai xac nhan moi
const confirmUsers: [string, string][] = [
  ["src/components/admin/admin-songs-table.tsx", "admin-songs-table"],
  ["src/components/admin/admin-playlist-manager.tsx", "admin-playlist-manager"],
  ["src/components/admin/genre-manager.tsx", "genre-manager"],
  ["src/components/admin/employee-manager.tsx", "employee-manager"],
  ["src/components/music/playlist-manager.tsx", "playlist-manager"],
  ["src/components/music/playlist-detail-view.tsx", "playlist-detail-view"],
  ["src/components/music/history-list.tsx", "history-list"],
];

for (const [file, name] of confirmUsers) {
  const source = read(file);
  check(`${name} dung useConfirm()`, source.includes("useConfirm()"));
}

// ---------------------------- 4. Tick chon + xoa hang loat o cac danh sach lon
const songsTable = read("src/components/admin/admin-songs-table.tsx");
check(
  "Bảng nhạc: có checkbox chọn dòng",
  songsTable.includes("<Checkbox") && songsTable.includes("useRowSelection"),
);
check("Bảng nhạc: có thanh hành động hàng loạt", songsTable.includes("<BulkActionBar"));
check("Bảng nhạc: gọi API xoá hàng loạt", songsTable.includes('"/api/songs/bulk"'));
check("Bảng nhạc: có nút xoá tất cả", songsTable.includes("Xoá tất cả"));

const adminPlaylists = read("src/components/admin/admin-playlist-manager.tsx");
check(
  "Playlist nội bộ: có checkbox + xoá hàng loạt",
  adminPlaylists.includes("<Checkbox") &&
    adminPlaylists.includes("<BulkActionBar") &&
    adminPlaylists.includes('"/api/playlists/bulk"'),
);
check("Playlist nội bộ: có nút xoá tất cả", adminPlaylists.includes("Xoá tất cả"));

const historyList = read("src/components/music/history-list.tsx");
check(
  "Lịch sử nghe: có checkbox + xoá hàng loạt",
  historyList.includes("<Checkbox") &&
    historyList.includes("<BulkActionBar") &&
    historyList.includes('"/api/history/bulk"'),
);

// ------------------------------------------------ 5. API bulk co guard quyen
check(
  "API /api/songs/bulk chi cho ADMIN",
  read("src/app/api/songs/bulk/route.ts").includes("requireApiAdmin") &&
    read("src/app/api/songs/bulk/route.ts").includes("bulkSongActionSchema"),
);
check(
  "API /api/playlists/bulk can dang nhap",
  read("src/app/api/playlists/bulk/route.ts").includes("requireApiUser") &&
    read("src/app/api/playlists/bulk/route.ts").includes("deletePlaylists"),
);
check(
  "API /api/history/bulk chi xoa lich su cua chinh minh",
  read("src/app/api/history/bulk/route.ts").includes("requireApiUser") &&
    read("src/app/api/history/bulk/route.ts").includes("deleteHistoryEntries"),
);

// ------------------- 6. Playlist noi bo phai duoc luu ngay khi TAO (loi da tung gap)
const playlistService = read("src/services/playlist.service.ts");
check(
  "Tao playlist noi bo luu dung co isFeatured (nut 'Tao playlist noi bo' moi hoat dong)",
  playlistService.includes("isFeatured: input.isFeatured ?? false"),
);
check(
  "Route chan nguoi khong phai ADMIN dat co playlist noi bo",
  read("src/app/api/playlists/route.ts").includes("isFeatured: false") &&
    read("src/app/api/playlists/[id]/route.ts").includes("parsed.isFeatured !== undefined"),
);
check(
  "Nut 'Tao playlist noi bo' gui isFeatured: true len API",
  adminPlaylists.includes("isPublic: true, isFeatured: true"),
);

const failures = results.filter((line) => line.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
process.exitCode = failures.length === 0 ? 0 : 1;
