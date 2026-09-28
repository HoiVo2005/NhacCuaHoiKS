import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The so lieu tren dashboard quan tri.
 *
 * Vi sao tach rieng:
 *  - Tren dien thoai, 4 the xep doc (1 cot) lam trang dai vai man hinh va trong rat thua -> luoi
 *    2 cot ngay tu man hinh hep, chi 4 cot o man hinh rat rong.
 *  - Nhan dai nhu "Thoi luong nghe: 1 gio 3 phut" truoc day keo rong the ra khoi luoi
 *    -> moi phan tu deu `min-w-0` + `truncate` de khong bao gio tran ngang.
 */
export interface StatCardData {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  /** Vien/icon noi bat cho the quan trong nhat */
  highlight?: boolean;
}

export function StatCard({ stat }: { stat: StatCardData }) {
  const Icon = stat.icon;

  return (
    <Card className={cn("card-surface relative min-w-0 overflow-hidden", stat.highlight && "border-primary/35")}>
      {stat.highlight ? (
        <span aria-hidden className="glow-brand pointer-events-none absolute -right-6 -top-6 size-16" />
      ) : null}

      <CardContent className="min-w-0 space-y-1.5 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg ring-1",
              stat.highlight
                ? "bg-gradient-brand text-white ring-transparent"
                : "bg-primary/12 text-primary ring-primary/20",
            )}
          >
            <Icon className="size-3.5" />
          </span>
          <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {stat.label}
          </span>
        </div>

        <p className="truncate text-lg font-semibold tabular-nums sm:text-2xl" title={stat.value}>
          {stat.value}
        </p>
        <p className="truncate text-[11px] text-muted-foreground" title={stat.hint}>
          {stat.hint}
        </p>
      </CardContent>
    </Card>
  );
}

/** Luoi the so lieu: 2 cot tren dien thoai, 4 cot o man hinh rong */
export function StatGrid({ stats }: { stats: StatCardData[] }) {
  return (
    <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4" aria-label="Số liệu tổng quan">
      {stats.map((stat) => (
        <StatCard key={stat.label} stat={stat} />
      ))}
    </section>
  );
}

/** Tieu de + mo ta phia tren mot nhom noi dung (kieu "shelf" cua trang nghe nhac) */
export function PanelHeader({
  icon: Icon,
  title,
  hint,
  aside,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-border/60 px-3.5 pb-2.5 pt-3.5 sm:px-4">
      <div className="min-w-0">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          {Icon ? <Icon className="size-4 shrink-0 text-primary" /> : null}
          <span className="truncate">{title}</span>
        </h2>
        {hint ? <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

/** The lien ket nhanh sang mot khu quan tri */
export function QuickLink({
  href,
  icon: Icon,
  title,
  description,
  tone = "text-primary",
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tone?: string;
}) {
  return (
    <Link
      href={href}
      className="group card-surface lift flex items-center gap-3 rounded-2xl p-3.5"
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface/80 ring-1 ring-border/60", tone)}>
        <Icon className="size-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{description}</span>
      </span>

      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}
