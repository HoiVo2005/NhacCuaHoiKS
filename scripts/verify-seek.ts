/**
 * Kiem tra thanh thoi gian (tua bai):
 *   npx tsx scripts/verify-seek.ts
 *
 * Cac loi da tung gap:
 * - Tha chuot/ngon tay ra NGOAI thanh truot (hoac bi trinh duyet huy thao tac) khong
 *   duoc ghi nhan -> thanh thoi gian bi "ket" o trang thai dang keo, khong tua bai.
 * - Ngay sau khi tua, dong co con bao vi tri CU (the <audio> ban timeupdate trong luc
 *   seek; SoundCloud/YouTube hoi vi tri moi ~1 giay) -> thanh thoi gian nhay nguoc
 *   roi nhay lai -> nhin nhu giat/loi.
 * - Vi tri tua khong duoc gioi han -> co the dat ngoai bai.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  clampSeekTarget,
  isStaleSeekReport,
  SEEK_CONFIRM_TOLERANCE_SECONDS,
  SEEK_PENDING_TIMEOUT_MS,
} from "../src/lib/seek";
import type { SongDTO } from "../src/types";

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

// localStorage gia lap: zustand persist dung window.localStorage -> khi chay trong Node
// khong co san nen phai gia lap (neu khong persist se canh bao va bo qua viec luu).
const memory = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
  clear: () => memory.clear(),
  key: () => null,
  get length() {
    return memory.size;
  },
} as unknown as Storage;

(globalThis as unknown as { localStorage: Storage }).localStorage = localStorageStub;
(globalThis as unknown as { window: unknown }).window = { localStorage: localStorageStub };

function makeSong(id: string, durationSeconds = 240): SongDTO {
  return {
    id,
    title: `Bai ${id}`,
    sourceType: "UPLOADED",
    streamUrl: `/api/files/audio/${id}.mp3`,
    durationSeconds,
  } as unknown as SongDTO;
}

async function main(): Promise<void> {
  // ------------------------------------------------ 1. Quy tac tua (ham thuan)
  check(
    "Gioi han vi tri tua trong [0, thoi luong]",
    clampSeekTarget(-5, 180) === 0 && clampSeekTarget(999, 180) === 180,
  );
  check("Chua biet thoi luong: khong gioi han tren", clampSeekTarget(999, 0) === 999);
  check("Vi tri khong hop le -> 0", clampSeekTarget(Number.NaN, 180) === 0);
  check(
    "Nhan biet bao cao vi tri cu",
    isStaleSeekReport(10, 120) && !isStaleSeekReport(120.4, 120),
  );
  check(
    "Cho xac nhan toi da 2.5s (khong bi ket neu dong co khong bao gi)",
    SEEK_PENDING_TIMEOUT_MS === 2500 && SEEK_CONFIRM_TOLERANCE_SECONDS === 1.5,
  );

  // ---------------------------------------------------- 2. Store (hanh vi that)
  const { usePlayerStore } = await import("../src/store/player-store");
  const store = () => usePlayerStore.getState();

  store().playQueue([makeSong("a"), makeSong("b")], 0, "test");
  store().setDuration(240);
  check("Bat dau bai moi: khong con cho tua", store().pendingSeek === null);

  store().requestSeekPosition(120);
  check("Tua 120s: hien ngay vi tri 120", store().progress === 120, String(store().progress));
  check(
    "Tua 120s: phat lenh tua cho dong co phat",
    store().seekRequest?.seconds === 120,
    JSON.stringify(store().seekRequest),
  );

  // Dong co con bao vi tri CU (10s) ngay sau khi tua -> phai bi bo qua
  store().setProgress(10);
  check(
    "Bao vi tri cu ngay sau khi tua: bi bo qua (thanh thoi gian khong nhay nguoc)",
    store().progress === 120 && store().pendingSeek === 120,
    String(store().progress),
  );

  // Dong co bao dung vi tri da tua -> chap nhan va ket thuc cho
  store().setProgress(120.2);
  check(
    "Bao dung vi tri da tua: chap nhan va ket thuc cho",
    store().progress === 120.2 && store().pendingSeek === null,
    `${store().progress} | pending=${store().pendingSeek}`,
  );

  store().setProgress(125);
  check(
    "Sau khi ket thuc cho: tien do cap nhat binh thuong",
    store().progress === 125,
    String(store().progress),
  );

  // Dong co khong bao vi tri da tua -> sau 2.5s phai chap nhan vi tri thuc te
  usePlayerStore.setState({
    pendingSeek: 200,
    pendingSeekAt: Date.now() - SEEK_PENDING_TIMEOUT_MS - 1,
    progress: 200,
  });
  store().setProgress(30);
  check(
    "Qua 2.5s khong co xac nhan: chap nhan vi tri thuc te (khong bi ket)",
    store().progress === 30 && store().pendingSeek === null,
    `${store().progress} | pending=${store().pendingSeek}`,
  );

  store().requestSeekPosition(9999);
  check("Tua vuot thoi luong: gioi han o cuoi bai", store().progress === 240, String(store().progress));

  store().requestSeekPosition(-10);
  check("Tua vi tri am: ve 0", store().progress === 0, String(store().progress));

  // Dat tien do 30s (da nghe qua 5 giay) roi bam "Bai truoc" -> phai TUA VE DAU BAI
  usePlayerStore.setState({ progress: 30, pendingSeek: null, pendingSeekAt: 0, seekRequest: null });
  store().previous();
  check(
    "Da nghe qua 5s bam 'Bai truoc': yeu cau tua ve dau bai (dong co thuc hien)",
    store().progress === 0 && store().seekRequest?.seconds === 0,
    JSON.stringify(store().seekRequest),
  );

  store().requestSeekPosition(100);
  store().next();
  check(
    "Chuyen bai: xoa trang thai cho tua de bai moi khong bi dung yen",
    store().pendingSeek === null && store().progress === 0 && store().seekRequest === null,
    `${store().progress} | pending=${store().pendingSeek}`,
  );

  store().setProgress(10, 200);
  check(
    "Bao tien do kem thoi luong: cap nhat ca thoi luong",
    store().progress === 10 && store().duration === 200,
    `${store().progress} | ${store().duration}`,
  );

  // ------------------------------------------- 3. Noi day giao dien <-> store
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
  const rangeInput = read("src/components/player/range-input.tsx");
  const playerBar = read("src/components/player/player-bar.tsx");
  const fullPlayer = read("src/components/player/full-player.tsx");
  const engine = read("src/components/player/player-engine.tsx");

  check(
    "Thanh truot: tha chuot/ngon tay o ngoai thanh truot van duoc ghi nhan",
    rangeInput.includes('window.addEventListener("pointerup", finish') &&
      rangeInput.includes('window.addEventListener("pointercancel", finish'),
  );
  check(
    "Thanh truot: phim mui ten / Home / End cung tua bai",
    rangeInput.includes("SEEK_KEYS.has(event.key)"),
  );
  check(
    "Thanh phat nho: tua qua onCommit (khong con bat pointerup o the bao ngoai)",
    playerBar.includes("onCommit={handleSeekCommit}") && !playerBar.includes("onPointerUp"),
  );
  check(
    "Trinh phat day du: tua qua onCommit",
    fullPlayer.includes("onCommit={handleSeekCommit}") && !fullPlayer.includes("onPointerUp"),
  );
  check(
    "Dong co phat: thuc hien lenh tua phat ra tu store",
    engine.includes("state.seekRequest") && engine.includes("seekRequest.seconds"),
  );
  check(
    "Khong con cau noi player-bus (da chuyen sang store)",
    !playerBar.includes("player-bus") &&
      !fullPlayer.includes("player-bus") &&
      !engine.includes("player-bus"),
  );

  const failures = results.filter((line) => line.startsWith("FAIL"));
  console.log(results.join("\n"));
  console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error("VERIFY SEEK FAILED:", error);
  process.exitCode = 1;
});
