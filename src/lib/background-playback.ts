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
 * Chu kỳ "đạp lệnh phát lại" LIÊN TỤC khi vừa quay lại tiền cảnh (ms).
 *
 * Trước đây khi quay lại app chỉ có MỘT lệnh `play` ngay lúc đánh thức và một lần thử lại sau 1,2
 * giây. Nếu cả hai đều bị `iframe` TikTok bỏ qua (nó đang tự thức dậy sau khi trang sáng lại, hoặc
 * tự tạm dừng một lần nữa trong lúc sang trang) thì nhạc im ~2 giây mới chạy - đúng lỗi người dùng
 * báo "vào lại ứng dụng bị dừng 2s rồi phát lại". Đạp mỗi 300ms thì lần đầu tiên mà TikTok chấp
 * nhận là nhạc chạy ngay (thường ở nhịp đầu tiên).
 */
export const FOREGROUND_RESUME_KICK_MS = 300;

/**
 * Tối đa bao lâu tiếp tục đạp lệnh phát lại sau khi quay lại tiền cảnh (ms) - quá cửa sổ này mà động
 * cơ vẫn báo chưa phát thì dừng (để không spam lệnh khi thật sự có sự cố), trả lại cho
 * `shouldRetryResumePlayback` (một lần sau 1,2 giây) lo phần còn lại.
 */
export const FOREGROUND_RESUME_KICK_WINDOW_MS = 4_000;

/**
 * Có nên gửi lệnh "phát" lại NGAY lúc này khi vừa quay lại tiền cảnh không?
 * Phải đúng CẢ BỐN:
 *  - `embedSource`: chỉ nguồn nhúng (YouTube/SoundCloud/TikTok) - giống luật keep-alive ở trên;
 *  - `wantsPlaying` + trang ở tiền cảnh + không bị hệ thống ngắt quãng: như `shouldResumePlayback`;
 *  - `actuallyPlaying = false`: động cơ XÁC NHẬN nó chưa phát (chưa báo state 1). Động cơ không
 *    báo thì coi như đang phát (`?? true`) - không biết thì không "đạp" thừa (giống
 *    `shouldRetryResumePlayback`);
 *  - `elapsedMs < FOREGROUND_RESUME_KICK_WINDOW_MS`: chỉ trong cửa sổ ngắn sau khi quay lại.
 */
export function shouldKickForegroundResume(input: {
  wantsPlaying: boolean;
  documentHidden: boolean;
  audioSessionInterrupted: boolean;
  embedSource: boolean;
  actuallyPlaying: boolean;
  elapsedMs: number;
}): boolean {
  if (!input.embedSource || !input.wantsPlaying) return false;
  if (input.documentHidden || input.audioSessionInterrupted) return false;
  if (input.actuallyPlaying) return false;

  const elapsed = Number.isFinite(input.elapsedMs)
    ? input.elapsedMs
    : Number.POSITIVE_INFINITY;

  return elapsed < FOREGROUND_RESUME_KICK_WINDOW_MS;
}

/**
 * Chu kỳ "đạp lệnh phát lại" trong lúc trang đang Ở NỀN (ms).
 *
 * Nguồn nhúng YouTube/SoundCloud tự chạy tiếp khi trang bị ẩn, nhưng player TikTok thì
 * **tự tạm dừng ngay khi trang bị ẩn** (code bên trong `iframe` của TikTok phản ứng riêng với
 * `visibilitychange` - hành vi cố ý chống nghe nền của họ). Vì vậy khi đang ở nền phải gửi lại
 * lệnh `play` sau mỗi nhịp này, lặp lại vì lệnh đầu tiên có thể đến trước lúc TikTok kịp tự dừng
 * (hoặc bị trình duyệt gộp/throttle lúc tab nền).
 *
 * Trước đây nhịp là 3 giây nên người dùng thoát app thấy nhạc "chết" ~3 giây mới chạy lại. Trình
 * duyệt đã gộp timer lúc trang bị ẩn về tối thiểu ~1 giây (Chrome/Safari đều vậy) nên 1 giây là
 * nhịp nhanh nhất có ý nghĩa - thêm `shouldReplayAfterSystemPause` (đáp ngay khi TikTok báo tự tạm
 * dừng) thì khoảng dừng hầu như không còn thấy.
 */
export const KEEP_ALIVE_KICK_MS = 1_000;

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

/**
 * Khoảng cách tối thiểu giữa hai lần "đạp lại lệnh phát" khi hệ thống tự tạm dừng (ms).
 *
 * Sự kiện `pause` do hệ thống gây ra (TikTok tự dừng lúc trang bị ẩn, `pause` của lúc ở nền đến
 * muộn khi vừa quay lại...) đi qua `postMessage`/lắng nghe sự kiện nên ĐẾN ĐƯỢC ngay cả khi trang
 * đang bị ẩn - khác `setTimeout` bị trình duyệt gộp về ~1s lúc nền. Nhờ đó đáp lại NGAY được thay
 * vì chờ nhịp keep-alive. Tốc độ bị chặn lại ở mức này để nếu TikTok vẫn tiếp tục tự tạm dừng
 * (chính sách chống nghe nền của họ) thì không vòng lặp message ăn CPU.
 */
export const SYSTEM_PAUSE_REPLAY_MIN_INTERVAL_MS = 400;

/**
 * Có nên gửi lệnh "phát" lại NGAY khi vừa nhận được sự kiện `pause` do HỆ THỐNG gây ra không?
 * Phải đúng HẾT:
 *  - KHÔNG phải lúc đang chuyển bài: `pause` ở đây do thay `src`/nạp bài mới gây ra, hiệu ứng nạp
 *    bài tự lo phần phát tiếp, đạp lệnh lúc này có thể tới trước khi bài mới kịp nạp;
 *  - `isSystemPause` đúng: trang đang ở nền, hoặc vừa quay lại tiền cảnh (pause của lúc ở nền đến
 *    muộn) - pause của người dùng (bấm tạm dừng) thì KHÔNG được đạp lại;
 *  - `wantsPlaying`: store vẫn ở trạng thái phát;
 *  - `embedSource`: chỉ nguồn nhúng - nguồn `<audio>` không đạp (xem `shouldKeepAlivePlayback`);
 *  - không đang bị hệ thống ngắt quãng (cuộc gọi tới / app khác chiếm quyền phát);
 *  - đã đủ `SYSTEM_PAUSE_REPLAY_MIN_INTERVAL_MS` kể từ lần đạp trước.
 */
export function shouldReplayAfterSystemPause(input: {
  switching: boolean;
  documentHidden: boolean;
  msSinceVisible: number;
  wantsPlaying: boolean;
  embedSource: boolean;
  audioSessionInterrupted: boolean;
  msSinceLastReplay: number;
}): boolean {
  if (input.switching) return false;

  const systemPause = isSystemPause({
    switching: input.switching,
    documentHidden: input.documentHidden,
    msSinceVisible: input.msSinceVisible,
  });
  if (!systemPause) return false;

  if (!input.wantsPlaying || !input.embedSource || input.audioSessionInterrupted) {
    return false;
  }

  const sinceLast = Number.isFinite(input.msSinceLastReplay)
    ? input.msSinceLastReplay
    : Number.POSITIVE_INFINITY;

  return sinceLast >= SYSTEM_PAUSE_REPLAY_MIN_INTERVAL_MS;
}
