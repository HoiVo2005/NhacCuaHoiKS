"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Keyboard } from "lucide-react";
import { toast } from "sonner";

import { useSessionUser } from "@/components/auth/session-context";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { keysLabel, resolveShortcut, SEEK_STEP_SECONDS, shortcutGroups, VOLUME_STEP_RATIO } from "@/lib/player-shortcuts";
import { openQuickSearch } from "@/lib/quick-search";
import { clampSeekTarget } from "@/lib/seek";
import { clampVolumeFor } from "@/lib/volume";
import { usePlayerStore } from "@/store/player-store";

/**
 * Phim tat toan cuc cho trinh phat + bang tro giup (mo bang phim `?`).
 *
 * Mount MOT lan o layout goc (canh `PlayerBar`) nen phim tat dung duoc o moi trang, ke ca
 * khi khong co thanh phat nao duoc hien (chua co bai nao dang phat).
 *
 * Vi sao gan vao `window` bang effect: trinh phat la "singleton" o layout goc, khong co
 * phan tu nao de focus; nguoi dung co the dang bam nut bat ky tren trang.
 */
export function PlayerShortcuts() {
  const open = usePlayerStore((state) => state.shortcutsOpen);
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useSessionUser();

  useEffect(() => {
    /** Tua theo buoc co dinh, gioi han trong [0, thoi luong] giong nhu keo thanh thoi gian */
    function seekBy(delta: number): void {
      const store = usePlayerStore.getState();
      const total = store.duration > 0 ? store.duration : store.current?.durationSeconds ?? 0;
      if (total <= 0) return;
      store.requestSeekPosition(clampSeekTarget(store.progress + delta, total));
    }

    /** Doi am luong theo buoc 5%, luon gioi han theo muc toi da thuc te cua nguon dang phat */
    function changeVolume(delta: number): void {
      const store = usePlayerStore.getState();
      const sourceType = store.current?.sourceType;
      if (!sourceType) return;
      store.setVolume(clampVolumeFor(sourceType, store.volume + delta));
    }

    async function toggleFavorite(): Promise<void> {
      const song = usePlayerStore.getState().current;
      if (!song) return;

      if (!isAuthenticated) {
        toast.info("Đăng nhập để lưu bài nhạc yêu thích nhé!");
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }

      try {
        const response = await fetch(`/api/songs/${song.id}/favorite`, { method: "POST" });
        if (!response.ok) throw new Error("request failed");

        const data = (await response.json()) as { isFavorite: boolean };
        // Cap nhat bai dang phat de nut trai tim tren thanh phat doi mau ngay
        usePlayerStore.setState({ current: { ...song, isFavorite: data.isFavorite } });
        toast.success(data.isFavorite ? "Đã thêm vào yêu thích" : "Đã bỏ khỏi yêu thích");
      } catch {
        toast.error("Không cập nhật được yêu thích. Vui lòng thử lại.");
      }
    }

    function handleKeydown(event: KeyboardEvent): void {
      const action = resolveShortcut(event, event.target);
      if (!action) return;

      const store = usePlayerStore.getState();

      /*
       * Khong co bai nao dang phat thi chi con bang tro giup va o tim kiem nhanh la co y nghia
       * (tim kiem khong phu thuoc viec dang phat bai nao).
       */
      if (!store.current && action !== "help" && action !== "quickSearch") return;

      // Chan hanh vi mac dinh (Space cuon trang, mui ten cuon trang...)
      event.preventDefault();

      switch (action) {
        case "playPause":
          store.togglePlay();
          break;
        case "quickSearch":
          /* O tim kiem nam trong Topbar - xem `src/lib/quick-search.ts` */
          openQuickSearch();
          break;
        case "seekBack":
          seekBy(-SEEK_STEP_SECONDS);
          break;
        case "seekForward":
          seekBy(SEEK_STEP_SECONDS);
          break;
        case "previous":
          store.previous();
          break;
        case "next":
          store.next();
          break;
        case "volumeUp":
          changeVolume(VOLUME_STEP_RATIO);
          break;
        case "volumeDown":
          changeVolume(-VOLUME_STEP_RATIO);
          break;
        case "mute":
          store.toggleMute();
          break;
        case "shuffle":
          store.toggleShuffle();
          break;
        case "repeat":
          store.cycleRepeat();
          break;
        case "queue":
          store.toggleQueue();
          break;
        case "fullPlayer":
          store.toggleFullPlayer();
          break;
        case "favorite":
          void toggleFavorite();
          break;
        case "lyrics":
          /* Bảng lời chỉ hiện trong trình phát đầy đủ: chưa mở thì mở luôn cho người dùng thấy */
          if (store.lyricsOpen) store.setLyricsOpen(false);
          else store.showLyrics();
          break;
        case "help":
          store.toggleShortcuts();
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [isAuthenticated, pathname, router]);

  return (
    <Dialog open={open} onOpenChange={(next) => usePlayerStore.getState().setShortcutsOpen(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-4 text-primary" /> Phím tắt trình phát
          </DialogTitle>
          <DialogDescription>
            Bấm <ShortcutKeys keys={["?"]} /> ở bất kỳ trang nào để mở bảng này. Phím tắt tự tắt khi bạn
            đang gõ vào ô nhập liệu hoặc đang mở một hộp thoại khác.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {shortcutGroups().map((group) => (
            <section key={group.label} className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {group.label}
              </p>

              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li
                    key={item.action}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface/60 px-2.5 py-1.5"
                  >
                    <span className="min-w-0 truncate text-xs">{item.label}</span>
                    <ShortcutKeys keys={item.keys} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Mot to hop phim hien thi dang "phim" nhu tren ban phim */
function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1" aria-label={keysLabel(keys)}>
      {keys.map((key) => (
        <kbd
          key={key}
          className="rounded-md border border-border/70 bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-foreground shadow-soft"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
