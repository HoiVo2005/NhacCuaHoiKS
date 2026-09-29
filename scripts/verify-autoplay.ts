/**
 * Kiem tra bai moi TU DONG PHAT (loi "qua bai khong tu phat"):
 *   npx tsx scripts/verify-autoplay.ts
 *
 * Nguyen nhan goc: khi chuyen bai, trinh phat tu ban su kien `pause`
 * (thay `src` cua the <audio>, tam dung dong co khac khi doi nguon phat...).
 * Su kien do bi hieu la "nguoi dung tam dung" -> store dat isPlaying = false
 * -> bai moi khong duoc goi play().
 */
import type { RefObject } from "react";

import { AudioEngine } from "../src/components/player/engines/audio-engine";
import { isSystemPause } from "../src/lib/background-playback";
import {
  armSwitchGuard,
  releaseSwitchGuard,
  resolveAutoPlay,
  SWITCH_GUARD_MS,
} from "../src/components/player/switch-guard";
import type { SongDTO } from "../src/types";

// window stub: switch-guard dung window.setTimeout/clearTimeout,
// zustand persist doc window.localStorage
const storageStub = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

(globalThis as Window & typeof globalThis).window = {
  setTimeout: (...args: unknown[]) => setTimeout(...(args as [() => void, number])),
  clearTimeout: (id: number) => clearTimeout(id),
  localStorage: storageStub,
} as unknown as Window & typeof globalThis;

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

/**
 * The <audio> gia lap: `load()` lam "dung phat" va ban su kien `pause`
 * (hang doi task) dung nhu trinh duyet that khi doi nguon phat.
 */
class FakeAudio {
  private listeners = new Map<string, Set<() => void>>();

  src = "";
  currentTime = 0;
  duration = 180;
  volume = 1;
  muted = false;
  error: { code: number } | null = null;
  playing = false;

  addEventListener(type: string, handler: () => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }

  emit(type: string): void {
    for (const handler of this.listeners.get(type) ?? []) handler();
  }

  load(): void {
    if (this.playing) {
      this.playing = false;
      // Su kien pause duoc ban sau khi load() (trinh duyet dat paused = true roi ban 'pause')
      queueMicrotask(() => this.emit("pause"));
    }
    this.emit("loadedmetadata");
  }

  play(): Promise<void> {
    this.playing = true;
    this.emit("playing");
    return Promise.resolve();
  }

  pause(): void {
    this.playing = false;
    this.emit("pause");
  }

  removeAttribute(): void {
    // khong can lam gi
  }
}

