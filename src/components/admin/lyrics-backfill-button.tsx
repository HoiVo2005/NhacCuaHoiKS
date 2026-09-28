"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MicVocal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** So lan goi API toi da cho mot lan bam (moi lan toi da 20 bai) */
const MAX_BATCHES = 10;

interface BackfillResponse {
  attempted?: number;
  found?: number;
  missing?: number;
  unavailable?: number;
  skipped?: number;
  remaining?: number;
  error?: string;
}

/**
 * Nut "lay loi cho cac bai chua co" o thư viện nhạc (quan tri vien).
 *
 * Goi API theo tung dot 20 bai cho tới khi het bai chua co loi, het ngan sach cua LRCLIB,
 * hoac dot vua roi khong tao them duoc loi nao (mang loi) — nho vay khong bam mai khong dung.
 */
export function LyricsBackfillButton({ missing }: { missing: number }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function run(): Promise<void> {
    if (pending) return;
    setPending(true);

    let found = 0;
    let notFound = 0;
    let unavailable = 0;
    let skipped = 0;

    try {
      for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
        const response = await fetch("/api/admin/lyrics/backfill", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ limit: 20 }),
        });
        const data = (await response.json().catch(() => ({}))) as BackfillResponse;

        if (!response.ok) throw new Error(data.error ?? "Không lấy được lời bài hát.");

        found += data.found ?? 0;
        notFound += data.missing ?? 0;
        unavailable += data.unavailable ?? 0;
        skipped += data.skipped ?? 0;

        const progressed = (data.found ?? 0) + (data.missing ?? 0) > 0;
        if ((data.remaining ?? 0) === 0 || (data.attempted ?? 0) === 0 || !progressed) break;
      }

      router.refresh();
      toast.success(
        `Đã lấy lời cho ${found} bài` +
          (notFound > 0 ? ` · ${notFound} bài LRCLIB chưa có lời` : "") +
          (unavailable > 0 ? ` · ${unavailable} bài lỗi mạng, thử lại sau` : "") +
          (skipped > 0 ? ` · bỏ qua ${skipped} bài không phải bài hát đơn` : ""),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lấy được lời bài hát.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending || missing === 0}
      onClick={() => void run()}
      title="Tự tra cứu lời (LRCLIB) cho các bài trong thư viện chưa có lời"
    >
      {pending ? <Loader2 className="animate-spin" /> : <MicVocal />}
      {pending ? "Đang lấy lời…" : missing === 0 ? "Bài nào cũng có lời" : `Lấy lời cho ${missing} bài`}
    </Button>
  );
}
