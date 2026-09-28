/**
 * Kiem tra muc "Nghe tiep" tren trang chu khong lap lai mot bai nhieu lan:
 *   npx tsx scripts/verify-recent.ts
 */
import "dotenv/config";

import { readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../src/lib/db/prisma";
import { countUniqueSongs } from "../src/lib/music/collections";
import {
  listRecentlyPlayedSongs,
  listUserHistory,
  pickUniqueRecentSongs,
} from "../src/services/history.service";

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

function makeRows(songIds: string[]) {
  return songIds.map((songId, index) => ({ songId, order: index }));
}

async function main(): Promise<void> {
  // ------------------------------------------- 1. Loc trung (ham thuan)
  const duplicated = makeRows(["a", "a", "b", "a", "c", "b", "d"]);
  const picked = pickUniqueRecentSongs(duplicated, 3);

  check(
    "Bo trung: moi bai chi xuat hien 1 lan",
    picked.map((row) => row.songId).join(",") === "a,b,c",
    picked.map((row) => row.songId).join(","),
  );
  check("Bo trung: ton trong gioi han so luong", picked.length === 3, String(picked.length));

  const single = pickUniqueRecentSongs(makeRows(["x", "x", "x", "x"]), 6);
  check(
    "Chi nghe 1 bai: tra ve dung 1 bai (khong lap)",
    single.length === 1 && single[0].songId === "x",
    String(single.length),
  );

  check("Danh sach rong -> rong", pickUniqueRecentSongs([], 5).length === 0);

  const allUnique = pickUniqueRecentSongs(makeRows(["m", "n", "o"]), 10);
  check(
    "Giu nguyen thu tu nghe moi nhat truoc",
    allUnique.map((row) => row.songId).join(",") === "m,n,o",
    allUnique.map((row) => row.songId).join(","),
  );

  // ------------------------------ 2. Trang chu dung ham da loc trung
  const homeSource = readFileSync(
    path.join(process.cwd(), "src", "app", "music", "page.tsx"),
    "utf8",
  );

  check(
    "Trang chu dung listRecentlyPlayedSongs (moi bai 1 lan)",
    homeSource.includes("listRecentlyPlayedSongs") &&
      !homeSource.includes("listUserHistory"),
  );

  const serviceSource = readFileSync(
    path.join(process.cwd(), "src", "services", "history.service.ts"),
    "utf8",
  );

  check(
    "Service quet rong hon de du bai khac nhau",
    serviceSource.includes("RECENT_HISTORY_SCAN_LIMIT") &&
      serviceSource.includes("pickUniqueRecentSongs(rows, limit)"),
  );

  // --------------------- 3. Banner trang chu: dem bai noi bat khong bi trung
  check(
    "Trang chu dung countUniqueSongs cho con so bai noi bat",
    homeSource.includes("countUniqueSongs(newest, top)") &&
      homeSource.includes("Tổng hợp ${formatNumber(highlightedCount)}"),
  );
  check(
    "Trang chu co lien ket 'Xem tat ca' cho tung muc",
    ["/music/discover", "/music/discover?sort=plays", "/music/history", "/music/playlists"].every(
      (href) => homeSource.includes(`href="${href}"`),
    ) &&
      homeSource.includes("SectionHeader"),
  );
  check(
    "Trang chu dung tieu de shelf dung lai (SectionHeader) voi nhan cho trinh doc man hinh",
    [
      "Xem tất cả lịch sử nghe",
      "Xem tất cả playlist nổi bật",
      "Xem tất cả bài nhạc mới",
      "Xem tất cả bài nghe nhiều nhất",
    ].every((label) => homeSource.includes(label)),
  );

  check(
    "Dem bai noi bat: bai nam o ca 2 danh sach chi tinh 1 lan",
    countUniqueSongs([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]) === 3,
  );
  check(
    "Dem bai noi bat: trung trong cung 1 danh sach chi tinh 1 lan",
    countUniqueSongs([{ id: "x" }, { id: "x" }, { id: "x" }]) === 1,
  );
  check("Dem bai noi bat: danh sach rong -> 0", countUniqueSongs([], []) === 0);
  check(
    "Dem bai noi bat: khong dem ban ghi thieu id",
    countUniqueSongs([{ id: "a" }, { id: "" }]) === 1,
  );

  // --------------------------- 4. Kiem tra tren du lieu that trong CSDL
  const busiest = await prisma.listenHistory.groupBy({
    by: ["userId"],
    _count: { userId: true },
    orderBy: { _count: { userId: "desc" } },
    take: 1,
  });

  const targetUserId = busiest[0]?.userId;

  if (!targetUserId) {
    check("CSDL: co du lieu lich su de kiem tra", false, "khong co ban ghi listen_history");
  } else {
    const rawEntries = await listUserHistory(targetUserId, 200);
    const recent = await listRecentlyPlayedSongs(targetUserId, 6);

    const rawSongIds = rawEntries.map((entry) => entry.song.id);
    const recentSongIds = recent.map((entry) => entry.song.id);
    const hasDuplicate = new Set(recentSongIds).size !== recentSongIds.length;

    // Ket qua mong doi: bai cua lan nghe moi nhat, moi bai 1 lan
    const expected: string[] = [];
    for (const id of rawSongIds) {
      if (!expected.includes(id)) expected.push(id);
      if (expected.length >= 6) break;
    }

    check(
      "CSDL: 'Nghe tiep' khong con bai nao lap lai",
      !hasDuplicate,
      recentSongIds.join(","),
    );
    check(
      "CSDL: dung thu tu nghe moi nhat, toi da 6 bai",
      recentSongIds.join(",") === expected.join(","),
      `nhan duoc [${recentSongIds.join(",")}] | mong doi [${expected.join(",")}]`,
    );
    check(
      "CSDL: so dong lich su >= so bai hien thi (co tinh lap)",
      rawEntries.length >= recent.length,
      `${rawEntries.length} luot nghe -> ${recent.length} bai`,
    );
  }

  const failures = results.filter((line) => line.startsWith("FAIL"));
  console.log(results.join("\n"));
  console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error("VERIFY RECENT FAILED:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
