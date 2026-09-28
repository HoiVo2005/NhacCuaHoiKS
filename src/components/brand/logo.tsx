import { cn } from "@/lib/utils";

/**
 * Logo NhacCuaHoiKS: khoi gradient tim-hong-xanh voi not nhac + song am thanh.
 * Dung chung cho sidebar, thanh dieu huong mobile, trang dang nhap va favicon.
 *
 * LUU Y: nen dung gradient bang CSS (`bg-gradient-brand`) thay vi <linearGradient>
 * trong SVG - nhieu logo cung id gradient tren mot trang se lam trinh duyet lay sai
 * dinh nghia (logo bi trang/tang hinh). Cach nay chac chan hien thi dung mau.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="NhacCuaHoiKS"
      title="NhacCuaHoiKS"
      className={cn(
        "bg-gradient-brand inline-flex size-9 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden focusable="false" className="size-[62%]">
        <ellipse
          cx="8.2"
          cy="16.6"
          rx="3"
          ry="2.5"
          transform="rotate(-18 8.2 16.6)"
          fill="currentColor"
        />
        <rect x="10.6" y="5.2" width="2" height="11" rx="1" fill="currentColor" />
        <path
          d="M13.2 5.9c2.1.6 3.7 1.9 4.7 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M18.2 12.6c.6 1.4.9 2.8.9 4.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeOpacity="0.5"
        />
      </svg>
    </span>
  );
}

/** Logo kem ten thuong hieu */
export function BrandLockup({
  name,
  subtitle,
  className,
  markClassName,
}: {
  name: string;
  subtitle?: string;
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <BrandMark className={cn("size-9 rounded-xl shadow-lg", markClassName)} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight">{name}</span>
        {subtitle ? (
          <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}
