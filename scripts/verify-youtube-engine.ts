/* eslint-disable */
/**
 * Kiem tra dong co YouTube: node scripts/verify-youtube-engine.ts (hoac npx tsx ...)
 *
 * Mo phong dung hanh vi that cua YouTube IFrame API:
 *  - object tra ve tu `new YT.Player()` CHUA co method nao cho toi khi onReady
 *    (day chinh la nguyen nhan loi "this.player.playVideo is not a function")
 *  - YouTube thay the the duoc truyen vao bang <iframe> cua no
 * Kiem tra: goi play()/load() dong thoi truoc onReady khong nem loi, chi phat 1 lan,
 * am luong/tat tieng dat truoc khi san sang duoc ap dung, destroy() don sach iframe va
 * co the khoi tao lai tren cung mot container.
 */
import { YouTubeEngine } from "../src/components/player/engines/youtube-engine";
import type { SongDTO } from "../src/types";

const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const realSetInterval = globalThis.setInterval;
const realClearInterval = globalThis.clearInterval;

const API_INSTALL_DELAY_MS = 5;
const PLAYER_READY_DELAY_MS = 20;

/** Cho phep test nhanh: moi timeout 15s cua engine chi cho 60ms */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => realSetTimeout(resolve, ms));
}

class FakeNode {
  tagName: string;
  src = "";
  style: Record<string, string> = {};
  attributes: Record<string, string> = {};
  children: FakeNode[] = [];
  parent: FakeNode | null = null;

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  appendChild<T extends FakeNode>(child: T): T {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }

  querySelectorAll(selector: string): FakeNode[] {
    const wanted = selector.split(",").map((part) => part.trim());
    const found: FakeNode[] = [];

    const visit = (node: FakeNode) => {
      for (const child of node.children) {
        const matches = wanted.some(
          (part) =>
            part === child.tagName ||
            (part === "[data-yt-mount]" && child.attributes["data-yt-mount"] !== undefined),
        );
        if (matches) found.push(child);
        visit(child);
      }
    };

    visit(this);
    return found;
  }
}

class FakeHead extends FakeNode {
  appendChild<T extends FakeNode>(child: T): T {
    const result = super.appendChild(child);
    if (child.tagName === "script" && String(child.src).includes("iframe_api")) {
      realSetTimeout(() => installFakeYouTubeApi(), API_INSTALL_DELAY_MS);
    }
    return result;
  }
}

const stats = {
  playVideo: 0,
  pauseVideo: 0,
  loadedSongs: [] as string[],
  seekTo: [] as number[],
  volumes: [] as number[],
  mute: 0,
  unMute: 0,
  destroyed: 0,
};

const state = {
  /** true neu object tra ve tu constructor da co playVideo (phai la false khi onReady chua chay) */
  constructorHadPlayVideo: false,
  /** mo phong truong hop onReady khong bao gio chay */
  neverReady: false,
  apiInstalled: false,
  /** Trang thai hien tai cua player (-1: chua bat dau) - getPlayerState() phan hoi lu dung cai nay */
  playerState: -1,
};

class FakeYouTubePlayer {
  options: any;

  constructor(mount: FakeNode, options: any) {
    this.options = options;
    state.constructorHadPlayVideo = typeof (this as any).playVideo === "function";

    // YouTube thay the the duoc truyen vao bang iframe cua no
    const iframe = new FakeNode("iframe");
    (mount.parent ?? mount).appendChild(iframe);
    mount.remove();

    realSetTimeout(() => {
      if (state.neverReady) return;

      // Handshake xong: luc nay YT moi gan cac method len chinh object nay
      // fireState: cap nhat TRANG THAI truoc khi bắn su kien - de `getPlayerState()` phan hoi
      // dung thuc te (truoc day hardcoded 1 -> khong mo phong duoc truong hop "tam dung am tham")
      const fireState = (data: number) => {
        state.playerState = data;
        this.options.events.onStateChange({ data });
      };

      Object.assign(this, {
        playVideo: () => {
          stats.playVideo += 1;
          fireState(1);
        },
        pauseVideo: () => {
          stats.pauseVideo += 1;
          fireState(2);
        },
        loadVideoById: (o: { videoId: string }) => {
          stats.loadedSongs.push(o.videoId);
          fireState(5);
        },
        seekTo: (seconds: number) => {
          stats.seekTo.push(seconds);
        },
        setVolume: (volume: number) => {
          stats.volumes.push(volume);
        },
        mute: () => {
          stats.mute += 1;
        },
        unMute: () => {
          stats.unMute += 1;
        },
        getDuration: () => 200,
        getCurrentTime: () => 0,
        getPlayerState: () => state.playerState,
        destroy: () => {
          stats.destroyed += 1;
        },
      });

      this.options.events.onReady({ target: this });
    }, PLAYER_READY_DELAY_MS);
  }
}

