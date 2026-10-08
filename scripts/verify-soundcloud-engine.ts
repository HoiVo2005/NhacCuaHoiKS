/**
 * Kiem tra dong co SoundCloud (loi "nhac phat nhung thoi gian khong chay"):
 *   npx tsx scripts/verify-soundcloud-engine.ts
 *
 * Nguyen nhan goc: code cu lay su kien o `SC.WidgetEvents` trong khi API chinh thuc
 * nam o `SC.Widget.Events` -> `events` la undefined -> bindWidgetEvents() nem loi
 * -> khong su kien nao duoc dang ky (khong playProgress, khong finish, khong duration)
 * -> nhac van chay nhung thanh thoi gian dung yen.
 */
import { SoundCloudEngine } from "../src/components/player/engines/soundcloud-engine";
import { fetchSoundCloudTrackInfo } from "../src/lib/music/soundcloud-widget-client";
import type { SongDTO } from "../src/types";

// ----------------------------------------------------------------- window stub
(globalThis as Window & typeof globalThis).window = {
  setTimeout: (...args: unknown[]) => setTimeout(...(args as [() => void, number])),
  clearTimeout: (id: number) => clearTimeout(id),
  setInterval: (...args: unknown[]) => setInterval(...(args as [() => void, number])),
  clearInterval: (id: number) => clearInterval(id),
} as unknown as Window & typeof globalThis;

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class FakeNode {
  tagName: string;
  src = "";
  title = "";
  allow = "";
  width = "";
  height = "";
  frameBorder = "";
  style: Record<string, string> = {};
  children: FakeNode[] = [];
  parent: FakeNode | null = null;

  private listeners = new Map<string, Set<(event?: unknown) => void>>();

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  addEventListener(type: string, handler: (event?: unknown) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }

  emit(type: string, event?: unknown): void {
    for (const handler of this.listeners.get(type) ?? []) handler(event);
  }

  appendChild<T extends FakeNode>(child: T): T {
    child.parent = this;
    this.children.push(child);

    // Trinh duyet ban su kien 'load' cua iframe sau khi duoc gan vao DOM
    if (child.tagName === "iframe") {
      queueMicrotask(() => child.emit("load"));
    }

    return child;
  }

  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }
}

/** document stub: dong co tao the <iframe> bang document.createElement */
(globalThis as unknown as { document: unknown }).document = {
  createElement: (tagName: string) => new FakeNode(tagName),
  head: new FakeNode("head"),
  body: new FakeNode("body"),
};

/** Su kien chuan cua SoundCloud Widget API */
const SC_EVENTS = {
  READY: "ready",
  PLAY: "play",
  PAUSE: "pause",
  FINISH: "finish",
  PLAY_PROGRESS: "playProgress",
  LOAD_PROGRESS: "loadProgress",
  SEEK: "seek",
  ERROR: "error",
};

class FakeWidget {
  iframe: FakeNode;
  bound: string[] = [];
  unbound: string[] = [];
  playing = false;
  positionMs = 0;
  durationMs = 210_000;
  /** Am luong hien tai cua widget (0..100), mac dinh SoundCloud la 100 */
  volume = 100;
  volumes: number[] = [];

  private listeners = new Map<string, Set<(data?: unknown) => void>>();

  constructor(iframe: FakeNode) {
    this.iframe = iframe;
  }

  bind(event: string, listener: (data?: unknown) => void): void {
    this.bound.push(event);
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);

    // Widget that ban su kien READY ngay khi tai xong bai nhac
    if (event === "ready") {
      queueMicrotask(() => this.dispatch("ready"));
    }
  }

  unbind(event: string): void {
    this.unbound.push(event);
    this.listeners.delete(event);
  }

  dispatch(event: string, data?: unknown): void {
    for (const handler of this.listeners.get(event) ?? []) handler(data);
  }

  play(): void {
    this.playing = true;
    this.dispatch("play");
  }

  pause(): void {
    this.playing = false;
    this.dispatch("pause");
  }

  seekTo(milliseconds: number): void {
    this.positionMs = milliseconds;
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.volumes.push(volume);
  }

  getDuration(callback: (duration: number) => void): void {
    callback(this.durationMs);
  }

  getPosition(callback: (position: number) => void): void {
    callback(this.positionMs);
  }

  isPaused(callback: (paused: boolean) => void): void {
    callback(!this.playing);
  }

  getCurrentSound(callback: (sound: unknown) => void): void {
    callback({ title: "Bai kiem tra", duration: this.durationMs, user: { username: "Nghe si" } });
  }
}

let lastWidget: FakeWidget | null = null;

const widgetFactory = ((iframe: FakeNode) => {
  lastWidget = new FakeWidget(iframe);
  return lastWidget;
}) as unknown as { (iframe: FakeNode): FakeWidget; Events?: Record<string, string> };

widgetFactory.Events = { ...SC_EVENTS };

(globalThis as Window & typeof globalThis).window.SC = { Widget: widgetFactory } as never;

