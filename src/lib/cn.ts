import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge about our design-token colors so e.g. `text-fg-muted`
// is treated as a color (and doesn't get merged away against `text-sm`).
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "bg",
        "surface",
        "surface-2",
        "surface-3",
        "border",
        "border-strong",
        "fg",
        "fg-muted",
        "fg-subtle",
        "accent",
        "accent-strong",
        "accent-muted",
        "accent-fg",
        "danger",
        "warning",
        "success",
        "info",
        "producer",
        "herbivore",
        "omnivore",
        "carnivore",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
