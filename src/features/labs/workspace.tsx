import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Full-height lab surface between the mode rail and the screen edge. */
export function Workspace({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "absolute z-10 flex animate-fade-in flex-col overflow-hidden rounded-xl border border-border shadow-panel glass",
        "top-[calc(max(env(safe-area-inset-top),12px)+68px)] right-[max(env(safe-area-inset-right),12px)] bottom-[calc(max(env(safe-area-inset-bottom),12px)+68px)] left-[calc(max(env(safe-area-inset-left),12px)+76px)]",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="mr-auto min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <div className="truncate text-xs text-fg-muted">{subtitle}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </section>
  );
}
