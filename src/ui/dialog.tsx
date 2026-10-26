"use client";

import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  hideClose,
  ...props
}: React.ComponentProps<typeof D.Content> & {
  title: string;
  description?: string;
  hideClose?: boolean;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/60 backdrop-blur-[2px]" />
      <D.Content
        className={cn(
          "fixed top-[7vh] left-1/2 z-50 flex max-h-[86vh] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 animate-pop-in flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-panel focus:outline-none",
          className,
        )}
        {...props}
      >
        <D.Title className="sr-only">{title}</D.Title>
        {description ? (
          <D.Description className="sr-only">{description}</D.Description>
        ) : (
          <D.Description className="sr-only">{title}</D.Description>
        )}
        {children}
        {!hideClose && (
          <D.Close
            aria-label="Close"
            className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-md text-fg-muted focus-ring hover:bg-surface-3 hover:text-fg"
          >
            <X className="size-[18px]" />
          </D.Close>
        )}
      </D.Content>
    </D.Portal>
  );
}
