import { cn } from "@/lib/cn";

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border-strong bg-surface-2 px-1.5 font-mono text-[11px] leading-none text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}

/** Renders a shortcut combo like "mod+k" as platform-appropriate keycaps. */
export function KeyCombo({ combo, className }: { combo: string; className?: string }) {
  const parts = combo.split("+").map(formatKey);
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {parts.map((p, i) => (
        <Kbd key={i}>{p}</Kbd>
      ))}
    </span>
  );
}

const KEY_LABELS: Record<string, string> = {
  mod: "⌘",
  shift: "⇧",
  alt: "⌥",
  ctrl: "⌃",
  space: "Space",
  escape: "Esc",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
};

function formatKey(key: string) {
  return KEY_LABELS[key.toLowerCase()] ?? key.toUpperCase();
}
