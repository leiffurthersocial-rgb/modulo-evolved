"use client";

import * as React from "react";
import { Tabs as T } from "radix-ui";
import { cn } from "@/lib/cn";

export const Tabs = T.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return (
    <T.List
      className={cn("inline-flex items-center gap-1 rounded-lg bg-surface-2 p-1", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium text-fg-muted focus-ring transition-colors hover:text-fg data-[state=active]:bg-surface-3 data-[state=active]:text-fg pointer-coarse:h-11 [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof T.Content>) {
  return <T.Content className={cn("animate-fade-in focus-ring", className)} {...props} />;
}
