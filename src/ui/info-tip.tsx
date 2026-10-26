"use client";

import * as React from "react";
import { Popover } from "radix-ui";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Tap-to-open science explainer. Works with touch, pointer and keyboard.
 * Use for anything the user needs to understand (e.g. "What is epistasis?").
 */
export function InfoTip({
  title,
  children,
  className,
  side = "top",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`About ${title}`}
        className={cn(
          "relative inline-flex size-5 items-center justify-center rounded-full text-fg-subtle focus-ring transition-colors hover:text-accent data-[state=open]:text-accent",
          // Expand the hit area to 44px without changing layout.
          "after:absolute after:-inset-3 after:content-['']",
          className,
        )}
      >
        <Info className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          sideOffset={10}
          collisionPadding={12}
          className="z-50 w-72 animate-pop-in rounded-lg border border-border bg-surface-2 p-4 text-sm leading-relaxed text-fg-muted shadow-panel focus-ring"
        >
          <p className="mb-1.5 font-medium text-fg">{title}</p>
          {children}
          <Popover.Arrow className="fill-surface-2" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
