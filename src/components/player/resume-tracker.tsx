"use client";

import { useEffect } from "react";

import { usePlayerStore } from "@/store/player-store";

/**
 * Ghi nhớ vị trí đang nghe của từng bài để lần sau nghe tiếp đúng chỗ.
 *
 * Chỉ ghi khi có LÝ DO THẬT:
 *  - Đang phát: theo dõi thay đổi `progress` (mỗi lần 1 giây). `rememberPosition` tự bỏ qua khi
 *    vẫn trong cùng bước 5 giây nên localStorage không bị ghi liên tục (xem `src/lib/resume.ts`).
 *  - Vừa tạm dừng: ghi ngay vị trí đang dừng (người dùng tắt tab ngay sau đó vẫn không mất chỗ).
 *  - Đổi bài: ghi vị trí của bài CŨ trước khi state trỏ sang bài mới.
 *  - Đóng tab / chuyển sang tab khác: ghi nốt (`pagehide`) để không mất vị trí cuối.
 *
 * Không ghi khi chưa nghe đủ `RESUME_MIN_SECONDS` (bấm nhầm, nghe lướt) - xem `src/lib/resume.ts`.
 */
export function ResumeTracker() {
  useEffect(() => {
    const save = (songId: string | null | undefined, seconds: number): void => {
      if (!songId) return;
      usePlayerStore.getState().rememberPosition(songId, seconds);
    };

    const unsubscribe = usePlayerStore.subscribe((state, previous) => {
      const current = state.current;

      // Đổi bài: chốt vị trí bài cũ (bài mới bắt đầu từ 0 hoặc từ vị trí đã nhớ của chính nó)
      if (previous.current && previous.current.id !== current?.id) {
        save(previous.current.id, previous.progress);
        return;
      }

      if (!current) return;
      if (state.progress === previous.progress && state.isPlaying === previous.isPlaying) return;

      save(current.id, state.progress);
    });

    /** Đóng tab, chuyển tab, hoặc điều hướng sang trang khác */
    const flush = (): void => {
      const state = usePlayerStore.getState();
      save(state.current?.id, state.progress);
    };

    window.addEventListener("pagehide", flush);

    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      // Rời trang (điều hướng nội bộ cũng remount layout gốc) -> chốt vị trí cuối trước khi bỏ
      flush();
    };
  }, []);

  return null;
}
