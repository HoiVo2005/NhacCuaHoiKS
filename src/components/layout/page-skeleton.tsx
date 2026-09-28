import { cn } from "@/lib/utils";

/**
 * Khung xuong (skeleton) hien ra ngay khi chuyen trang trong luc server dang lay du lieu.
 * Nho vay cam giac chuyen trang nhanh hon nhieu so voi man hinh dung yen cho.
 *
 * Vet sang chay qua (`.shimmer`) thay cho `animate-pulse` de nhin "song dong" hon.
 */
export function PageSkeleton({
  rows = 6,
  showHeader = true,
  className,
}: {
  rows?: number;
  showHeader?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("animate-fade-in space-y-6", className)} aria-busy="true" aria-live="polite">
      {showHeader ? (
        <div className="space-y-2">
          <SkeletonBar className="h-7 w-56 rounded-lg" />
          <SkeletonBar className="h-4 w-72" />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="card-surface space-y-3 rounded-2xl p-3">
            <SkeletonBar className="aspect-video w-full rounded-xl" />
            <SkeletonBar className="h-4 w-3/4" />
            <SkeletonBar className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mot thanh xam co vet sang chay qua (nhip 1.6s) */
function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded bg-[length:220%_100%] bg-[linear-gradient(90deg,var(--surface)_0%,var(--surface-hover)_45%,var(--surface)_90%)]",
        className,
      )}
    />
  );
}
