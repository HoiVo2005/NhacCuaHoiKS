"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, HelpCircle, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmVariant = "danger" | "warning" | "default";

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** Cac dong ghi chu ngan (vi du danh sach ten ban ghi se bi xoa) */
  highlights?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

const VARIANTS: Record<
  ConfirmVariant,
  { Icon: React.ComponentType<{ className?: string }>; badge: string; button: "destructive" | "gradient" }
> = {
  danger: {
    Icon: Trash2,
    badge: "bg-destructive-soft text-destructive-soft-foreground ring-1 ring-destructive/30",
    button: "destructive",
  },
  warning: {
    Icon: AlertTriangle,
    badge: "bg-warning-soft text-warning-soft-foreground ring-1 ring-warning/30",
    button: "gradient",
  },
  default: { Icon: HelpCircle, badge: "bg-primary/15 text-primary ring-1 ring-primary/25", button: "gradient" },
};

/**
 * Hop thoai xac nhan dung chung (Radix AlertDialog) voi API dang Promise:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Xoá bài nhạc?", variant: "danger" }))) return;
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  const confirm = useCallback<ConfirmFn>((next) => {
    resolverRef.current?.(false); // dong cai cu (neu con)
    setOptions(next);
    setOpen(true);

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  const variant = VARIANTS[options?.variant ?? "danger"];
  const Icon = variant.Icon;

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) settle(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  variant.badge,
                )}
              >
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 space-y-1.5 pt-0.5">
                <AlertDialogTitle>{options?.title ?? "Xác nhận"}</AlertDialogTitle>
                {options?.description ? (
                  <AlertDialogDescription>{options.description}</AlertDialogDescription>
                ) : null}
              </div>
            </div>

            {options?.highlights?.length ? (
              <ul className="scrollbar-thin max-h-32 space-y-1 overflow-y-auto rounded-xl border border-border/70 bg-surface/60 p-3 text-[11px] text-muted-foreground">
                {options.highlights.map((item) => (
                  <li key={item} className="truncate">
                    • {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="ghost">{options?.cancelLabel ?? "Huỷ"}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild onClick={() => settle(true)}>
              <Button variant={variant.button}>
                {options?.confirmLabel ?? (options?.variant === "danger" ? "Xoá" : "Đồng ý")}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error("useConfirm phải được dùng bên trong <ConfirmProvider>");
  }

  return context;
}
