import type { SongDTO } from "@/types";
import { applyBackgroundAudioSession } from "@/lib/audio-session";
import { clampSeekTarget } from "@/lib/seek";
import { EMBED_MAX_VOLUME, MAX_VOLUME } from "@/lib/volume";

import type { PlayerAdapterCallbacks, PlayerEngine } from "./types";

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
     */
    applyBackgroundAudioSession();

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
   * Voi <audio>, muc >100% duoc xu ly bang GainNode (Web Audio API).
   * Neu trinh duyet bo qua viec dat `audio.volume` (vi du iOS Safari), he thong tu
   * dong chuyen sang GainNode cho ca muc duoi 100% - nho do van chinh duoc am luong.
   */
  setVolume(volume: number): void {
    this.volume = Math.min(Math.max(Number.isFinite(volume) ? volume : 1, 0), MAX_VOLUME);
    this.ensureGraph();
    this.applyVolume();
  }

  private ensureGraph(force = false): void {
    if (this.graph) return;
    // Trong pham vi 100% thi khong can Web Audio (tru khi trinh duyet bo qua am luong)
    if (!force && this.volume <= EMBED_MAX_VOLUME) return;

    this.graph = createAudioGraph(this.audio);
    if (!this.graph) {
      this.audio.volume = EMBED_MAX_VOLUME;
      return;
    }

    // Do thi co the duoc tao ngoai hanh dong nguoi dung -> bao dam bo xu ly dang chay
    if (this.graph.context.state === "suspended") {
      void this.graph.context.resume().catch(() => undefined);
    }
  }

  private applyVolume(): void {
    if (!this.graph) {
      const target = Math.min(this.volume, EMBED_MAX_VOLUME);
      this.audio.volume = target;

      // iOS Safari bo qua viec dat am luong cua the <audio> (giu nguyen 100%)
      // -> phai dung GainNode de thuc su giam am luong.
      if (this.volume <= EMBED_MAX_VOLUME && this.audio.volume > target + 0.01) {
        this.ensureGraph(true);
      }
    }

    if (this.graph) {
      // Gain > 1 => am thanh lon hon ban goc; limiter phia sau chong vo tieng
      this.graph.gain.gain.value = this.volume;
      this.audio.volume = 1;
      return;
    }

    this.audio.volume = Math.min(this.volume, EMBED_MAX_VOLUME);
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
