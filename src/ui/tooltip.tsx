"use client";

import * as React from "react";
import { Tooltip as T } from "radix-ui";
import { KeyCombo } from "./kbd";

export const TooltipProvider = ({ children }: { children: React.ReactNode }) => (
  <T.Provider delayDuration={350} skipDelayDuration={150}>
    {children}
  </T.Provider>
);

/**
 * Hover/focus label for pointer and keyboard users. Touch users never see it,
 * so it must only duplicate information (e.g. an aria-label + shortcut).
 * For explanations that touch users need, use <InfoTip>.
 */
export function Tooltip({
  content,
  shortcut,
  side = "top",
  children,
}: {
  content: React.ReactNode;
  shortcut?: string;
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactElement;
}) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={8}
          className="z-50 flex animate-pop-in items-center gap-2 rounded-md border border-border bg-surface-3 px-2.5 py-1.5 text-xs text-fg shadow-panel"
        >
          {content}
          {shortcut && <KeyCombo combo={shortcut} />}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
