"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/** Checkbox (Radix UI) dung cho tick chon nhieu dong / thao tac hang loat */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border border-border/80 bg-surface/70 text-white outline-none transition",
        "hover:border-primary/60 hover:bg-surface-hover",
        "focus-visible:ring-2 focus-visible:ring-primary/40",
        "data-[state=checked]:border-primary data-[state=checked]:bg-gradient-brand",
        "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary/25 data-[state=indeterminate]:text-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        {props.checked === "indeterminate" ? (
          <Minus className="size-3" strokeWidth={3} />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
