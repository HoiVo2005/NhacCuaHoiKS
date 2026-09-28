"use client";

import { SEEK_KEYS } from "@/lib/seek";
import { cn } from "@/lib/utils";

interface RangeInputProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
  /**
   * Goi khi nguoi dung THA thanh truot (chuot/ngon tay) hoac tha phim mui ten.
   * Dung de tua bai: tha o ngoai thanh truot hay bi trinh duyet huy thao tac
   * (pointercancel) van duoc ghi nhan - truoc day thanh thoi gian bi "ket".
   */
  onCommit?: (value: number) => void;
  disabled?: boolean;
  step?: number;
  className?: string;
  title?: string;
  /** Vi tri (%) ve vach moc, vi du 50 cho moc "100% am luong goc" */
  markerPercent?: number;
  /** Doan tu vi tri nay (% tro len) duoc to mau khac (vung khuech dai) */
  boostFromPercent?: number;
  /**
   * `vertical`: thanh truot DUNG cho am luong tren dien thoai - keo len = tang,
   * keo xuong = giam (giong cac app nhac).
   */
  orientation?: "horizontal" | "vertical";
}

/** Chieu cao co dinh cua thanh truot dung (input sau khi xoay la `w-32`) */
export const VERTICAL_RANGE_HEIGHT_CLASS = "h-32";

/**
 * Thanh truot dung cho seek / am luong (nen tang native, khong phu thuoc thu vien).
 * Ho tro vach moc + to mau rieng cho vung khuech dai am thanh.
 *
 * Vung cham: hop cua thanh truot cao 22px (chia 2 lop padding 20px) va `bg-clip-content`
 * nen RANH VAN MANH 6px, nhung vung bam/keo rong hon nhieu lan - dung duoc ca tren dien thoai
 * (ngon tay) lan desktop (chuot). Truoc day tren desktop hop chi cao 6px (`sm:h-1.5`) nen rat
 * kho keo trung - nguoi dung tuong thanh am luong bi hong.
 */
export function RangeInput({
  value,
  max,
  onChange,
  onCommit,
  disabled,
  step = 0.5,
  className,
  title,
  markerPercent,
  boostFromPercent,
  orientation = "horizontal",
}: RangeInputProps) {
  const safeMax = max > 0 ? max : 1;
  const percent = Math.min(Math.max((value / safeMax) * 100, 0), 100);
  /*
   * Phan CHUA keo cua thanh truot: truoc day la `rgba(255,255,255,0.15)` nen tren giao dien
   * sang (nen trang) thanh truot gan nhu bien mat. Dung `--foreground` de tu doi theo giao dien:
   * ban sang = xam dam 15%, ban toi = trang 15%.
   */
  const idle = "color-mix(in srgb, var(--foreground) 15%, transparent)";

  const inBoostZone = boostFromPercent !== undefined && percent > boostFromPercent;

  const background = inBoostZone
    ? `linear-gradient(to right, var(--brand) 0%, var(--brand) ${boostFromPercent}%, var(--brand-alt) ${boostFromPercent}%, var(--brand-alt) ${percent}%, ${idle} ${percent}%)`
    : `linear-gradient(to right, var(--brand) ${percent}%, ${idle} ${percent}%)`;

  function commit(input: HTMLInputElement | null): void {
    if (!input || !onCommit) return;
    onCommit(Number(input.value));
  }

  /**
   * Bat dau keo: lang nghe su kien THA o cap window de tha chuot/ngon tay o ngoai
   * thanh truot (hoac bi trinh duyet huy thao tac - pointercancel) van duoc ghi nhan.
   */
  function handlePointerDown(event: React.PointerEvent<HTMLInputElement>): void {
    if (disabled || !onCommit) return;

    const input = event.currentTarget;

    const finish = () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      commit(input);
    };

    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", finish, { once: true });
  }

  /** Ban phim: mui ten / Home / End cung phai tua bai nhu keo-tha */
  function handleKeyUp(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (!SEEK_KEYS.has(event.key)) return;
    commit(event.currentTarget);
  }

  /** Thuoc tinh dung chung cho ca thanh truot NGANG lan DOC (chi khac phan xoay/dinh vi) */
  const sliderProps = {
    type: "range" as const,
    min: 0,
    max: safeMax,
    step,
    value: Math.min(value, safeMax),
    disabled,
    title,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value)),
    onPointerDown: handlePointerDown,
    onKeyUp: handleKeyUp,
  };

  const sliderClass = cn(
    "cursor-pointer appearance-none outline-none disabled:cursor-not-allowed disabled:opacity-50",
    // Vung bam/keo cao 22px, thanh hien thi van manh 6px (nho bg-clip-content + padding)
    "h-[22px] rounded-full py-2 bg-clip-content",
    // Nut keo mau trang: vien mo theo giao dien de van nhin thay tren nen sang
    "[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-foreground/20 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow",
    "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-foreground/20 [&::-moz-range-thumb]:bg-white",
  );

  const normalizedMarker =
    markerPercent === undefined ? null : Math.min(Math.max(markerPercent, 0), 100);

  /*
   * Thanh truot DUNG (am luong tren dien thoai):
   * trinh duyet chi ve thanh truot ngang, nen xoay -90deg de thanh thanh doc. Xoay nguoc chieu kim
   * dong ho lam truc +x (huong to mau `to right`) tro LEN TREN, nho vay phan da keo luon o duoi va
   * KEO LEN = TANG am luong - dung cam giac nguoi dung. Vung bam rong 26px cho ngon tay.
   */
  if (orientation === "vertical") {
    return (
      <span className={cn("relative block w-[26px]", VERTICAL_RANGE_HEIGHT_CLASS, className)}>
        <input
          {...sliderProps}
          className={cn(
            sliderClass,
            "absolute left-1/2 top-1/2 w-32 -translate-x-1/2 -translate-y-1/2 -rotate-90",
          )}
          style={{ background }}
        />

        {normalizedMarker === null ? null : (
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 h-px w-[10px] -translate-x-1/2 bg-foreground/40"
            style={{ bottom: `${normalizedMarker}%` }}
          />
        )}
      </span>
    );
  }

  const slider = (
    <input {...sliderProps} className={cn("w-full", sliderClass, className)} style={{ background }} />
  );

  if (normalizedMarker === null) return slider;

  return (
    <span className="relative block w-full">
      {slider}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 h-[10px] w-px -translate-y-1/2 bg-foreground/40"
        style={{ left: `${normalizedMarker}%` }}
      />
    </span>
  );
}