const win: any = {
  location: { origin: "http://localhost:3000" },
  // Moi timeout 15s cua engine duoc rut ngan de test chay nhanh
  setTimeout: (handler: () => void, ms?: number) =>
    realSetTimeout(handler, ms === 15_000 ? 60 : ms),
  clearTimeout: (id: any) => realClearTimeout(id),
  setInterval: (handler: () => void, ms?: number) => realSetInterval(handler, ms),
  clearInterval: (id: any) => realClearInterval(id),
  onYouTubeIframeAPIReady: undefined as undefined | (() => void),
  YT: undefined as unknown,
};

function installFakeYouTubeApi(): void {
  if (state.apiInstalled) return;
  state.apiInstalled = true;

  win.YT = {
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    Player: FakeYouTubePlayer,
  };

  win.onYouTubeIframeAPIReady?.();
}

(globalThis as any).window = win;
(globalThis as any).document = {
  createElement: (tagName: string) => new FakeNode(tagName),
  head: new FakeHead("head"),
};

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

const song = {
  id: "song-1",
  title: "Bai hat kiem tra",
  sourceType: "YOUTUBE",
  sourceId: "dQw4w9WgXcQ",
} as unknown as SongDTO;

async function main(): Promise<void> {
  const container = new FakeNode("div");
  const errors: string[] = [];
  let readyEvents = 0;

  const createEngine = () =>
    new YouTubeEngine(container as unknown as HTMLElement, {
      onReady: () => {
        readyEvents += 1;
      },
      onError: (message) => {
        errors.push(message);
      },
    });

  // ---- 1. load() + play() dong thoi truoc onReady (giong React StrictMode) ----
  const engine = createEngine();

  let thrown: unknown = null;
  try {
    const loadPromise = engine.load(song, 0);
    const playA = engine.play();
    const playB = engine.play();

    // Dat am luong / tat tieng / tua TRUOC khi player san sang
    engine.setVolume(0.4);
    engine.setMuted(true);
    engine.seek(12);

    await Promise.all([loadPromise, playA, playB]);
    await sleep(PLAYER_READY_DELAY_MS + 40);
  } catch (error) {
    thrown = error;
  }

  check(
    "play()/load() truoc onReady khong nem loi",
    thrown === null,
    thrown ? String(thrown) : "khong co loi",
  );
  check(
    "Mo phong dung loi cu (object tu constructor khong co playVideo)",
    state.constructorHadPlayVideo === false,
  );
  check("Play 2 lan chi phat 1 lan", stats.playVideo === 1, `playVideo=${stats.playVideo}`);
  check("Nap dung video", stats.loadedSongs[0] === "dQw4w9WgXcQ", stats.loadedSongs.join(","));
  check(
    "Ap dung am luong dat truoc khi san sang",
    stats.volumes[stats.volumes.length - 1] === 40,
    stats.volumes.join(","),
  );
  check("Ap dung tat tieng dat truoc khi san sang", stats.mute === 1, `mute=${stats.mute}`);
  check(
    "Giu vi tri tua dat truoc khi san sang",
    stats.seekTo.includes(12),
    stats.seekTo.join(","),
  );
  check("Bao onReady dung 1 lan", readyEvents === 1, `ready=${readyEvents}`);
  check("Khong co loi nao duoc bao", errors.length === 0, errors.join(" / "));

  // ---- 2. load() lai cung bai: khong nap trung ----
  await engine.load(song, 0);
  check(
    "load() lai cung bai khong nap trung",
    stats.loadedSongs.length === 1,
    `so lan nap=${stats.loadedSongs.length}`,
  );

  // ---- 3. destroy(): don sach iframe, khong hoi sinh player ----
  engine.destroy();
  check("destroy() huy player that", stats.destroyed === 1, `destroyed=${stats.destroyed}`);

  let afterDestroyError: unknown = null;
  try {
    await engine.play();
  } catch (error) {
    afterDestroyError = error;
  }

  check("play() sau destroy() khong nem loi", afterDestroyError === null, String(afterDestroyError ?? ""));
  check(
    "destroy() don sach iframe/mount node va khong hoi sinh",
    container.querySelectorAll("iframe, [data-yt-mount]").length === 0,
  );

  // ---- 4. Khoi tao lai tren cung container sau destroy() ----
  stats.loadedSongs.length = 0;
  const revived = createEngine();
  await revived.load(song, 0);
  await revived.play();

  check(
    "Khoi tao lai tren cung container",
    stats.loadedSongs[0] === "dQw4w9WgXcQ" && stats.playVideo === 2,
    `playVideo=${stats.playVideo}`,
  );
  revived.destroy();

  // ---- 5. onReady khong bao gio chay: bao loi thay vi TypeError, va thu lai duoc ----
  stats.loadedSongs.length = 0;
  const failing = createEngine();
  state.neverReady = true;

  let neverReadyError: unknown = null;
  try {
    await failing.play();
  } catch (error) {
    neverReadyError = error;
  }

  check(
    "YouTube khong san sang: bao loi thay vi nem TypeError",
    neverReadyError === null && errors.some((message) => message.includes("chưa sẵn sàng")),
    errors[errors.length - 1] ?? "",
  );

  state.neverReady = false;
  await failing.load(song, 0);
  await failing.play();

  check(
    "Thu lai sau khi that bai thanh cong",
    stats.loadedSongs[0] === "dQw4w9WgXcQ" && stats.playVideo === 3,
    `playVideo=${stats.playVideo}`,
  );
  failing.destroy();

  // ---- 6. Ra nen: trinh duyet TAM DUNG iframe ma KHONG bắn onStateChange ----
  stats.loadedSongs.length = 0;
  const backgrounded = createEngine();
  await backgrounded.load(song, 0);
  await backgrounded.play();

  const playsBeforeSilentPause = stats.playVideo;
  check(
    "Truoc khi mo phong ra nen: dang phat binh thuong",
    backgrounded.reportsPlaying() === true,
    `playVideo=${playsBeforeSilentPause}`,
  );

  // Trinh duyet tam dung luc o nen ma khong gui su kien - chi biet khi hoi truc tiep getPlayerState()
  state.playerState = 2;

  check(
    "O nen: cờ `currentlyPlaying` van true nhung trinh phat da dung (reportsPlaying=false)",
    backgrounded.reportsPlaying() === false,
  );

  await backgrounded.play();

  check(
    "Van gui duoc lenh play (khong bi co `currentlyPlaying` cu chan) -> nhac chay lai",
    stats.playVideo === playsBeforeSilentPause + 1,
    `playVideo=${stats.playVideo} (truoc do ${playsBeforeSilentPause})`,
  );
  check("Trinh phat chay lai sau lenh play", backgrounded.reportsPlaying() === true);

  const playsWhilePlaying = stats.playVideo;
  await backgrounded.play();
  check(
    "Dang phat that su -> khong gui lenh trung",
    stats.playVideo === playsWhilePlaying,
    `playVideo=${stats.playVideo}`,
  );

  backgrounded.destroy();

  const failures = results.filter((line) => line.startsWith("FAIL"));
  console.log(results.join("\n"));
  console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error("VERIFY YOUTUBE ENGINE FAILED:", error);
  process.exitCode = 1;
});
