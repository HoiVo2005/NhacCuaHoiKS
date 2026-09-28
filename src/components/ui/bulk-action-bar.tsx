"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Thanh thao tac hang loat: hien khi nguoi dung da tick chon it nhat mot dong.
 * Dat ngay duoi danh sach (sticky) de luon nhin thay.
 */
export function BulkActionBar({
  count,
  onClear,
  children,
  className,
}: {
  count: number;
  onClear: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (count === 0) return null;

  return (
    <div
      data-slot="bulk-action-bar"
      className={cn(
        "animate-slide-up sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-card/95 px-3 py-2 shadow-2xl backdrop-blur-xl",
        className,
      )}
    >
      <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
        Đã chọn {count}
      </span>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>

      <Button variant="ghost" size="sm" onClick={onClear} title="Bỏ chọn tất cả">
        <X className="size-3.5" /> Bỏ chọn
      </Button>
    </div>
  );
}
