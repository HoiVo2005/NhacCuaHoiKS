/**
 * Kiem tra video o che do toan man hinh cuon theo noi dung:
 *   npx tsx scripts/verify-video-stage.ts
 *
 * Cac loi da tung gap:
 * - Khung video `position: fixed` dung yen tren man hinh (`top: 10vh`) nen khi nguoi dung cuon
 *   trinh phat day du, video de len tieu de/nghe si ben duoi -> thong tin bai nhac bi che mat.
 * - Khong cat khung video theo vung cuon -> video tran len de len header "Dang phat".
 * - Bo qua viec bo phep dich `-translate-x-1/2` -> video lech khoi o cho.
 * - Tailwind v4 dich `-translate-x-1/2` thanh thuoc tinh `translate` (khong phai `transform`):
 *   chi dat `transform: none` la khong du -> khung video bi day lech sang trai nua chieu rong.
 *   Vi vay phai kiem tra CA HAI thuoc tinh (xem `VIDEO_STAGE_PROPERTIES`).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  applyVideoStageStyles,
  clearVideoStageStyles,
  registerVideoSlot,
  VIDEO_STAGE_PROPERTIES,
  videoSlotElement,
  videoStageStyle,
  watchVideoSlot,
} from "../src/components/player/video-stage";

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

interface Box {
  top: number;
  bottom?: number;
  left: number;
  width: number;
  height: number;
}

/** Doi tuong gia lap phan tu DOM: chi can getBoundingClientRect + isConnected */
function fakeElement(box: Box | null): HTMLElement {
  return {
    isConnected: true,
    getBoundingClientRect: () =>
      box
        ? {
            top: box.top,
            bottom: box.bottom ?? box.top + box.height,
            left: box.left,
            right: box.left + box.width,
            width: box.width,
            height: box.height,
          }
        : { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 },
  } as unknown as HTMLElement;
}

/** Khung video gia lap: ghi lai cac thuoc tinh CSS duoc dat/xoa */
function fakeContainer(): { element: HTMLElement; styles: Map<string, string> } {
  const styles = new Map<string, string>();
  const element = {
    style: {
      setProperty: (property: string, value: string) => void styles.set(property, value),
      removeProperty: (property: string) => void styles.delete(property),
    },
  } as unknown as HTMLElement;

  return { element, styles };
}

