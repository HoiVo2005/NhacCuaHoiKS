import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

/**
 * Tieu de cua mot "shelf" (dai noi dung) tren trang chu.
 *
 * Dung lai o moi muc (Nghe tiep, Playlist noi bat, Moi them, Nghe nhieu nhat) de giao dien
 * nhat quan: icon nho mau chu dao + tieu de dam + lien ket "Xem tat ca" + vet sang duoi chan.
 * Day la kieu bo cuc "shelf" cua cac app nhac lon (Spotify/Apple Music): nguoi dung quet
 * tieu de roi lan theo hang ngang.
 */
export function SectionHeader({
  title,
  hint,
  icon: Icon,
  href,
  linkLabel = "Xem tất cả",
  ariaLabel,
  className,
}: {
  title: string;
  /** Mo ta ngan duoi tieu de (tuy chon) */
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  /** Co "Xem tat ca" thi truyen href */
  href?: string;
  linkLabel?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <header className={cn("space-y-2.5", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <Icon className="size-4" />
            </span>
            {/* Tieu de: tren man hinh hep cho phep xuong 2 dong (khong cat cut) - tu `sm` moi cat 1 dong */}
            <h2 className="line-clamp-2 text-lg font-semibold tracking-tight sm:line-clamp-none sm:truncate">
              {title}
            </h2>
          </div>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>

        {href ? (
          <Link
            href={href}
            aria-label={ariaLabel}
            className="group/link flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/10"
          >
            {linkLabel}
            <ChevronRight className="size-3.5 transition group-hover/link:translate-x-0.5" />
          </Link>
        ) : null}
      </div>

      {/* Vet sang ngan cach shelf voi noi dung ben duoi */}
      <div className="hairline h-px w-full opacity-60" />
    </header>
  );
}