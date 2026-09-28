/**
 * Kiem tra luong ghi lich su nghe (`/api/history`):
 *   npx tsx scripts/verify-history.ts
 *
 * Cac loi da tung gap:
 * - Effect trong `player-engine.tsx` phu thuoc ca trang thai phat/tam dung -> MOI lan
 *   pause/play (ke ca luc chuyen bai, tua, StrictMode chay 2 lan) deu gui them mot request
 *   `POST /api/history` voi 0ms -> hang loat request lam nghen server (~130ms/request).
 * - Server ghi lai ca khi khong co gi moi (client gui lai dung vi tri cu) -> ton them mot
 *   vong truy van SQL Server.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  createHistoryTracker,
  HISTORY_MIN_DELTA_MS,
  HISTORY_MIN_PLAY_MS,
  HISTORY_TICK_MS,
  historyReportFlush,
  historyReportTick,
} from "../src/components/player/history-report";

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

/* ---------------------- 1. Chua nghe du 5 giay: khong gui gi het ---------------------- */

{
  const tracker = createHistoryTracker();

  check(
    "Bai moi: chua gui gi khi vua bam phat",
    historyReportTick(tracker, { msPlayed: 0, isPlaying: true }) === null,
  );
  check(
    "Bai moi: nghe 4 giay van chua tinh la mot luot nghe",
    historyReportTick(tracker, { msPlayed: 4_000, isPlaying: true }) === null,
  );
  check(
    "Bai moi: nghe du nguong thi gui dung vi tri hien tai",
    historyReportTick(tracker, { msPlayed: HISTORY_MIN_PLAY_MS, isPlaying: true }) ===
      HISTORY_MIN_PLAY_MS,
  );
}

/* ----------------- 2. Loi cu: bam pause/play lien tuc lam nghen server ---------------- */

{
  const tracker = createHistoryTracker();
  historyReportTick(tracker, { msPlayed: 20_000, isPlaying: true });

  let sent = 0;
  for (let index = 0; index < 20; index += 1) {
    // Nguoi dung bam tam dung roi phat lai lien tuc ma khong nghe them duoc gi
    if (historyReportTick(tracker, { msPlayed: 20_000, isPlaying: false }) !== null) sent += 1;
    if (historyReportTick(tracker, { msPlayed: 20_000, isPlaying: true }) !== null) sent += 1;
  }

  check(
    "Bam pause/play 20 lan ma khong nghe them: KHONG gui request nao",
    sent === 0,
    `so request: ${sent}`,
  );
}

/* --------------------------- 3. Chi cap nhat khi co tien trien -------------------------- */

{
  const tracker = createHistoryTracker();
  historyReportTick(tracker, { msPlayed: 5_000, isPlaying: true });

  check(
    "Nghe them 29 giay (duoi nguong 30s): chua gui",
    historyReportTick(tracker, {
      msPlayed: 5_000 + HISTORY_MIN_DELTA_MS - 1_000,
      isPlaying: true,
    }) === null,
  );
  check(
    "Nghe them du 30 giay: gui moc moi",
    historyReportTick(tracker, { msPlayed: 5_000 + HISTORY_MIN_DELTA_MS, isPlaying: true }) ===
      5_000 + HISTORY_MIN_DELTA_MS,
  );
  check(
    "Tua nguoc ve dau bai: khong gui (khong co tien trien)",
    historyReportTick(tracker, { msPlayed: 3_000, isPlaying: true }) === null,
  );
  check(
    "Tua tien 60 giay: gui moc moi",
    historyReportTick(tracker, { msPlayed: 95_000, isPlaying: true }) === 95_000,
  );
}

/* ------------------------------ 4. Tam dung: gui not mot lan ---------------------------- */

{
  const tracker = createHistoryTracker();
  historyReportTick(tracker, { msPlayed: 10_000, isPlaying: true });

  check(
    "Tam dung khi chua gui gi (chua du 5 giay): khong gui",
    historyReportFlush(createHistoryTracker(), 4_000) === null,
  );
  check("Tam dung sau khi da nghe: gui not vi tri cuoi", historyReportFlush(tracker, 27_500) === 27_500);
  check(
    "Tam dung lai ngay sau do (khong nghe them): khong gui them",
    historyReportFlush(tracker, 27_500) === null,
  );
  check(
    "Vi tri bao ve nho hon lan gui truoc: khong ghi lui",
    historyReportFlush(tracker, 1_000) === null,
  );
}

/* --------------------------- 5. Moi bai co bo dem rieng (khong lan) --------------------- */

{
  const first = createHistoryTracker();
  const second = createHistoryTracker();
  historyReportTick(first, { msPlayed: 40_000, isPlaying: true });

  check(
    "Chuyen sang bai khac: bo dem moi nen bai moi lai bat dau tu dau",
    historyReportTick(second, { msPlayed: HISTORY_MIN_PLAY_MS, isPlaying: true }) ===
      HISTORY_MIN_PLAY_MS,
  );
}

/* ------------------------------ 6. Nhip kiem tra khong lam nang UI --------------------- */

check("Nhip kiem tra tien do duoi 10 giay (chi doc store, khong goi API)", HISTORY_TICK_MS <= 10_000);
check(
  "Nguong tinh luot nghe nho hon nguong cap nhat tien do",
  HISTORY_MIN_PLAY_MS < HISTORY_MIN_DELTA_MS,
);

/* ------------------------------- 7. Noi day giao dien <-> logic ------------------------ */

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
const engine = read("src/components/player/player-engine.tsx");
const service = read("src/services/history.service.ts");

check(
  "Effect ghi lich su KHONG phu thuoc trang thai phat/tam dung (nguyen nhan gay spam)",
  engine.includes("}, [current?.id, isAuthenticated]);") &&
    !/\[\s*current\?\.id,\s*isPlaying/.test(engine),
);
check(
  "Moi bai dung mot bo dem rieng (createHistoryTracker trong effect)",
  engine.includes("const tracker = createHistoryTracker();"),
);
check(
  "Chi mot request ghi lich su dang bay tai mot thoi diem (single-flight)",
  engine.includes("if (historyInFlightRef.current) return;") &&
    engine.includes("historyInFlightRef.current = false;"),
);
check(
  "Khong await request lich su (khong lam cham thao tac phat nhac)",
  !/await fetch\("\/api\/history"/.test(engine),
);
check("Request lich su duoc gui tiep khi doi trang (keepalive)", engine.includes("keepalive: true"));
check(
  "Server bo qua luot ghi khi khong co gi moi",
  service.includes("if (!advanced && !marksCompleted) return;") &&
    service.includes("select: { id: true, msPlayed: true, completed: true }"),
);

const failures = results.filter((line) => line.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
process.exitCode = failures.length === 0 ? 0 : 1;
