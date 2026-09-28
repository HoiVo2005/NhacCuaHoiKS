"use client";

import { Music4 } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-card/30 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="relative flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
        {/* Quang sang nhe phia sau bieu tuong */}
        <span aria-hidden className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl" />
        <Music4 className="relative size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
