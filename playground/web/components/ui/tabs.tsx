import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.ts";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("flex gap-1 border-b border-neutral-200 px-2 dark:border-neutral-800", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "-mb-px border-b-2 border-transparent px-2 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 data-[state=active]:border-neutral-900 data-[state=active]:text-neutral-900 dark:hover:text-neutral-100 dark:data-[state=active]:border-neutral-100 dark:data-[state=active]:text-neutral-100",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("min-h-0 flex-1 overflow-auto data-[state=inactive]:hidden", className)} {...props} />;
}