function makeSong(id: string): SongDTO {
  return {
    id,
    title: `Bai ${id}`,
    sourceType: "UPLOADED",
    streamUrl: `/api/files/audio/${id}.mp3`,
  } as unknown as SongDTO;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const audio = new FakeAudio();
  const events: string[] = [];
  const countOf = (type: string) => events.filter((entry) => entry === type).length;

  const engine = new AudioEngine(audio as unknown as HTMLAudioElement, {
    onPlay: () => events.push("play"),
    onPause: () => events.push("pause"),
    onEnded: () => events.push("ended"),
    onReady: () => events.push("ready"),
    onBuffering: () => undefined,
    onError: (message) => events.push(`error:${message}`),
  });

  // ------------------------------------------------ 1. Phat bai dau tien
  await engine.load(makeSong("bai-1"), 0);
  await engine.play();
  await sleep(10);

  check("Bai dau: co su kien play", countOf("play") === 1, events.join(","));
  check("Bai dau: khong bao pause", countOf("pause") === 0, events.join(","));

  // ------------------------- 2. Bam Next khi dang phat (loi "khong tu phat")
  const beforeNext = events.length;
  await engine.load(makeSong("bai-2"), 0);
  await sleep(10);

  check(
    "Chuyen bai khi dang phat: KHONG bao pause (su kien pause do thay src)",
    countOf("pause") === 0,
    events.slice(beforeNext).join(","),
  );

  await engine.play();
  await sleep(10);

  check(
    "Chuyen bai: bai moi phat duoc",
    events.slice(beforeNext).filter((entry) => entry === "play").length === 1,
    events.slice(beforeNext).join(","),
  );

  // ------------------------------- 3. Het bai -> tu dong chuyen bai
  const beforeEnded = events.length;
  audio.emit("pause"); // trinh duyet ban pause khi het bai
  audio.emit("ended");
  await sleep(10);

  check(
    "Het bai: co bao ended",
    events.slice(beforeEnded).includes("ended"),
    events.slice(beforeEnded).join(","),
  );

  await engine.load(makeSong("bai-3"), 0);
  await engine.play();
  await sleep(10);

  check(
    "Het bai: bai ke tiep tu phat",
    events.slice(beforeEnded).filter((entry) => entry === "play").length === 1,
    events.slice(beforeEnded).join(","),
  );

  // ------------------------------------- 4. Nguoi dung bam tam dung that
  const beforePause = events.length;
  await engine.pause();

  check(
    "Nguoi dung tam dung: CO bao pause de giao dien cap nhat",
    events.slice(beforePause).includes("pause"),
    events.slice(beforePause).join(","),
  );

  // --------------- 5. Bo qua pause trong luc chuyen bai / khi trang o nen
  const active = { current: false } as RefObject<boolean>;
  const timer = { current: null } as RefObject<number | null>;

  /** Trang dang o tien canh va da o do tu lau (khong phai su kien pause den muon cua luc o nen) */
  const foreground = { documentHidden: false, msSinceVisible: 60_000 };

  check(
    "Binh thuong: pause la cua nguoi dung",
    !isSystemPause({ switching: active.current, ...foreground }),
  );

  armSwitchGuard(active, timer, 40);
  check(
    "Dang chuyen bai: bo qua su kien pause",
    isSystemPause({ switching: active.current, ...foreground }),
  );

  releaseSwitchGuard(active, timer);
  check(
    "Da phat duoc bai moi: nhan lai su kien pause",
    !isSystemPause({ switching: active.current, ...foreground }),
  );

  armSwitchGuard(active, timer, 40);
  await sleep(90);
  check(
    "Bao ve chuyen bai tu het han (khong ket vinh vien)",
    !isSystemPause({ switching: active.current, ...foreground }),
    `mac dinh ${SWITCH_GUARD_MS}ms`,
  );

  check(
    "Trang dang o NEN: pause la cua he thong (khong phai nguoi dung bam tam dung)",
    isSystemPause({ switching: false, documentHidden: true, msSinceVisible: 60_000 }),
  );
  check(
    "Vua quay lai tien canh: su kien pause den muon van la cua he thong",
    isSystemPause({ switching: false, documentHidden: false, msSinceVisible: 200 }),
  );
  check(
    "Khong tinh duoc khoang thoi gian (NaN) -> coi nhu pause cua nguoi dung",
    !isSystemPause({ switching: false, documentHidden: false, msSinceVisible: Number.NaN }),
  );

  // --------------------------------- 6. Quyet dinh tu phat bai moi
  const normal = resolveAutoPlay(true, true);
  check("Dang phat binh thuong: phat tiep", normal.play && !normal.restorePlaying);

  const flipped = resolveAutoPlay(true, false);
  check(
    "Bi lat trang thai khi chuyen bai: van phat tiep va khoa lai trang thai",
    flipped.play && flipped.restorePlaying,
  );

  const userPaused = resolveAutoPlay(false, false);
  check(
    "Nguoi dung da tam dung truoc do: khong tu phat",
    !userPaused.play && !userPaused.restorePlaying,
  );

  // ----------------------- 7. Store: next(true) giu trang thai dang phat
  const { usePlayerStore } = await import("../src/store/player-store");
  const songA = makeSong("store-a");
  const songB = makeSong("store-b");

  usePlayerStore.getState().playQueue([songA, songB], 0, "kiem tra");
  check("playQueue: dang phat", usePlayerStore.getState().isPlaying === true);

  usePlayerStore.getState().next(true);
  const afterNext = usePlayerStore.getState();
  check(
    "next(true): chuyen sang bai ke tiep va VAN dang phat",
    afterNext.current?.id === "store-b" && afterNext.isPlaying === true,
    `current=${afterNext.current?.id} | isPlaying=${afterNext.isPlaying}`,
  );

  usePlayerStore.setState({ queue: [], current: null, currentIndex: -1, isPlaying: false });

  const failures = results.filter((line) => line.startsWith("FAIL"));
  console.log(results.join("\n"));
  console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error("VERIFY AUTOPLAY FAILED:", error);
  process.exitCode = 1;
});
