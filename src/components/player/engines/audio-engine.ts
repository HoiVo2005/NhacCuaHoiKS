import type { SongDTO } from "@/types";
import { reapplyBackgroundAudioSession } from "@/lib/audio-session";
import { clampSeekTarget } from "@/lib/seek";
import { EMBED_MAX_VOLUME, MAX_VOLUME, needsWebAudioGraph } from "@/lib/volume";

import type { PlayerAdapterCallbacks, PlayerEngine } from "./types";

/** Cho bo xu ly 200ms truoc khi thu danh thuc lai (meo trong WebKit bug 281566) */
const GRAPH_RESUME_DELAY_MS = 200;
/** Gian cach giua hai lan thu danh thuc (trinh duyet co the ban statechange lien tuc) */
const GRAPH_RESUME_COOLDOWN_MS = 5_000;

interface AudioGraph {
  context: AudioContext;
  gain: GainNode;
}

/**
 * Moi the <audio> chi tao duoc MOT MediaElementSourceNode, nen do thi am thanh
 * duoc luu theo chinh phan tu do va dung lai cho moi lan khoi tao lai engine.
 */
const audioGraphs = new WeakMap<HTMLMediaElement, AudioGraph>();

/**
 * Bo xu ly am thanh (Web Audio) co the bi trinh duyet TREO khi trang ra nen / thiet bi ngu.
 *
 * iOS coi Web Audio la am thanh "ambient" nen chan ngay khi app khong con o tien canh (WebKit bug
 * 198277); tu iOS 17.5 thi `navigator.audioSession.type = "playback"` moi giu duoc (bug 261554).
 * Rieng iOS con co loi `resume()` KHONG BAO GIO xong khi trinh duyet vua bi treo xuong nen (WebKit
 * bug 281566) - meo trong chinh bug do: goi `suspend()` TRUOC roi `resume()` sau ~200ms.
 *
 * Chi danh thuc khi the <audio> dang o trang thai phat that (`paused === false`) va co gian cach giua
 * hai lan thu, nen khong the thanh vong lap.
 */
function watchGraphResume(context: AudioContext, audio: HTMLMediaElement): void {
  const listenable = context as AudioContext & {
    addEventListener?: (type: "statechange", listener: () => void) => void;
  };

  if (typeof listenable.addEventListener !== "function") return;

  let lastAttemptAt = 0;

  listenable.addEventListener("statechange", () => {
    if (context.state !== "suspended") return;
    // Dang tam dung that (hoac vua destroy) thi khong danh thuc
    if (audio.paused !== false) return;

    const now = Date.now();
    if (now - lastAttemptAt < GRAPH_RESUME_COOLDOWN_MS) return;
    lastAttemptAt = now;

    void context.suspend().catch(() => undefined);
    window.setTimeout(() => {
      void context.resume().catch(() => undefined);
    }, GRAPH_RESUME_DELAY_MS);
  });
}

/**
 * Tao do thi am thanh: <audio> -> gain -> limiter -> loa.
 * Gain > 1 cho phep am thanh LON HON ban goc (the <audio> thuong bi gioi han 100%).
 * Limiter (DynamicsCompressor) giup bot vo tieng khi khuech dai qua cao.
 */
function createAudioGraph(audio: HTMLAudioElement): AudioGraph | null {
  const existing = audioGraphs.get(audio);
  if (existing) return existing;

  const ContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!ContextClass) return null;

  try {
    const context = new ContextClass();
    const source = context.createMediaElementSource(audio);
    const gain = context.createGain();

    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    source.connect(gain);
    gain.connect(limiter);
    limiter.connect(context.destination);

    // Bo xu ly co the bi treo khi app ra nen -> tu danh thuc lai (xem `watchGraphResume`)
    watchGraphResume(context, audio);

    const graph: AudioGraph = { context, gain };
    audioGraphs.set(audio, graph);
    return graph;
  } catch {
    // Trinh duyet khong ho tro Web Audio -> chi dung duoc toi da 100%
    return null;
  }
}

/** Phat file nhac noi bo bang the <audio> cua HTML5 */
export class AudioEngine implements PlayerEngine {
  readonly type = "DIRECT";

  private audio: HTMLAudioElement;
  private callbacks: PlayerAdapterCallbacks;
  private lastReportedSecond = -1;
  private graph: AudioGraph | null = null;
  private volume = 1;
  /** Trinh duyet bo qua `audio.volume` (iOS Safari) -> muc duoi 100% do he thong quan ly */
  private elementVolumeIgnored = false;

  constructor(audio: HTMLAudioElement, callbacks: PlayerAdapterCallbacks) {
    this.audio = audio;
    this.callbacks = callbacks;
    this.bindEvents();
  }

  /**
   * Trong luc chuyen bai: thay `src` cua the <audio> hoac tam dung dong co khac
   * deu lam phat sinh su kien `pause` - khong duoc coi la nguoi dung tam dung.
   */
  private suppressPauseEvent = false;

