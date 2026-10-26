"use client";

import * as React from "react";
import { Switch as S } from "radix-ui";
import { cn } from "@/lib/cn";

export function Switch({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-surface-3 focus-ring transition-colors data-[state=checked]:bg-accent",
        // 44px hit area
        "after:absolute after:-inset-2 after:content-['']",
        className,
      )}
      {...props}
    >
      <S.Thumb className="block size-5 translate-x-1 rounded-full bg-fg shadow transition-transform duration-200 ease-out data-[state=checked]:translate-x-6 data-[state=checked]:bg-accent-fg" />
    </S.Root>
  );
}
