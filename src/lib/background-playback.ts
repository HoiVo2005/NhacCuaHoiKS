/**
 * "Nghe nhạc khi chuyển sang tab / ứng dụng khác" (logic thuần - kiểm chứng bằng `npm run check:background`).
 *
 * Vì sao tách riêng: đây là phần dễ làm người dùng MẤT NHẠC nhất mà lại không nhìn thấy được khi thử
 * trên máy tính. Hai lỗi đã gặp trên điện thoại:
 *
 *  1. Đang nghe nhạc rồi chuyển sang ứng dụng khác (bấm Home / vuốt sang app khác). Trình duyệt tạm
 *     dừng phiên phát và bắn sự kiện `pause`. Nếu coi đó là "người dùng bấm tạm dừng" thì trạng thái
 *     phát bị lật thành tạm dừng, và quay lại app là nhạc nằm im (phải bấm Phát bằng tay).
 *  2. Quay lại app sau khi bị ngắt quãng (cuộc gọi đến, ứng dụng khác chiếm quyền phát): trình duyệt
 *     tự tạm dừng nhưng KHÔNG tự phát lại, nên phải tự phát tiếp - chỉ khi người dùng vẫn đang muốn
 *     nghe, trang đã ở tiền cảnh và hệ thống không còn ngắt quãng nữa.
 *
 * Luật ở đây thuần dữ liệu (không đụng DOM) nên chạy được cả trong Node để kiểm chứng.
 */

/**
 * Trong bấy nhiêu ms kể từ lúc trang quay lại tiền cảnh thì sự kiện `pause` tới muộn vẫn được coi là
 * của HỆ THỐNG: trình duyệt bắn sự kiện này không đồng bộ với lúc đổi trạng thái hiển thị, nên sự kiện
 * của lúc ở nền có thể tới sau khi người dùng đã quay lại.
 */
export const INTERRUPTION_PAUSE_GRACE_MS = 1_000;

/**
 * Sự kiện `pause` này do HỆ THỐNG gây ra (không phải người dùng bấm tạm dừng)?
 *
 * - `switching`: đang trong lúc chuyển bài (`armSwitchGuard`) - thay `src` của thẻ `<audio>` hay tạm
 *   dừng động cơ khác cũng bắn `pause`.
 * - `documentHidden`: trang đang ở nền - người dùng không thể bấm gì trên trang, nên đây là do trình
 *   duyệt tự tạm dừng khi ra nền, do cuộc gọi đến, hoặc do ứng dụng khác chiếm quyền phát.
 * - `msSinceVisible`: vừa quay lại tiền cảnh nhưng sự kiện `pause` của lúc ở nền mới tới (xem
 *   `INTERRUPTION_PAUSE_GRACE_MS`).
 */
export function isSystemPause(input: {
  switching: boolean;
  documentHidden: boolean;
  msSinceVisible: number;
}): boolean {
  if (input.switching || input.documentHidden) return true;

  // Không tính được khoảng thời gian (NaN) -> coi như đã lâu, tức là pause của người dùng
  const msSinceVisible = Number.isFinite(input.msSinceVisible)
    ? input.msSinceVisible
    : Number.POSITIVE_INFINITY;

  return msSinceVisible < INTERRUPTION_PAUSE_GRACE_MS;
}

/**
 * Có nên tự phát tiếp không? (gọi khi quay lại tiền cảnh hoặc khi hệ thống hết ngắt quãng)
 *
 * Phải đúng CẢ BA:
 *  - `wantsPlaying`: store vẫn đang ở trạng thái phát (người dùng chưa bấm tạm dừng) - nhờ luật
 *    `isSystemPause` ở trên, sự kiện pause do ra nền không làm mất ý định này;
 *  - trang đã ở tiền cảnh: phát trong lúc trang bị ẩn là điều trình duyệt chặn;
 *  - phiên âm thanh không còn bị ngắt quãng (cuộc gọi / ứng dụng khác đang chiếm quyền phát).
 */