function main(): void {
  // ---------------------------------------------- 1. Vi tri khung video theo "o cho"
  const slotBox: Box = { top: 68, left: 502, width: 896, height: 504 };
  const scrollArea = fakeElement({ top: 52, left: 0, width: 1900, height: 848 });

  registerVideoSlot(fakeElement(slotBox), scrollArea);

  const initial = videoStageStyle();
  check("Chua cuon: khung video nam dung o cho", initial?.top === "68px" && initial?.left === "502px");
  check(
    "Khung video rong bang o cho (khong lech kich thuoc)",
    initial?.width === "896px" && initial?.height === "504px",
  );
  check(
    "Bo phep dich -translate-x-1/2 khi bam theo o cho (ca `transform` lan `translate`)",
    initial?.transform === "none" && initial?.translate === "none",
    `transform=${String(initial?.transform)} | translate=${String(initial?.translate)}`,
  );
  check("Khung video nam gon trong vung cuon: khong bi cat", initial?.["clip-path"] === undefined);

  // Nguoi dung cuon xuong 200px: o cho (va khung video) phai di len theo, khong dung yen
  slotBox.top = -132;
  const scrolled = videoStageStyle();
  check(
    "Cuon xuong: khung video di len theo noi dung (khong dung yen)",
    scrolled?.top === "-132px",
    String(scrolled?.top),
  );
  check(
    "Phan tran ra ngoai vung cuon bi cat bot (khong de len header)",
    scrolled?.["clip-path"] === "inset(184px 0px 0px 0px)",
    String(scrolled?.["clip-path"]),
  );

  // Cuon tro lai dau trang: o cho ve dung vi tri ban dau
  slotBox.top = 68;
  check("Cuon tro lai dau: khung video ve dung o cho", videoStageStyle()?.top === "68px");

  // ------------------------------------------------------ 2. Truong hop khong co o cho
  registerVideoSlot(null, null);
  check("Trinh phat day du dong: khong bam theo o cho nua", videoStageStyle() === null);
  check("Sau khi dong, khong con o cho nao duoc ghi nho", videoSlotElement() === null);

  registerVideoSlot(fakeElement({ top: 0, left: 0, width: 0, height: 0 }), scrollArea);
  check("O cho chua bo tri xong: khong bam theo (tranh dat toa do sai)", videoStageStyle() === null);

  // ------------------------------------- 3. Ap/xoa thuoc tinh CSS tren khung video
  const { element, styles } = fakeContainer();
  registerVideoSlot(fakeElement({ top: 100, left: 40, width: 640, height: 360 }), scrollArea);

  applyVideoStageStyles(element);
  check(
    "Ap duoc toa do cua o cho cho khung video",
    styles.get("top") === "100px" && styles.get("left") === "40px" && styles.get("width") === "640px",
    JSON.stringify(Object.fromEntries(styles)),
  );

  registerVideoSlot(null, null);
  applyVideoStageStyles(element);
  check(
    "O cho bien mat: xoa het toa do da ap (khung video ve mac dinh)",
    styles.size === 0,
    JSON.stringify(Object.fromEntries(styles)),
  );

  applyVideoStageStyles(element);
  check("Khong con o cho: khong ap toa do nao", styles.size === 0);
  check(
    "Danh sach thuoc tinh CSS do o cho dieu khien",
    VIDEO_STAGE_PROPERTIES.length === 7 &&
      VIDEO_STAGE_PROPERTIES.includes("clip-path") &&
      VIDEO_STAGE_PROPERTIES.includes("translate"),
    VIDEO_STAGE_PROPERTIES.join(", "),
  );

  const { element: cleared } = fakeContainer();
  clearVideoStageStyles(cleared);
  check("Xoa toa do: khong nem loi khi chua ap gi", true);

  // ----------------------------- 4. Thong bao khi o cho duoc them/bo (dong co nghe theo)
  registerVideoSlot(null, null);
  let notified = 0;
  const unwatch = watchVideoSlot(() => (notified += 1));
  const slotForNotify = fakeElement(slotBox);

  registerVideoSlot(slotForNotify, scrollArea);
  check("Mo trinh phat day du: dong co duoc thong bao de bam theo o cho", notified === 1);
  registerVideoSlot(slotForNotify, scrollArea);
  check("Dang ky lai cung o cho: khong thong bao thua", notified === 1);
  registerVideoSlot(null, null);
  check("Dong trinh phat day du: dong co duoc thong bao de bo bam theo", notified === 2);

  unwatch();
  registerVideoSlot(fakeElement(slotBox), scrollArea);
  check("Huy dang ky: khong con nhan thong bao", notified === 2);

  registerVideoSlot(null, null);

  // ----------------------------------------------- 5. Noi day giao dien <-> dong co
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
  const fullPlayer = read("src/components/player/full-player.tsx");
  const engine = read("src/components/player/player-engine.tsx");

  check(
    "Trinh phat day du dat 'o cho video' trong luong trang (ref + dang ky)",
    fullPlayer.includes("ref={videoSlotRef}") &&
      fullPlayer.includes("registerVideoSlot(videoSlotRef.current, scrollAreaRef.current)"),
  );
  check(
    "Trinh phat day du dang ky ca vung cuon (de cat bot phan tran ra ngoai)",
    fullPlayer.includes("ref={scrollAreaRef}") && fullPlayer.includes("scrollbar-thin safe-bottom"),
  );
  check(
    "Trinh phat day du go dang ky khi dong (khong giu o cho cu)",
    fullPlayer.includes("return () => registerVideoSlot(null, null);"),
  );
  check(
    "Dong co phat bam theo o cho moi khi cuon (nghe su kien scroll o pha capture)",
    engine.includes('window.addEventListener("scroll", schedule, scrollOptions)') &&
      engine.includes("capture: true, passive: true") &&
      engine.includes("applyVideoStageStyles(container)"),
  );
  check(
    "Dong co phat go bo toa do khi thoat che do toan man hinh",
    engine.includes("clearVideoStageStyles(container)") && engine.includes("observer?.disconnect()"),
  );
  check(
    "Khung video toan man hinh co tai lieu ve viec cuon theo noi dung (khong con dung yen)",
    engine.includes("cuon len/xuong cung noi dung"),
  );

  /*
   * Loi "video lech sang 1 ben" (Tailwind v4): class can giua mac dinh dung thuoc tinh `translate`,
   * nen khi bam theo o cho phai xoa ca `translate` lan `transform` - neu chi xoa `transform` thi
   * phep dich -50% van con va khung video bi day lech sang trai nua chieu rong.
   */
  const stageSource = read("src/components/player/video-stage.ts");
  check(
    "Xoa ca thuoc tinh `translate` (Tailwind v4) chu khong chi `transform`",
    stageSource.includes('translate: "none"') &&
      stageSource.includes('transform: "none"') &&
      VIDEO_STAGE_PROPERTIES.includes("translate"),
  );
  check(
    "Khung video toan man hinh van can giua mac dinh bang `left-1/2 -translate-x-1/2`",
    engine.includes("left-1/2") && engine.includes("-translate-x-1/2"),
  );
  check(
    "Tai lieu trong video-stage.ts ghi ro bay Tailwind v4 (`translate` khac `transform`)",
    stageSource.includes("Tailwind v4") && stageSource.includes("KHONG phai `transform`"),
  );

  const failures = results.filter((line) => line.startsWith("FAIL"));
  console.log(results.join("\n"));
  console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main();
