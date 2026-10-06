import { readFileSync } from "node:fs";
import path from "node:path";

import { AudioEngine } from "../src/components/player/engines/audio-engine";
import { TikTokEngine } from "../src/components/player/engines/tiktok-engine";
import { ratioFromPointer, volumeFromRatio } from "../src/components/player/vertical-volume-slider";
import {
  canBoostVolume,
  clampVolume,
  clampVolumeFor,
  DEFAULT_VOLUME,
  EMBED_MAX_VOLUME,
  formatVolumePercent,
  isBoosted,
  MAX_VOLUME,
  maxVolumeFor,
  needsWebAudioGraph,
  VOLUME_MARKER_PERCENT,
} from "../src/lib/volume";
import type { SongDTO } from "../src/types";

const results: string[] = [];

function check(label: string, passed: boolean, detail = ""): void {
  results.push(`${passed ? "PASS" : "FAIL"} | ${label}${detail ? ` | chi tiet: ${detail}` : ""}`);
}
class FakeAudio {
  private listeners = new Map<string, Set<() => void>>();
  private currentVolume = 1;

  src = "";
  currentTime = 0;
  duration = 180;
  muted = false;
  error: { code: number } | null = null;
  ignoreVolumeSet = false;
  seeking = false;

  get volume(): number {
    return this.currentVolume;
  }

  set volume(value: number) {
    if (this.ignoreVolumeSet) return;
    this.currentVolume = value;
  }

  addEventListener(type: string, handler: () => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }

  emit(type: string): void {
    for (const handler of this.listeners.get(type) ?? []) handler();
  }

  load(): void {
    this.emit("loadedmetadata");
  }

  play(): Promise<void> {
    this.emit("playing");
    return Promise.resolve();
  }

  pause(): void {
    this.emit("pause");
  }

  removeAttribute(): void {
  }
}
const stats = {
  sources: 0,
  gains: [] as number[],
  created: 0,
  suspended: 0,
  resumed: 0,
};

class FakeGain {
  gain: { value: number } = { value: 1 };
  connect(): void {
  }
}

class FakeLimiter {
  threshold = { value: 0 };
  knee = { value: 0 };
  ratio = { value: 0 };
  attack = { value: 0 };
  release = { value: 0 };
  connect(): void {
  }
}

class FakeSource {
  connect(): void {
    // noi vao gain
  }
}

class FakeAudioContext {
  state: "running" | "suspended" = "running";
  destination = {};

  constructor() {
    stats.created += 1;
  }

  createMediaElementSource(): FakeSource {
    stats.sources += 1;
    return new FakeSource();
  }

  createGain(): FakeGain {
    const node = new FakeGain();
    let value = 1;
    Object.defineProperty(node.gain, "value", {
      get: () => value,
      set: (next: number) => {
        value = next;
        stats.gains.push(next);
      },
    });

    return node;
  }

  createDynamicsCompressor(): FakeLimiter {
    return new FakeLimiter();
  }

  resume(): Promise<void> {
    stats.resumed += 1;
    this.state = "running";
    return Promise.resolve();
  }

  suspend(): Promise<void> {
    stats.suspended += 1;
    this.state = "suspended";
    return Promise.resolve();
  }
}

const win = {
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  AudioContext: FakeAudioContext as unknown,
};

(globalThis as Window & typeof globalThis).window = win as unknown as Window & typeof globalThis;

function makeSong(id: string): SongDTO {
  return {
    id,
    title: `Bai ${id}`,
    sourceType: "UPLOADED",
    streamUrl: `/api/files/audio/${id}.mp3`,
  } as unknown as SongDTO;
}

function makeEngine(audio: FakeAudio, errors: string[] = []) {
  return new AudioEngine(audio as unknown as HTMLAudioElement, {
    onError: (message) => errors.push(message),
    onBuffering: () => undefined,
  });
}

