/**
 * Phiên âm thanh cho iOS/Safari (Audio Session API, Safari 16.4+).
 *
 * Vì sao cần: iOS coi Web Audio (`AudioContext`) là âm thanh **"ambient"** - loại âm thanh bị hệ thống
 * CHẶN ngay khi trang không còn ở tiền cảnh (WebKit: "On iOS, WebAudio is considered Ambient audio from
 * the system's perspective, and ambient audio is blocked by the system once the app producing it is no
 * longer foreground"). Với web app đã "Thêm vào màn hình chính", điều đó nghĩa là: đang nghe nhạc mà
 * thoát ra ngoài (hoặc khoá màn hình) là **nhạc dừng**.
 *
 * Cách chữa: đặt `navigator.audioSession.type = "playback"` để iOS biết đây là audio NGHE NHẠC:
 *  - được phát tiếp khi app ra nền / khoá màn hình (thẻ `<audio>`: iOS 15.4+; Web Audio: iOS 17.5+);
 *  - phát được cả khi công tắc chuông đang ở chế độ im lặng (không còn bị coi là âm thanh nền);
 *  - màn hình khoá hiện đúng bài/nghệ sĩ và nút điều khiển (kèm `MediaSessionBridge`).
 *
 * Hàm ở đây là hàm THUẦN với đối tượng kiểu `navigator` nên kiểm chứng được bằng `npm run check:media`.
 * Trình duyệt không hỗ trợ (Safari < 16.4, Chrome/Firefox hiện tại...) thì bỏ qua, không làm hỏng gì.
 */

export type AudioSessionType =
  | "auto"
  | "playback"
  | "transient"
  | "transient-solo"
  | "ambient"
  | "play-and-record";

/** Phần API Audio Session mà trang này dùng */
export interface AudioSessionLike {
  type: AudioSessionType;
}

/** Đối tượng tối thiểu cần có (thay cho `Navigator` để kiểm chứng bằng đối tượng giả) */
export interface AudioSessionHost {
  audioSession?: AudioSessionLike;
}

/** Trình duyệt hiện tại có Audio Session API không? (Safari 16.4+) */
export function supportsBackgroundAudioSession(host: AudioSessionHost | null | undefined): boolean {
  return Boolean(host?.audioSession);
}

/**
 * Đặt loại phiên âm thanh thành `"playback"`.
 * Trả về `true` khi đã đặt được; `false` khi trình duyệt không hỗ trợ hoặc từ chối (không bao giờ ném lỗi).
 */
export function enableBackgroundAudioSession(host: AudioSessionHost | null | undefined): boolean {
  try {
    const session = host?.audioSession;
    if (!session) return false;

    session.type = "playback";
    return session.type === "playback";
  } catch {
    /* Trình duyệt không cho truy cập/đổi -> coi như không hỗ trợ */
    return false;
  }
}

/** Đã thiết lập thành công chưa (chỉ cần làm một lần cho cả phiên) */
let applied = false;

/**
 * Gọi từ trình phát (lúc mount và trước mỗi lần phát). Tự bỏ qua ở trình duyệt không hỗ trợ.
 *
 * Gọi sớm còn có tác dụng phụ tốt: đặt TRƯỚC khi `AudioContext` được tạo (đồ thị âm lượng) thì iOS
 * xếp luôn đồ thị đó vào nhóm "nghe nhạc" chứ không phải "ambient".
 */
export function applyBackgroundAudioSession(): boolean {
  if (applied) return true;
  if (typeof navigator === "undefined") return false;

  applied = enableBackgroundAudioSession(navigator as unknown as AudioSessionHost);
  return applied;
}
