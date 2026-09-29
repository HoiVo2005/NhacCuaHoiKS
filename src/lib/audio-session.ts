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
 * ĐẶT MỘT LẦN LÀ CHƯA ĐỦ (lỗi "chuyển sang ứng dụng khác là hết nhạc"): loại phiên âm thanh có thể bị
 * trình duyệt tự đưa về `"auto"` khi trang **bị ẩn** (ra nền / đổi tab). Ở trạng thái `"auto"`, iOS lại
 * xếp Web Audio (`AudioContext`) vào nhóm âm thanh nền -> đang nghe mà thoát ra là nhạc dừng. Vì vậy
 * trình phát đặt lại loại phiên ở: lúc mở app, NGAY lúc trang bị ẩn, mỗi lần quay lại tiền cảnh
 * (`pageshow`) và TRƯỚC MỖI lần phát (`reapplyBackgroundAudioSession`).
 *
 * `state` (Safari 17+ / Chromium): `"interrupted"` = hệ thống đang tạm chiếm quyền phát (cuộc gọi đến,
 * ứng dụng khác đang phát). Trình phát dùng giá trị này để biết khi nào nên tự phát tiếp
 * (xem `src/lib/background-playback.ts`).
 *
 * Hàm ở đây là hàm THUẦN với đối tượng kiểu `navigator` nên kiểm chứng được bằng `npm run check:media`
 * và `npm run check:background`.
 * Trình duyệt không hỗ trợ (Safari < 16.4, phần lớn bản Chromium/Firefox hiện nay...) thì bỏ qua,
 * không làm hỏng gì.
 */

export type AudioSessionType =
  | "auto"
  | "playback"
  | "transient"
  | "transient-solo"
  | "ambient"
  | "play-and-record";

/** Trạng thái phiên âm thanh: `"interrupted"` = hệ thống đang tạm chiếm quyền phát */
export type AudioSessionState = "inactive" | "active" | "interrupted";

/** Phần API Audio Session mà trang này dùng */
export interface AudioSessionLike {
  type: AudioSessionType;
  /** Chỉ có ở Safari 17+ / Chromium: trình duyệt cũ không có -> coi như không bị ngắt quãng */
  readonly state?: AudioSessionState;
  /** Sự kiện `statechange` (dùng để biết lúc hệ thống hết ngắt quãng) */
  addEventListener?: (type: "statechange", listener: () => void) => void;
  removeEventListener?: (type: "statechange", listener: () => void) => void;
}

/** Đối tượng tối thiểu cần có (thay cho `Navigator` để kiểm chứng bằng đối tượng giả) */
export interface AudioSessionHost {
  audioSession?: AudioSessionLike;
}

/** `navigator` hiện tại dưới dạng đối tượng tối thiểu (không có `navigator` -> `null`) */
export function currentAudioSessionHost(): AudioSessionHost | null {
  return typeof navigator === "undefined" ? null : (navigator as unknown as AudioSessionHost);
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
 * Đặt loại phiên âm thanh thành `"playback"`. Tự bỏ qua ở trình duyệt không hỗ trợ.
 *
 * `force = false` (mặc định): bỏ qua khi phiên đã được đặt thành công - dùng lúc mở app.
 * `force = true`: đặt LẠI mỗi lần, vì trình duyệt có quyền tự đưa `type` về `"auto"` khi trang bị ẩn
 * (xem đầu tệp) - lúc đó Web Audio lại bị coi là âm thanh nền và iOS chặn ngay khi app ra ngoài.
 *
 * Gọi sớm còn có tác dụng phụ tốt: đặt TRƯỚC khi `AudioContext` được tạo (đồ thị âm lượng) thì iOS
 * xếp luôn đồ thị đó vào nhóm "nghe nhạc" chứ không phải "ambient".
 */
export function applyBackgroundAudioSession(force = false): boolean {
  if (applied && !force) return true;

  const ok = enableBackgroundAudioSession(currentAudioSessionHost());
  if (ok) applied = true;
  return ok;
}

/**
 * Đặt LẠI loại phiên âm thanh (không nhớ trạng thái đã đặt).
 *
 * Dùng trước mỗi lần phát, ngay lúc trang bị ẩn và mỗi lần quay lại tiền cảnh - vì trình duyệt có thể
 * đã tự xoá thiết lập này (xem giải thích ở đầu tệp). Rẻ (chỉ là một phép gán) nên gọi bao nhiêu lần
 * cũng được; trình duyệt không hỗ trợ thì trả về `false` và không làm hỏng gì.
 */
export function reapplyBackgroundAudioSession(): boolean {
  return applyBackgroundAudioSession(true);
}

/** Phiên âm thanh đang bị hệ thống ngắt quãng (cuộc gọi đến / ứng dụng khác chiếm quyền phát)? */
export function isAudioSessionInterrupted(host: AudioSessionHost | null | undefined): boolean {
  try {
    return host?.audioSession?.state === "interrupted";
  } catch {
    /* Trình duyệt không cho đọc -> coi như không bị ngắt quãng */
    return false;
  }
}

/**
 * Theo dõi thay đổi trạng thái phiên âm thanh (bị ngắt quãng -> hết ngắt quãng) để biết lúc nên tự
 * phát tiếp. Trả về hàm huỷ đăng ký; trình duyệt không hỗ trợ -> `null` (không làm hỏng gì).
 */
export function watchAudioSessionState(
  host: AudioSessionHost | null | undefined,
  listener: () => void,
): (() => void) | null {
  try {
    const session = host?.audioSession;
    if (!session?.addEventListener || !session.removeEventListener) return null;

    session.addEventListener("statechange", listener);

    return () => session.removeEventListener?.("statechange", listener);
  } catch {
    return null;
  }
}