function makeSong(id: string, durationSeconds: number): SongDTO {
  return {
    id,
    title: `Bai ${id}`,
    sourceType: "SOUNDCLOUD",
    embedUrl: `https://w.soundcloud.com/player/?url=${id}`,
    durationSeconds,
  } as unknown as SongDTO;
}

async function main(): Promise<void> {
  const container = new FakeNode("div");
  const events: string[] = [];
  const timeUpdates: Array<{ time: number; duration: number }> = [];

  const engine = new SoundCloudEngine(container as unknown as HTMLElement, {
    onReady: () => events.push("ready"),
    onPlay: () => events.push("play"),
    onPause: () => events.push("pause"),
    onEnded: () => events.push("ended"),
    onDuration: (duration) => events.push(`duration:${Math.round(duration)}`),
    onTimeUpdate: (time, duration) => timeUpdates.push({ time, duration }),
    onError: (message) => events.push(`error:${message}`),
  });

  // ------------------------------------------------- 1. Nap bai (chua co thoi luong)
  await engine.load(makeSong("track-1", 0), 0);
  await sleep(20);

  const widget = lastWidget;
  const boundNames = widget?.bound ?? [];
  check("Tao duoc widget SoundCloud", Boolean(widget));
  check(
    "Da dang ky du su kien voi ten chuan cua SC",
    boundNames.includes("playProgress") &&
      boundNames.includes("finish") &&
      boundNames.includes("ready"),
    boundNames.join(","),
  );
  check("Doc duoc thoi luong tu widget", events.includes("duration:210"), events.join(","));

  // reportsPlaying: dung cho cac lenh "dap lai lenh phat" khi quay lai tien canh
  // (truoc day SoundCloud khong tra loi -> bi bo qua khoang dap nay)
  check("reportsPlaying(): false khi moi nap bai (chua phat)", engine.reportsPlaying() === false);

  // --------------------------------------------------------------- 2. Phat nhac
  await engine.play();
  await sleep(20);
  check("Bao su kien play", events.includes("play"), events.join(","));
  check("reportsPlaying(): dung true sau su kien PLAY", engine.reportsPlaying() === true);

  // ---- 3. Widget khong ban playProgress -> dong ho du phong van phai chay
  timeUpdates.length = 0;
  if (widget) widget.positionMs = 5000;

  await sleep(1150);

  check(
    "Widget KHONG ban playProgress: thoi gian van chay nho getPosition()",
    timeUpdates.length > 0 && timeUpdates[timeUpdates.length - 1].time >= 5,
    timeUpdates.map((entry) => entry.time).join(","),
  );
  check(
    "Tien do kem theo tong thoi luong de ve thanh thoi gian",
    timeUpdates.length > 0 && timeUpdates[timeUpdates.length - 1].duration === 210,
    String(timeUpdates[timeUpdates.length - 1]?.duration),
  );

  // ------------------------------- 4. Su kien playProgress van duoc uu tien
  timeUpdates.length = 0;
  widget?.dispatch("playProgress", { currentPosition: 8000 });
  check(
    "Su kien playProgress cap nhat dung vi tri",
    timeUpdates.length === 1 && Math.round(timeUpdates[0].time) === 8,
    timeUpdates.map((entry) => entry.time).join(","),
  );

  // ------------------------------------------------------ 5. Het bai -> onEnded
  widget?.dispatch("finish");
  check("Su kien finish bao het bai (tu chuyen bai)", events.includes("ended"), events.join(","));

  // ----------------------------------------- 6. Tam dung thi dung dong ho du phong
  await engine.pause();
  timeUpdates.length = 0;
  if (widget) widget.positionMs = 12000;
  await sleep(1150);
  check("Tam dung: khong con cap nhat tien do", timeUpdates.length === 0, String(timeUpdates.length));
  check("reportsPlaying(): dung false sau su kien PAUSE", engine.reportsPlaying() === false);

  // ----------------------------------------------------------- 7. Doi bai khac
  events.length = 0;
  await engine.load(makeSong("track-2", 180), 0);
  await sleep(20);
  check(
    "Doi bai: bao thoi luong co san trong CSDL ngay lap tuc",
    events.includes("duration:180"),
    events.join(","),
  );

  // ------------------------------- 8. Doi bai khac URL -> tao widget moi, don dep
  const firstWidget = lastWidget;
  const firstBoundCount = firstWidget?.bound.length ?? 0;
  await engine.load(makeSong("track-3", 0), 0);
  await sleep(20);
  check(
    "Doi URL moi: widget cu duoc huy (unbind dung so su kien da bind)",
    firstBoundCount > 0 && (firstWidget?.unbound.length ?? 0) === firstBoundCount,
    `bound=${firstBoundCount} | unbound=${firstWidget?.unbound.length ?? 0}`,
  );
  check(
    "Doi URL moi: tao widget moi thanh cong",
    lastWidget !== firstWidget && Boolean(lastWidget),
    `widget moi bound=${lastWidget?.bound.length ?? 0}`,
  );

  // --------------------------------------------------- 9. destroy() don sach
  engine.destroy();
  check(
    "destroy(): xoa iframe khoi container",
    container.children.length === 0,
    String(container.children.length),
  );

  // ---------- 10. Truong hop API thieu SC.Widget.Events (dung loi cu) ----------
  delete (widgetFactory as { Events?: Record<string, string> }).Events;

  const container2 = new FakeNode("div");
  const events2: string[] = [];
  const timeUpdates2: number[] = [];

  const engine2 = new SoundCloudEngine(container2 as unknown as HTMLElement, {
    onPlay: () => events2.push("play"),
    onDuration: (duration) => events2.push(`duration:${Math.round(duration)}`),
    onTimeUpdate: (time) => timeUpdates2.push(time),
    onEnded: () => events2.push("ended"),
    onError: (message) => events2.push(`error:${message}`),
  });

  await engine2.load(makeSong("track-4", 0), 0);
  await sleep(20);
  await engine2.play();
  await sleep(20);

  const widget2 = lastWidget;
  const boundNames2 = widget2?.bound ?? [];
  check(
    "API thieu SC.Widget.Events: van bind duoc bang ten du phong",
    boundNames2.includes("playProgress") && boundNames2.includes("finish"),
    boundNames2.join(","),
  );
  check(
    "API thieu SC.Widget.Events: khong bao loi",
    !events2.some((entry) => entry.startsWith("error:")),
    events2.join(","),
  );

  timeUpdates2.length = 0;
  if (widget2) widget2.positionMs = 7000;
  await sleep(1150);
  check(
    "API thieu SC.Widget.Events: thoi gian van chay",
    timeUpdates2.length > 0 && timeUpdates2[timeUpdates2.length - 1] >= 7,
    timeUpdates2.map((value) => Math.round(value)).join(","),
  );

  engine2.destroy();

  // ------ 11. Bo tro metadata tren trinh duyet (nut "Bo sung thong tin tu SoundCloud") ------
  const info = await fetchSoundCloudTrackInfo("https://soundcloud.com/nghe-si/bai-hat");

  check(
    "Bo tro metadata tu widget: duoc ten/nghe si/thoi luong",
    Boolean(info) &&
      info?.title === "Bai kiem tra" &&
      info?.artist === "Nghe si" &&
      info?.durationSeconds === 210,
    JSON.stringify(info),
  );

  // --------------------- 12. Am luong: khong bi ghi de / khong mat khi doi bai ------------------
  // player-engine.tsx luon goi setVolume() roi setMuted() lien nhau moi khi nguoi dung keo am luong,
  // nen setMuted(false) phai KHOI PHUC dung muc nguoi dung da chon (truoc day hardcode 70).
  const container3 = new FakeNode("div");
  const volumeErrors: string[] = [];

  const engine3 = new SoundCloudEngine(container3 as unknown as HTMLElement, {
    onError: (message) => volumeErrors.push(`error:${message}`),
  });

  await engine3.load(makeSong("track-5", 120), 0);
  await sleep(20);

  const volumeWidget = lastWidget;

  check(
    "Widget moi: ap dung am luong mac dinh cua ung dung (80%)",
    volumeWidget?.volume === 80,
    String(volumeWidget?.volume),
  );

  // Nguoi dung keo am luong: store goi setVolume(value) roi setMuted(false)
  engine3.setVolume(0.35);
  engine3.setMuted(false);

  check(
    "Keo am luong 35%: widget dung 35 (khong bi ghi de ve muc mac dinh)",
    volumeWidget?.volume === 35,
    String(volumeWidget?.volume),
  );

  engine3.setMuted(true);
  check("Tat tieng: widget ve 0", volumeWidget?.volume === 0, String(volumeWidget?.volume));

  engine3.setMuted(false);
  check(
    "Bat tieng lai: khoi phuc dung 35% nguoi dung da chon (khong con hardcode 70)",
    volumeWidget?.volume === 35,
    String(volumeWidget?.volume),
  );

  // Doi bai -> widget moi phai giu dung am luong nguoi dung da chon
  await engine3.load(makeSong("track-6", 200), 0);
  await sleep(20);

  const volumeWidgetAfterSwitch = lastWidget;

  check(
    "Doi bai: widget moi van giu dung am luong nguoi dung (khong quay ve 100%)",
    volumeWidgetAfterSwitch !== volumeWidget && volumeWidgetAfterSwitch?.volume === 35,
    String(volumeWidgetAfterSwitch?.volume),
  );

  engine3.setVolume(2);
  check(
    "Nguon nhung: muc 200% tren giao dien duoc quy ve 100% thuc te",
    volumeWidgetAfterSwitch?.volume === 100,
    String(volumeWidgetAfterSwitch?.volume),
  );

  check("Khong phat sinh loi khi chinh am luong", volumeErrors.length === 0, volumeErrors.join(","));

  engine3.destroy();

  const failures = results.filter((line) => line.startsWith("FAIL"));
  console.log(results.join("\n"));
  console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error("VERIFY SOUNDCLOUD ENGINE FAILED:", error);
  process.exitCode = 1;
});
