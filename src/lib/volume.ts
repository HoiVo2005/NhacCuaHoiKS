/**
 * Quy tac am luong dung chung cho trinh phat.
 *
 * - 0%  .. 100%: giam am luong (moi nguon deu lam duoc)
 * - 100% .. 200%: KHUECH DAI am thanh lon hon ban goc.
 *   Chi thuc hien duoc voi file nhac tai len (the <audio> + Web Audio API).
 *   Cac nguon nhung (YouTube/SoundCloud/TikTok) bi nen tang gioi han o 100%
 *   vi am thanh nam trong iframe khac mien, khong the xu ly them.
 */

/** Am luong toi da (200%) */
export const MAX_VOLUME = 2;
/** Am luong ban dau (80%) */
export const DEFAULT_VOLUME = 0.8;
/** Gioi han cua nguon nhung (100%) */
export const EMBED_MAX_VOLUME = 1;
/** Buoc truot am luong */
export const VOLUME_STEP = 0.01;

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(Math.max(value, 0), MAX_VOLUME);
}

export function formatVolumePercent(value: number): string {
  return `${Math.round(clampVolume(value) * 100)}%`;
}

/** Am luong dang vuot muc goc (> 100%) */
export function isBoosted(value: number): boolean {
  return clampVolume(value) > EMBED_MAX_VOLUME + 0.001;
}

/** Nguon phat nay co the khuech dai qua 100% khong? */
export function canBoostVolume(sourceType: string | null | undefined): boolean {
  return sourceType === "UPLOADED";
}

/**
 * Muc am luong toi da THUC TE cua tung nguon:
 * - File tai len: 200% (khuech dai that bang GainNode).
 * - Nguon nhung (YouTube/SoundCloud/TikTok): 100% - nen tang chan.
 *
 * Truoc day thanh truot luon dai 0..200% cho moi nguon, nen voi nguon nhung doan
 * 100%..200% la "vung chet": keo ma am thanh khong to hon -> nguoi dung tuong loi.
 */
export function maxVolumeFor(sourceType: string | null | undefined): number {
  return canBoostVolume(sourceType) ? MAX_VOLUME : EMBED_MAX_VOLUME;
}

/** Gioi han muc am luong hien thi/truyen xuong dong co theo nguon dang phat */
export function clampVolumeFor(sourceType: string | null | undefined, volume: number): number {
  return Math.min(clampVolume(volume), maxVolumeFor(sourceType));
}

/** Vi tri (%) cua vach moc "100% am luong goc" tren thanh truot 0..MAX */
export const VOLUME_MARKER_PERCENT = (EMBED_MAX_VOLUME / MAX_VOLUME) * 100;

/**
 * Co phai dung do thi Web Audio (GainNode) cho muc am luong nay khong?
 *
 * CHI khi nguoi dung muon TO HON ban goc (> 100%) - vi the `<audio>` khong lam duoc.
 *
 * Vi sao khong dung Web Audio cho muc <= 100% (dù trinh duyet bo qua `audio.volume`):
 * iOS coi Web Audio (`AudioContext`) la am thanh **"ambient"** va CHAN ngay khi app khong con o tien
 * canh (WebKit bug 198277). iOS < 17.5 khong "danh thuc" lai duoc (bug 261554), va `resume()` co the
 * treo vinh vien (bug 281566). Do la nguyen nhan loi "dang nghe ma chuyen sang ung dung khac la mat
 * nhac" - trong khi the `<audio>` thuong thi phat nen binh thuong tu iOS 15.4.
 *
 * LUU Y: khi do thi da duoc tao (do nguoi dung tung khuech dai > 100%) thi khong the go ra nua -
 * xem `AudioEngine.ensureGraph()` (do thi duoc dung lai theo tung the `<audio>`).
 */
export function needsWebAudioGraph(volume: number): boolean {
  return clampVolume(volume) > EMBED_MAX_VOLUME + 0.001;
}