async function main(): Promise<void> {
  check("Am luong mac dinh la 80%", DEFAULT_VOLUME === 0.8);
  check("Toi da 200%", MAX_VOLUME === 2 && VOLUME_MARKER_PERCENT === 50);
  check("Nguon nhung gioi han 100%", EMBED_MAX_VOLUME === 1 && !canBoostVolume("YOUTUBE"));
  check("File tai len duoc khuech dai", canBoostVolume("UPLOADED"));
  check("Giam am luong trong khoang 0..1", clampVolume(-3) === 0 && clampVolume(0.35) === 0.35);
  check("Tang am luong toi 2", clampVolume(1.6) === 1.6 && clampVolume(9) === MAX_VOLUME);
  check("Gia tri khong hop le -> mac dinh", clampVolume(Number.NaN) === DEFAULT_VOLUME);
  check("Hien thi phan tram", formatVolumePercent(0.8) === "80%" && formatVolumePercent(1.5) === "150%");
  check("Nhan biet dang khuech dai", isBoosted(1.2) && !isBoosted(1) && !isBoosted(0.9));
  check(
    "File tai len: thanh truot dai toi 200%",
    maxVolumeFor("UPLOADED") === MAX_VOLUME && clampVolumeFor("UPLOADED", 1.7) === 1.7,
  );
  check(
    "Nguon nhung: thanh truot chi dai toi 100% (keo them khong to hon -> khong con chet)",
    maxVolumeFor("YOUTUBE") === EMBED_MAX_VOLUME &&
    maxVolumeFor("SOUNDCLOUD") === EMBED_MAX_VOLUME &&
    maxVolumeFor("TIKTOK") === EMBED_MAX_VOLUME,
  );
  check(
    "Am luong cu (vi du 150% cua file tai len) khi doi sang nguon nhung -> hien thi 100%",
    clampVolumeFor("YOUTUBE", 1.5) === 1 && clampVolumeFor("TIKTOK", 1.5) === 1,
    String(clampVolumeFor("YOUTUBE", 1.5)),
  );
  check(
    "Khong co bai nao dang phat: coi nhu nguon nhung (toi da 100%)",
    maxVolumeFor(null) === EMBED_MAX_VOLUME && maxVolumeFor(undefined) === EMBED_MAX_VOLUME,
  );
  const quietAudio = new FakeAudio();
  const quietEngine = makeEngine(quietAudio);
  quietEngine.setVolume(0.4);

  check(
    "Duoi 100%: dung am luong goc cua the <audio>",
    quietAudio.volume === 0.4,
    String(quietAudio.volume),
  );
  check("Duoi 100%: khong tao do thi am thanh", stats.created === 0, String(stats.created));
  const boostAudio = new FakeAudio();
  const boostEngine = makeEngine(boostAudio);
  boostEngine.setVolume(1.5);

  check("Tren 100%: tao do thi Web Audio", stats.created === 1 && stats.sources === 1);
  check(
    "Tren 100%: gain = 150% (am thanh lon hon ban goc)",
    stats.gains[stats.gains.length - 1] === 1.5,
    String(stats.gains[stats.gains.length - 1]),
  );
  check(
    "Tren 100%: am luong the <audio> giu o 100% (khong bi gioi han)",
    boostAudio.volume === 1,
    String(boostAudio.volume),
  );

  boostEngine.setVolume(MAX_VOLUME);
  check(
    "Keo len 200%: gain = 2",
    stats.gains[stats.gains.length - 1] === 2,
    String(stats.gains[stats.gains.length - 1]),
  );

  boostEngine.setVolume(0.5);
  check(
    "Keo xuong 50%: gain = 0.5 (van dung do thi da tao)",
    stats.gains[stats.gains.length - 1] === 0.5,
    String(stats.gains[stats.gains.length - 1]),
  );

  const reusedEngine = makeEngine(boostAudio);
  reusedEngine.setVolume(1.8);

  check(
    "Doi engine moi tren cung the <audio>: khong tao lai do thi",
    stats.created === 1 && stats.sources === 1,
    `created=${stats.created} sources=${stats.sources}`,
  );
  check(
    "Van ap dung duoc gain sau khi tao lai engine",
    stats.gains[stats.gains.length - 1] === 1.8,
    String(stats.gains[stats.gains.length - 1]),
  );
  await reusedEngine.load(makeSong("bai-1"), 0);
  await reusedEngine.play();

  check("Phat nhac van hoat dong khi dang khuech dai", stats.resumed >= 0);
  const limitedAudio = new FakeAudio();
  const noContextWindow = {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  } as unknown as Window & typeof globalThis;

  (globalThis as Window & typeof globalThis).window = noContextWindow;

  const limitedEngine = makeEngine(limitedAudio);
  limitedEngine.setVolume(1.7);

  check(
    "Khong co Web Audio: tu dong gioi han 100% (khong loi)",
    limitedAudio.volume === 1,
    String(limitedAudio.volume),
  );

  (globalThis as Window & typeof globalThis).window = win as unknown as Window & typeof globalThis;
  boostEngine.destroy();

  check("destroy() tam dung bo xu ly am thanh", stats.suspended === 1, String(stats.suspended));
  class HangingAudioContext extends FakeAudioContext {
    state: "running" | "suspended" = "suspended";

    override resume(): Promise<void> {
      stats.resumed += 1;
      return new Promise<void>(() => undefined);
    }
  }

  const suspendedBeforeHang = stats.suspended;
  win.AudioContext = HangingAudioContext;

  const hangingAudio = new FakeAudio();
  let hangingPlayed = false;
  hangingAudio.addEventListener("playing", () => {
    hangingPlayed = true;
  });

  const hangingEngine = makeEngine(hangingAudio);
  hangingEngine.setVolume(1.5);
  await hangingEngine.load(makeSong("bai-treo"), 0);
  await hangingEngine.play();

  check(
    "resume() treo (WebKit bug 281566): play() van chay duoc - khong de bam Phat mat tac dung",
    hangingPlayed,
  );
  check(
    "resume() treo: dung meo suspend() truoc roi resume() lai (khong chi cho vo han)",
    stats.suspended > suspendedBeforeHang,
    `suspended=${stats.suspended - suspendedBeforeHang}`,
  );

  win.AudioContext = FakeAudioContext;
  check(
    "Muc <= 100%: KHONG dung Web Audio (ke ca khi trinh duyet bo qua audio.volume)",
    !needsWebAudioGraph(0) && !needsWebAudioGraph(0.8) && !needsWebAudioGraph(EMBED_MAX_VOLUME),
  );
  check(
    "Muc > 100%: moi dung Web Audio de khuech dai",
    needsWebAudioGraph(1.01) && needsWebAudioGraph(MAX_VOLUME),
  );

  const createdBefore = stats.created;
  const gainsBefore = stats.gains.length;
  const stubbornAudio = new FakeAudio();
  stubbornAudio.ignoreVolumeSet = true;

  const stubbornEngine = makeEngine(stubbornAudio);
  stubbornEngine.setVolume(0.4);

  check(
    "Trinh duyet bo qua audio.volume (iOS): KHONG tao do thi Web Audio",
    stats.created === createdBefore && !stubbornEngine.usesWebAudio,
    `created=${stats.created}`,
  );
  check(
    "Trinh duyet bo qua audio.volume (iOS): khong dat gain nao (khong co do thi)",
    stats.gains.length === gainsBefore,
    `gains=${stats.gains.length - gainsBefore}`,
  );
  check(
    "Trinh duyet bo qua audio.volume (iOS): bao cho giao dien biet am luong do he thong quan ly",
    stubbornEngine.volumeNeedsSystemControl,
  );

  stubbornEngine.setVolume(0.9);
  check(
    "iOS: chinh tiep trong khoang 0..100% van KHONG tao do thi",
    stats.created === createdBefore,
    `created=${stats.created}`,
  );

  stubbornEngine.setVolume(1.4);
  check(
    "iOS: nguoi dung chon tren 100% -> moi tao do thi (nhuong kha nang nghe nen de doi am luong lon hon)",
    stats.created === createdBefore + 1 && stubbornEngine.usesWebAudio,
    `created=${stats.created}`,
  );
  const afterBoostEngine = makeEngine(stubbornAudio);
  const createdAfterBoost = stats.created;

  afterBoostEngine.setVolume(0.5);
  check(
    "The <audio> da co do thi: engine moi dung lai do thi cu (khong tao them, gain dung 50%)",
    stats.created === createdAfterBoost &&
    stats.gains[stats.gains.length - 1] === 0.5 &&
    afterBoostEngine.usesWebAudio,
    `created=${stats.created} gain=${stats.gains[stats.gains.length - 1]}`,
  );
  const seekAudio = new FakeAudio();
  const seekReports: number[] = [];
  const seekEngine = new AudioEngine(seekAudio as unknown as HTMLAudioElement, {
    onTimeUpdate: (time) => seekReports.push(time),
  });

  seekEngine.seek(90);
  check("Tua bai: dat dung vi tri tren the <audio>", seekAudio.currentTime === 90, String(seekAudio.currentTime));
  seekAudio.seeking = true;
  seekAudio.emit("timeupdate");
  check(
    "Dang tua: bo qua bao cao vi tri cu (thanh thoi gian khong nhay nguoc)",
    seekReports.length === 0,
    seekReports.join(","),
  );
  seekAudio.seeking = false;
  seekAudio.emit("seeked");
  check(
    "Tua xong: bao dung vi tri moi",
    seekReports.length === 1 && seekReports[0] === 90,
    seekReports.join(","),
  );

  seekEngine.seek(9999);
  check(
    "Tua vuot thoi luong: gioi han o cuoi bai (khong dat vi tri ngoai bai)",
    seekAudio.currentTime === 180,
    String(seekAudio.currentTime),
  );

  seekAudio.currentTime = 95;
  seekAudio.emit("timeupdate");
  check(
    "Sau khi tua: tien do van cap nhat binh thuong",
    seekReports[seekReports.length - 1] === 95,
    seekReports.join(","),
  );
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
  const playerBar = read("src/components/player/player-bar.tsx");
  const fullPlayer = read("src/components/player/full-player.tsx");
  const audioEngine = read("src/components/player/engines/audio-engine.ts");
  const rangeInput = read("src/components/player/range-input.tsx");
  const verticalSlider = read("src/components/player/vertical-volume-slider.tsx");
  const soundcloudEngine = read("src/components/player/engines/soundcloud-engine.ts");
  const constants = read("src/lib/constants.ts");

  check(
    "Thanh phat nho: nut am luong toi muc toi da cua nguon (200% voi file tai len)",
    playerBar.includes("max={volumeMax}") &&
    playerBar.includes("maxVolumeFor(current.sourceType)") &&
    playerBar.includes("markerPercent={canBoost ? VOLUME_MARKER_PERCENT : undefined}") &&
    playerBar.includes("formatVolumePercent"),
  );
  check(
    "Trinh phat day du: hien % am luong + noi ro nguon nhung toi da 100%",
    fullPlayer.includes("max={volumeMax}") &&
    fullPlayer.includes("Nguồn nhúng (YouTube/SoundCloud/TikTok) tối đa 100%") &&
    fullPlayer.includes("clampVolumeFor") &&
    fullPlayer.includes("canBoostVolume"),
  );
  check(
    "Trinh phat day du: co nut ve 100% khi dang khuech dai",
    fullPlayer.includes("Về 100%") && fullPlayer.includes("isBoosted(displayVolume)"),
  );
  check(
    "Thanh am luong KHONG bao gio bi khoa (nguon chi ho tro tat/bat tieng van keo duoc)",
    !fullPlayer.includes("disabled={!capabilities.canSetVolume}") &&
    !playerBar.includes("capabilities.canSetVolume") &&
    fullPlayer.includes('Nguồn TikTok: thanh trượt chỉ bật/tắt tiếng'),
  );
  check(
    "Engine file tai len: khuech dai bang GainNode + limiter chong vo tieng",
    audioEngine.includes("createGain()") &&
    audioEngine.includes("createDynamicsCompressor()") &&
    audioEngine.includes("gain.gain.value = this.volume"),
  );
  check(
    "Thanh phat nho: dien thoai co thanh am luong rieng (truoc day bi an -> khong chinh duoc)",
    playerBar.includes('className="flex items-center gap-2 sm:hidden" data-mobile-volume') &&
    (playerBar.match(/max=\{volumeMax\}/g) ?? []).length >= 2,
  );
  const closeTo = (value: number, expected: number, epsilon = 1e-9): boolean =>
    Math.abs(value - expected) < epsilon;

  check(
    "Dien thoai: icon loa mo panel co thanh truot DUNG (keo len = to hon, keo xuong = nho hon)",
    playerBar.includes("<VerticalVolumeSlider") &&
    playerBar.includes("<Dropdown") &&
    playerBar.includes('side="top"') &&
    playerBar.includes("Kéo lên để to hơn") &&
    playerBar.includes("setVolume(volumeMax)") &&
    playerBar.includes("toggleMute()"),
  );
  check(
    "Panel am luong mobile mo SANG PHAI + rong theo man hinh (nut loa o dau hang nen align=right se day panel ra ngoai)",
    playerBar.includes('align="left"') &&
    playerBar.includes('className="w-[min(82vw,300px)] p-3"') &&
    !playerBar.includes('align="right"'),
  );
  check(
    "Panel am luong mobile khong bi CAT noi dung: cot chu co the co lai, nut rong het cot",
    playerBar.includes("flex min-w-0 flex-1 flex-col gap-2") &&
    playerBar.includes("break-words text-[10px]") &&
    (playerBar.match(/h-9 w-full justify-center/g) ?? []).length === 2,
  );

  check(
    "Thanh truot dung: KHONG con input xoay -90deg (vung cham 22px nen keo bi truot ra ngoai)",
    !playerBar.includes('orientation="vertical"') &&
    !rangeInput.includes("orientation") &&
    !rangeInput.includes("-rotate-90"),
  );
  check(
    "Thanh truot dung: khung cham 44x160px + keo bang pointer events (setPointerCapture)",
    verticalSlider.includes(
      '"relative h-40 w-11 shrink-0 cursor-pointer touch-none select-none rounded-2xl bg-surface/70 outline-none"',
    ) &&
    verticalSlider.includes("setPointerCapture(event.pointerId)") &&
    verticalSlider.includes("onPointerMove") &&
    verticalSlider.includes("hasPointerCapture(event.pointerId)"),
  );
  check(
    "Thanh truot dung: `touch-none` + `data-dropdown-keep-open` (khong cuon panel, panel khong tu dong khi keo)",
    verticalSlider.includes("touch-none") &&
    verticalSlider.includes("data-dropdown-keep-open") &&
    !rangeInput.includes("touch-none"),
  );
  check(
    "Thanh truot dung: tinh am luong theo VI TRI ngon tay (day = 0%, dinh = 100%)",
    ratioFromPointer({ clientY: 260, top: 100, height: 160 }) === 0 &&
    ratioFromPointer({ clientY: 180, top: 100, height: 160 }) === 0.5 &&
    ratioFromPointer({ clientY: 100, top: 100, height: 160 }) === 1 &&
    ratioFromPointer({ clientY: 0, top: 100, height: 160 }) === 1 &&
    ratioFromPointer({ clientY: 999, top: 100, height: 160 }) === 0 &&
    ratioFromPointer({ clientY: 10, top: 10, height: 0 }) === 0,
  );
  check(
    "Thanh truot dung: lam tron theo buoc va khong vuot qua muc toi da",
    closeTo(volumeFromRatio(0.5, 1, 0.01), 0.5) &&
    volumeFromRatio(0.6, 1, 0.5) === 0.5 &&
    volumeFromRatio(0.74, 1, 0.25) === 0.75 &&
    volumeFromRatio(1, 2, 0.05) === 2 &&
    volumeFromRatio(2, 1, 0.01) === 1 &&
    volumeFromRatio(0.5, 0, 0.01) === 0,
  );
  check(
    "Thanh truot dung: van co vach moc 100% va vung khuech dai to mau khac",
    verticalSlider.includes("bg-foreground/40") &&
    verticalSlider.includes("bottom: `${markerPercent}%`") &&
    verticalSlider.includes("bg-[var(--brand-alt)]") &&
    playerBar.includes("markerPercent={canBoost ? VOLUME_MARKER_PERCENT : undefined}"),
  );
  check(
    "Thanh truot dung: dung duoc bang ban phim va doc duoc bang trinh doc man hinh",
    verticalSlider.includes('role="slider"') &&
    verticalSlider.includes('aria-orientation="vertical"') &&
    verticalSlider.includes("aria-valuenow") &&
    verticalSlider.includes('event.key === "ArrowUp"') &&
    verticalSlider.includes('event.key === "End"'),
  );
  check(
    "Thanh truot ngang khong bi doi hanh vi (van dung chung `sliderProps`)",
    rangeInput.includes('className={cn("w-full", sliderClass, className)}'),
  );
  check(
    "Thanh truot: vung cham 22px o MOI kich thuoc man hinh (truoc day desktop chi 6px -> kho keo)",
    rangeInput.includes('"h-[22px] rounded-full py-2 bg-clip-content"') &&
    !rangeInput.includes('"sm:h-1.5 sm:py-0"') &&
    !rangeInput.includes("sm:[&::-webkit-slider-thumb]:size-3"),
  );
  check(
    "Nguon chi ho tro tat/bat tieng: ghi ro trong ghi chu (co chi dan nut loa trong video)",
    constants.includes("nút loa trong khung video"),
  );
  check(
    "SoundCloud: keo am luong khong bi ghi de ve muc mac dinh (khong con hardcode 70)",
    soundcloudEngine.includes("lastVolume") &&
    !soundcloudEngine.includes("muted ? 0 : 70") &&
    soundcloudEngine.includes("private applyVolume()"),
  );
  const posted: { type: string; value?: unknown }[] = [];

  const fakeIframe = {
    src: "",
    allow: "",
    width: "",
    height: "",
    title: "",
    contentWindow: {
      postMessage: (message: { type: string; value?: unknown }) => void posted.push(message),
    },
    setAttribute: () => undefined,
    addEventListener: (type: string, handler: () => void) => {
      if (type === "load") setTimeout(handler, 0);
    },
    remove: () => undefined,
  };

  const fakeContainer = { appendChild: () => undefined } as unknown as HTMLElement;

  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => fakeIframe,
  };

  const tiktokEngine = new TikTokEngine(fakeContainer, { onError: () => undefined });
  await tiktokEngine.load({
    id: "tt-1",
    title: "Video TikTok",
    sourceType: "TIKTOK",
    embedUrl: "https://www.tiktok.com/player/v1/123?autoplay=0",
  } as unknown as SongDTO);

  tiktokEngine.setVolume(0.5);
  check(
    "TikTok: keo am luong (muc bat ky) -> bat tieng",
    posted[posted.length - 1]?.type === "unMute",
    posted.map((message) => message.type).join(","),
  );
  tiktokEngine.setVolume(0);
  tiktokEngine.setMuted(false);
  check(
    "TikTok: keo am luong ve 0% -> tat tieng (setMuted(false) khong bat tieng lai)",
    posted[posted.length - 1]?.type === "mute",
    posted.map((message) => message.type).join(","),
  );

  tiktokEngine.setVolume(0.8);
  check(
    "TikTok: keo am luong len lai -> co tieng",
    posted[posted.length - 1]?.type === "unMute",
    posted.map((message) => message.type).join(","),
  );

  tiktokEngine.setMuted(true);
  check(
    "TikTok: bam nut tat tieng -> mute",
    posted[posted.length - 1]?.type === "mute",
    posted.map((message) => message.type).join(","),
  );

  posted.length = 0;
  await tiktokEngine.play();
  check(
    "TikTok: phat lai khong tu bat tieng khi nguoi dung dang tat tieng",
    posted.some((message) => message.type === "play") &&
    !posted.some((message) => message.type === "unMute"),
    posted.map((message) => message.type).join(","),
  );

  tiktokEngine.setMuted(false);
  posted.length = 0;
  await tiktokEngine.play();
  check(
    "TikTok: phat lai khi dang co tieng -> unMute",
    posted.some((message) => message.type === "unMute"),
    posted.map((message) => message.type).join(","),
  );

  check(
    "TikTok: muc am luong duoc gioi han toi 100% (nen tang chan khuech dai)",
    tiktokEngine !== null && maxVolumeFor("TIKTOK") === EMBED_MAX_VOLUME,
  );

  tiktokEngine.destroy();

  const failures = results.filter((line) => line.startsWith("FAIL"));
  console.log(results.join("\n"));
  console.log(`\nTONG KET: ${results.length - failures.length} PASS / ${failures.length} FAIL`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error("VERIFY VOLUME FAILED:", error);
  process.exitCode = 1;
});
