"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  /**
   * Phía mở menu: mặc định đổ xuống dưới. Menu nằm trong thanh phát (sát đáy màn hình) phải
   * mở LÊN TRÊN, nếu không danh sách sẽ bị cắt ở mép dưới cửa sổ.
   */
  side?: "bottom" | "top";
  className?: string;
  /** Mở/đóng do bên ngoài điều khiển (bỏ trống = menu tự quản lý) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Menu khong duoc dong khi bam vao o nhap lieu hoac nut giu-menu (`data-dropdown-keep-open`) */
const KEEP_OPEN_SELECTOR = "input, textarea, select, [data-dropdown-keep-open]";

/** Menu nho gon, tu dong dong khi bam ra ngoai hoac nhan Esc */
export function Dropdown({
  trigger,
  children,
  align = "right",
  side = "bottom",
  className,
  open: controlledOpen,
  onOpenChange,
}: DropdownProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const containerRef = useRef<HTMLDivElement | null>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  useEffect(() => {
    if (!open) return;

    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, setOpen]);

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") setOpen(!open);
        }}
      >
        {trigger}
      </div>

      {open ? (
        <div
          onClick={(event) => {
            /*
             * Menu hen gio co ô nhập liệu (tự chọn số phút / tắt lúc mấy giờ). Bấm vào ô nhập
             * hoặc nút có `data-dropdown-keep-open` (ví dụ nút “Hẹn” báo lỗi nhập sai) không được
             * làm đóng menu; các mục thường vẫn đóng như cũ.
             */
            if ((event.target as HTMLElement).closest(KEEP_OPEN_SELECTOR)) return;

            setOpen(false);
          }}
          className={cn(
            "animate-fade-in absolute z-50 min-w-48 overflow-y-auto overscroll-contain rounded-xl border border-border/80 bg-popover/95 p-1 shadow-2xl backdrop-blur-xl",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2",
            align === "right" ? "right-0" : "left-0",
            className,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownItem({
  children,
  onSelect,
  className,
  destructive,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  className?: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-surface-hover",
        destructive && "text-destructive hover:bg-destructive/10",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}
