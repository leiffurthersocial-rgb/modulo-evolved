"use client";

import * as React from "react";
import { Slider as S } from "radix-ui";
import { cn } from "@/lib/cn";

export function Slider({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn(
        "relative flex h-11 w-full touch-none items-center select-none data-[disabled]:opacity-40",
        className,
      )}
      {...props}
    >
      <S.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-3">
        <S.Range className="absolute h-full bg-accent" />
      </S.Track>
      {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
        <S.Thumb
          key={i}
          className="relative block size-5 rounded-full border-2 border-accent bg-bg shadow focus-ring transition-transform after:absolute after:-inset-3 after:content-[''] active:scale-110"
        />
      ))}
    </S.Root>
  );
}
