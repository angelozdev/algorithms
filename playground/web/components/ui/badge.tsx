import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.ts";

const badgeVariants = cva("inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
      green: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
      amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
      red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