  private bindEvents(): void {
    this.audio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
        this.callbacks.onDuration?.(this.audio.duration);
      }
      this.callbacks.onBuffering?.(false);
      this.callbacks.onReady?.();
    });

    this.audio.addEventListener("timeupdate", () => {
      // Trong luc dang tua, trinh duyet co the ban timeupdate voi vi tri CU
      // -> bo qua de thanh thoi gian khong nhay nguoc (vi tri cuoi duoc bao o su kien `seeked`)
      if (this.audio.seeking) return;

      const currentTime = this.audio.currentTime;
      const second = Math.floor(currentTime);
      if (second === this.lastReportedSecond) return;
      this.lastReportedSecond = second;

      this.callbacks.onTimeUpdate?.(
        currentTime,
        Number.isFinite(this.audio.duration) ? this.audio.duration : 0,
      );
    });

    // Tua xong: bao dung vi tri moi (ke ca khi dang tam dung - khong co timeupdate)
    this.audio.addEventListener("seeked", () => {
      this.lastReportedSecond = Math.floor(this.audio.currentTime);

      this.callbacks.onTimeUpdate?.(
        this.audio.currentTime,
        Number.isFinite(this.audio.duration) ? this.audio.duration : 0,
      );
    });

    this.audio.addEventListener("playing", () => {
      this.suppressPauseEvent = false;
      this.callbacks.onPlay?.();
      this.callbacks.onBuffering?.(false);
    });

    this.audio.addEventListener("pause", () => {
      // Bo qua su kien pause do chinh viec thay bai (chi bao khi nguoi dung tam dung)
      if (this.suppressPauseEvent) return;
      this.callbacks.onPause?.();
    });

    this.audio.addEventListener("waiting", () => this.callbacks.onBuffering?.(true));

    this.audio.addEventListener("ended", () => {
      this.suppressPauseEvent = false;
      this.callbacks.onEnded?.();
    });

    this.audio.addEventListener("error", () => {
      this.suppressPauseEvent = false;
      const code = this.audio.error?.code;
      const messages: Record<number, string> = {
        1: "Quá trình phát nhạc bị huỷ.",
        2: "Không đọc được file nhạc nội bộ.",
        3: "File nhạc bị hỏng hoặc không đọc được.",
        4: "Định dạng file nhạc không được trình duyệt hỗ trợ.",
      };
      this.callbacks.onError?.(messages[code ?? 0] ?? "Không phát được file nhạc nội bộ.");
    });
  }

  async load(song: SongDTO, startAt = 0): Promise<void> {
    if (!song.streamUrl) {
      this.callbacks.onError?.("Bài nhạc chưa có đường dẫn file phát.");
      return;
    }

    this.lastReportedSecond = -1;
    this.suppressPauseEvent = true;
    this.callbacks.onBuffering?.(true);
    this.audio.src = song.streamUrl;
    this.audio.currentTime = Math.max(0, startAt);
    this.audio.load();
  }

  /**
   * Ham nong: cho phep trinh duyet tai truoc file cua bai dang phat.
   *
   * The <audio> mac dinh chi tai phan header (`preload="metadata"`) -> luc bam phat moi bat dau
   * tai du lieu, nen bai nhac khoi dong cham va de bi giat khi mang yeu. Bat `auto` de tai truoc
   * theo cach trinh duyet thay phu hop (thuong la tai tiep phan dau bai).
   */
  prewarm(): void {
    this.audio.preload = "auto";
  }

  async play(): Promise<void> {
    /*
     * Khai báo audio "nghe nhạc" TRƯỚC khi phát (iOS): nhờ vậy khi app bị đưa ra nền/khoá màn hình,
     * iOS không treo âm thanh của trang nữa (xem `src/lib/audio-session.ts`).
     *
     * Đặt LẠI mỗi lần phát (không dùng bản "nhớ một lần"): trình duyệt có thể tự đưa phiên về `"auto"`
     * khi trang bị ẩn, nên nếu chỉ đặt một lần ở lúc mở app thì lần phát sau khi quay lại tiền cảnh sẽ
     * bị coi là âm thanh nền - đúng lỗi "chuyển sang ứng dụng khác là hết nhạc".
     */
    reapplyBackgroundAudioSession();

    // Do thi khuech dai (neu can) phai tao trong hanh dong nguoi dung de duoc phep phat
    this.ensureGraph();
    if (this.graph && this.graph.context.state === "suspended") {
      await this.graph.context.resume().catch(() => undefined);
    }

    try {
      await this.audio.play();
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError") {
        this.callbacks.onError?.(
          "Trình duyệt chặn tự động phát. Hãy bấm nút phát để tiếp tục.",
        );
        return;
      }
      this.callbacks.onError?.("Không phát được file nhạc nội bộ.");
    }
  }

  async pause(): Promise<void> {
    // Tam dung theo yeu cau nguoi dung: bao lai su kien pause cho giao dien
    this.suppressPauseEvent = false;
    this.audio.pause();
  }

  seek(seconds: number): void {
    if (!Number.isFinite(seconds)) return;

    // Gioi han trong [0, thoi luong] de khong dat vi tri ngoai bai
    const duration = Number.isFinite(this.audio.duration) && this.audio.duration > 0
      ? this.audio.duration
      : 0;

    this.audio.currentTime = clampSeekTarget(seconds, duration);
  }

  /**
   * Am luong 0..MAX_VOLUME (1 = am luong goc, >1 = khuech dai).
   *
   * Voi <audio>, muc >100% duoc xu ly bang GainNode (Web Audio API) - xem `ensureGraph` de biet vi sao
   * muc <=100% KHONG dung Web Audio nua.
   */
  setVolume(volume: number): void {
    this.volume = Math.min(Math.max(Number.isFinite(volume) ? volume : 1, 0), MAX_VOLUME);
    this.ensureGraph();
    this.applyVolume();
  }

  /** Trinh phat dang THAT SU phat? (dung khi quay lai tien canh - xem `PlayerEngine.reportsPlaying`) */
  reportsPlaying(): boolean {
    return this.audio.paused === false;
  }

  /** Do thi Web Audio dang duoc dung? (chi xay ra khi nguoi dung chon tren 100%) */
  get usesWebAudio(): boolean {
    return Boolean(this.graph);
  }

  /**
   * Am luong duoi 100% tren thiet bi nay do HE THONG quan ly? (trinh duyet bo qua `audio.volume`)
   *
   * Giao dien dung gia tri nay de noi ro cho nguoi dung vi sao keo thanh am luong khong doi duoc gi
   * (thay vi lang le chuyen sang Web Audio nhu truoc).
   */
  get volumeNeedsSystemControl(): boolean {
    return this.elementVolumeIgnored;
  }

  /**
   * Do thi am thanh CHI duoc tao khi nguoi dung muon TO HON ban goc (> 100%) - xem `needsWebAudioGraph`.
   *
   * LICH SU LOI "dang nghe ma chuyen sang ung dung khac la mat nhac": truoc day, khi thay trinh duyet
   * bo qua `audio.volume` (iOS Safari), trinh phat TU DONG tao do thi Web Audio de giam am luong. Do
   * la duong chet: iOS coi Web Audio la am thanh "ambient" nen CHAN ngay khi app khong con o tien canh
   * (WebKit bug 198277), iOS < 17.5 khong danh thuc lai duoc (bug 261554) va `resume()` co the treo vinh
   * vien (bug 281566). The <audio> thuong thi phat nen binh thuong tu iOS 15.4 - nen GIU the, khong Web Audio.
   *
   * Do thi da tao thi KHONG the go ra (mot the <audio> chi tao duoc mot MediaElementSourceNode), vi vay
   * khi the da co do thi tu lan khuech dai truoc thi dung lai do thi do - neu khong am luong se bi dat
   * theo gain cu (nguoi dung nghe to/nho sai).
   */
  private ensureGraph(): void {
    if (this.graph) return;

    const existing = audioGraphs.get(this.audio);
    if (existing) {
      this.graph = existing;
      this.resumeGraphIfSuspended();
      return;
    }

    if (!needsWebAudioGraph(this.volume)) return;

    this.graph = createAudioGraph(this.audio);
    if (!this.graph) {
      // Trinh duyet khong ho tro Web Audio -> chi dung duoc toi da 100%
      this.audio.volume = EMBED_MAX_VOLUME;
      return;
    }

    this.resumeGraphIfSuspended();
  }

  /** Bo xu ly co the bi trinh duyet treo khi trang o nen -> danh thuc lai */
  private resumeGraphIfSuspended(): void {
    const context = this.graph?.context;
    if (!context || context.state !== "suspended") return;

    void context.resume().catch(() => undefined);
  }

  private applyVolume(): void {
    if (this.graph) {
      // Gain > 1 => am thanh lon hon ban goc; limiter phia sau chong vo tieng
      this.graph.gain.gain.value = this.volume;
      this.audio.volume = 1;
      return;
    }

    const target = Math.min(this.volume, EMBED_MAX_VOLUME);
    this.audio.volume = target;

    /*
     * Doc lai de biet trinh duyet co bo qua viec dat am luong khong (iOS Safari giu nguyen 100%).
     * Chi dung de GIAI THICH cho nguoi dung (`volumeNeedsSystemControl`) - KHONG tao Web Audio nua
     * (xem `ensureGraph`): doi am luong trong app khong dang de mat kha nang nghe khi ra nen.
     */
    this.elementVolumeIgnored = this.audio.volume > target + 0.01;
  }

  setMuted(muted: boolean): void {
    this.audio.muted = muted;
  }

  destroy(): void {
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();

    // Tam dung bo xu ly am thanh khi khong dung nua (co the resume khi phat lai)
    void this.graph?.context.suspend().catch(() => undefined);
    this.graph = null;
  }
}
