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
}

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

  const slider = (
    <input
      type="range"
      min={0}
      max={safeMax}
      step={step}
      value={Math.min(value, safeMax)}
      disabled={disabled}
      title={title}
      onChange={(event) => onChange(Number(event.target.value))}
      onPointerDown={handlePointerDown}
      onKeyUp={handleKeyUp}
      className={cn(
        "w-full cursor-pointer appearance-none outline-none disabled:cursor-not-allowed disabled:opacity-50",
        // Vung bam/keo cao 22px, thanh hien thi van manh 6px (nho bg-clip-content + padding)
        "h-[22px] rounded-full py-2 bg-clip-content",
        // Nut keo mau trang: vien mo theo giao dien de van nhin thay tren nen sang
        "[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-foreground/20 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow",
        "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-foreground/20 [&::-moz-range-thumb]:bg-white",
        className,
      )}
      style={{ background }}
    />
  );

  if (markerPercent === undefined) return slider;

  return (
    <span className="relative block w-full">
      {slider}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 h-[10px] w-px -translate-y-1/2 bg-foreground/40"
        style={{ left: `${Math.min(Math.max(markerPercent, 0), 100)}%` }}
      />
    </span>
  );
}


