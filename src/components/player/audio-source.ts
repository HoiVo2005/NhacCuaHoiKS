/**
 * Cầu nối tới thẻ `<audio>` của trình phát (giống `video-stage.ts` cho khung video).
 *
 * Vì sao cần: hiệu ứng sóng nhạc muốn **phân tích âm thanh thật** thì phải có chính thẻ `<audio>` đang
 * phát, nhưng thẻ đó nằm trong `PlayerEngine` còn hiệu ứng nằm trong trình phát đầy đủ. Thay vì luồn
 * ref qua nhiều tầng component, `PlayerEngine` đăng ký thẻ ở đây và hiệu ứng đọc ra.
 *
 * Thẻ `<audio>` chỉ được tạo MỘT lần cho cả phiên (không bị thay khi đổi bài), nên chỗ dùng có thể
 * đăng ký theo dõi (`watchAudioElement`) để chắc chắn lấy được thẻ dù thứ tự mount thế nào.
 */

let element: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();

/** Thẻ `<audio>` đang dùng (null khi trình phát chưa mount / đã unmount) */
export function audioElement(): HTMLAudioElement | null {
  return element && element.isConnected ? element : null;
}

/** `PlayerEngine` gọi khi mount (và gọi `null` khi unmount) */
export function registerAudioElement(next: HTMLAudioElement | null): void {
  if (element === next) return;

  element = next;

  for (const listener of listeners) listener();
}

/** Theo dõi thẻ `<audio>` được đăng ký / gỡ (trả về hàm huỷ đăng ký) */
export function watchAudioElement(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
