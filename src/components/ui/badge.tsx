import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors [&_svg]:size-3",
  {
    variants: {
      variant: {
        /*
         * Cac bien the trang thai dung cap token "*-soft" + "*-soft-foreground":
         * moi giao dien tu chon sac do nen + mau chu nen badge luon doc duoc
         * (truoc day `default` dat chu trang tren nen tim nhat -> mat chu o giao dien sang).
         */
        default: "border-primary/30 bg-primary-soft text-primary-soft-foreground",
        secondary: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        success: "border-success/30 bg-success-soft text-success-soft-foreground",
        warning: "border-warning/30 bg-warning-soft text-warning-soft-foreground",
        destructive: "border-destructive/30 bg-destructive-soft text-destructive-soft-foreground",
        neon: "border-transparent bg-gradient-brand text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
