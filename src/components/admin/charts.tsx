import { Badge } from "@/components/ui/badge";
import { SOURCE_LABELS } from "@/lib/constants";
import { formatDateOnly, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SourceType } from "@/types";

/**
 * Do lech truc doc: gia tri cao nhat nam duoi dinh mot chut de con cho cho nhan.
 * (Chieu cao bieu do: 132px tren dien thoai, 176px tu `sm` - xem `heightClass`.)
 */
const CHART_TOP_PERCENT = 8;

/**
 * Bieu do duong (luot nghe theo ngay) - SVG thuan, khong phu thuoc thu vien.
 *
 * Vi sao khong dung toa do px co dinh nhu truoc:
 *  - Ban cu ep be rong toi thieu co dinh (560px) va cho cuon ngang nen tren dien thoai
 *    bieu do chi hien mot phan va nguoi dung khong biet dang xem ngay nao.
 *  - Nay ve trong he toa do 0..100 voi `preserveAspectRatio="none"` (co gian theo be rong khung),
 *    cham moc duoc ve bang HTML (%) nen luon tron va dung co CSS pixel o moi be rong;
 *    net ve dung `vectorEffect="non-scaling-stroke"` de khong bi keo day theo khung.
 */
export function PlaysLineChart({ data }: { data: { date: string; plays: number }[]; height?: number }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>;
  }

  const maxValue = Math.max(...data.map((item) => item.plays), 1);
  const stepX = 100 / Math.max(data.length - 1, 1);

  const points = data.map((item, index) => ({
    ...item,
    x: index * stepX,
    // 0 luot = chan bieu do (100%), cao nhat = CHART_TOP_PERCENT
    y: 100 - (item.plays / maxValue) * (100 - CHART_TOP_PERCENT),
  }));

  const linePath = points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const areaPath = `0,100 ${linePath} 100,100`;
  const lastPoint = points[points.length - 1];

  /** Cac duong ke ngang + nhan truc doc (dung chung mot moc de nhan thang hang voi duong ke) */
  const guides = [
    { top: CHART_TOP_PERCENT, label: formatNumber(maxValue) },
    { top: CHART_TOP_PERCENT + (100 - CHART_TOP_PERCENT) / 2, label: formatNumber(Math.round(maxValue / 2)) },
    { top: 100, label: "0" },
  ];

  const heightClass = `h-[132px] sm:h-[176px]`;

  return (
    <div className="w-full">
      <div className="flex gap-2">
        {/* Truc doc */}
        <div className={cn("relative w-8 shrink-0", heightClass)}>
          {guides.map((guide) => (
            <span
              key={guide.label}
              className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ top: `${guide.top}%` }}
            >
              {guide.label}
            </span>
          ))}
        </div>

        {/* Vung ve bieu do */}
        <div className={cn("relative min-w-0 flex-1", heightClass)}>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            <defs>
              <linearGradient id="plays-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {guides.map((guide) => (
              <line
                key={guide.label}
                x1="0"
                x2="100"
                y1={guide.top}
                y2={guide.top}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="2 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <polygon points={areaPath} fill="url(#plays-area)" />
            <polyline
              points={linePath}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {points.map((point) => (
            <span
              key={point.date}
              className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky ring-2 ring-background/60"
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              title={`${formatDateOnly(point.date)}: ${point.plays} lượt`}
            />
          ))}

          {/* Ngay cao nhat cuoi cung: nhan gia tri ngay tren diem */}
          <span
            className="absolute -translate-x-1/2 -translate-y-[150%] rounded-full bg-surface/90 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary ring-1 ring-border/60"
            style={{ left: `${Math.min(Math.max(lastPoint.x, 12), 88)}%`, top: `${lastPoint.y}%` }}
          >
            {lastPoint.plays}
          </span>
        </div>
      </div>

      <div className="mt-2 flex justify-between pl-10 text-[10px] text-muted-foreground">
        <span>{formatDateOnly(data[0].date)}</span>
        <span className="hidden sm:inline">{formatDateOnly(data[Math.floor(data.length / 2)].date)}</span>
        <span>{formatDateOnly(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}

/** Bieu do cot ngang (the loai, bai hat...) */
export function HorizontalBars({
  items,
  unit = "",
}: {
  items: { label: string; value: number; color?: string | null }[];
  unit?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>;
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label} className="min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatNumber(item.value)}
              {unit}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max((item.value / max) * 100, 3)}%`,
                backgroundColor: item.color ?? "var(--primary)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Bang xep hang: hang so thu tu + ten + goi y nho + gia tri, kem thanh ti le mong.
 * Dung cho "bai hat nghe nhieu nhat" va "nhan vien nghe nhieu nhat".
 */
export function RankedList({
  items,
  unit = "",
  emptyMessage = "Chưa có dữ liệu.",
}: {
  items: { id?: string; label: string; hint?: string; value: number }[];
  unit?: string;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li key={item.id ?? item.label} className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Badge
              variant={index === 0 ? "neon" : "secondary"}
              className="w-5 shrink-0 justify-center px-0 text-[10px] tabular-nums"
            >
              {index + 1}
            </Badge>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{item.label}</span>
              {item.hint ? (
                <span className="block truncate text-[10px] text-muted-foreground">{item.hint}</span>
              ) : null}
            </span>

            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formatNumber(item.value)}
              {unit}
            </span>
          </div>

          <div className="ml-7 mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-gradient-brand"
              style={{ width: `${Math.max((item.value / max) * 100, 3)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Ti le theo nguon phat: thanh gop + chu giai */
export function SourceBreakdown({ items }: { items: { source: SourceType; count: number }[] }) {
  /*
   * Mau nguon phat lay tu token (`--source-*`): ban sang dung sac dam hon, ban toi
   * dung mau thuong hieu cua nen tang -> cham mau/cot luon nhin ro o ca hai giao dien.
   */
  const colors: Record<SourceType, string> = {
    YOUTUBE: "var(--source-youtube)",
    SOUNDCLOUD: "var(--source-soundcloud)",
    TIKTOK: "var(--source-tiktok)",
    UPLOADED: "var(--source-uploaded)",
  };

  const visible = items.filter((item) => item.count > 0);
  const total = visible.reduce((sum, item) => sum + item.count, 0);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có lượt nghe nào.</p>;
  }

  return (
    <div className="space-y-3.5">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {visible.map((item) => (
          <div
            key={item.source}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(item.count / total) * 100}%`,
              backgroundColor: colors[item.source],
            }}
            title={`${SOURCE_LABELS[item.source]}: ${item.count} lượt`}
          />
        ))}
      </div>

      <ul className="space-y-2">
        {visible.map((item) => (
          <li key={item.source} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colors[item.source] }}
            />
            <span className="min-w-0 flex-1 truncate">{SOURCE_LABELS[item.source]}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatNumber(item.count)} · {Math.round((item.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
