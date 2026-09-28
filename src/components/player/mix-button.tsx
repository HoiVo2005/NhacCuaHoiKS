"use client";

import { useState } from "react";
import { Loader2, Radio } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { mixQueueLabel } from "@/lib/music/mix";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/player-store";
import type { SongDTO } from "@/types";

interface MixButtonProps {
  /** `icon`: chỉ biểu tượng (thanh phát) · `labeled`: kèm nhãn (trình phát đầy đủ) */
  variant?: "icon" | "labeled";
  className?: string;
}

/**
 * "Mix quanh bài này": tạo hàng chờ mới gồm các bài tương đồng với bài đang phát
 * (cùng thể loại / nghệ sĩ / nguồn phát) rồi phát luôn bài đầu tiên.
 *
 * Dùng ở cả thanh phát lẫn trình phát đầy đủ nên logic nằm gọn trong một component.
 */
export function MixButton({ variant = "icon", className }: MixButtonProps) {
  const current = usePlayerStore((state) => state.current);
  const [pending, setPending] = useState(false);

  if (!current) return null;

  const label = mixQueueLabel(current);

  async function startMix(songId: string, queueLabel: string): Promise<void> {
    if (pending) return;
    setPending(true);

    try {
      const response = await fetch(`/api/songs/${songId}/mix`, { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as { songs?: SongDTO[]; error?: string };

      if (!response.ok) throw new Error(data.error ?? "Không tạo được mix quanh bài này.");

      const songs = data.songs ?? [];
      if (songs.length === 0) {
        toast.info("Thư viện chưa có bài nào khác để trộn mix.");
        return;
      }

      usePlayerStore.getState().playQueue(songs, 0, queueLabel);
      toast.success(`${queueLabel} · ${songs.length} bài`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tạo được mix quanh bài này.");
    } finally {
      setPending(false);
    }
  }

  const title = `${label} (bài tương tự về thể loại, nghệ sĩ)`;

  if (variant === "labeled") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => void startMix(current.id, label)}
        title={title}
        className={className}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Radio />} Mix quanh bài này
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      onClick={() => void startMix(current.id, label)}
      title={title}
      className={cn("size-9 sm:size-8", className)}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Radio />}
    </Button>
  );
}