export function shouldResumePlayback(input: {
  wantsPlaying: boolean;
  documentHidden: boolean;
  audioSessionInterrupted: boolean;
}): boolean {
  return input.wantsPlaying && !input.documentHidden && !input.audioSessionInterrupted;
}

/**
 * Sau khi quay lai tien canh, cho bao nhieu ms roi kiem tra lai xem nhac da chay chua.
 *
 * Ly do: ngay sau khi app duoc danh thuc, lan `play()` dau tien rat de bi bo qua - iOS co the van giu
 * nguyen trang thai tam dung, con `iframe` cua YouTube/`widget` SoundCloud thi chua kip thuc day. Truoc
 * day nguoi dung phai tu bam nut Phat; nay trinh phat tu thu lai MOT lan.
 */
export const RESUME_RETRY_DELAY_MS = 1_200;

/**
 * Co nen goi `play()` LAN NUA khong? (goi sau `RESUME_RETRY_DELAY_MS`)
 *
 * Phai dung CA BON:
 *  - `wantsPlaying`: nguoi dung van dang muon nghe (xem `isSystemPause`);
 *  - trang da o tien canh;
 *  - he thong khong con ngat quang;
 *  - `actuallyPlaying = false`: dong co xac nhan no VAN CHUA phat
 *    (`PlayerEngine.reportsPlaying`; dong co khong ho tro thi bo qua, khong thu lai).
 */
export function shouldRetryResumePlayback(input: {
  wantsPlaying: boolean;
  documentHidden: boolean;
  audioSessionInterrupted: boolean;
  actuallyPlaying: boolean;
}): boolean {
  return (
    input.wantsPlaying &&
    !input.documentHidden &&
    !input.audioSessionInterrupted &&
    !input.actuallyPlaying
  );
}

/**
 * Chu kỳ "đạp lệnh phát lại" trong lúc trang đang Ở NỀN (ms).
 *
 * Nguồn nhúng YouTube/SoundCloud tự chạy tiếp khi trang bị ẩn, nhưng player TikTok thì
 * **tự tạm dừng ngay khi trang bị ẩn** (code bên trong `iframe` của TikTok phản ứng riêng với
 * `visibilitychange` - hành vi cố ý chống nghe nền của họ). Vì vậy khi đang ở nền phải gửi lại
 * lệnh `play` sau mỗi nhịp này, lặp lại vì lệnh đầu tiên có thể đến trước lúc TikTok kịp tự dừng
 * (hoặc bị trình duyệt gộp/throttle lúc tab nền).
 */
export const KEEP_ALIVE_KICK_MS = 3_000;

/**
 * Có nên gửi lệnh "phát lại" cho động cơ khi trang đang Ở NỀN không?
 *
 * Phải đúng CẢ BỐN:
 *  - `wantsPlaying`: store vẫn ở trạng thái phát (người dùng chưa bấm tạm dừng cả từ giao diện
 *    lẫn màn hình khoá / nút tai nghe);
 *  - `documentHidden`: chỉ làm khi trang thật sự bị ẩn - ở tiền cảnh để từng động cơ tự quản lý
 *    (gõ `play` trong lúc foreground chỉ là lệnh thừa);
 *  - không đang bị hệ thống ngắt quãng (cuộc gọi tới / app khác chiếm quyền phát): trong lúc này
 *    lệnh phát sẽ bị từ chối hoặc tệ hơn là giành lại quyền phát giữa chừng;
 *  - `embedSource`: chỉ "đạp" cho nguồn nhúng (YouTube/SoundCloud/TikTok). Nguồn `<audio>`
 *    (`UPLOADED`) KHÔNG đạp: nếu trình duyệt chặn autoplay khi đang ở nền thì `AudioEngine.play()`
 *    báo `onError` -> hiện thông báo lỗi và TẮT luôn ý định nghe - đúng cái mình muốn tránh.
 */
export function shouldKeepAlivePlayback(input: {
  wantsPlaying: boolean;
  documentHidden: boolean;
  audioSessionInterrupted: boolean;
  embedSource: boolean;
}): boolean {
  return (
    input.embedSource &&
    input.wantsPlaying &&
    input.documentHidden &&
    !input.audioSessionInterrupted
  );
}
