import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
  {
    variants: {
      tone: {
        neutral: "bg-surface-3 text-fg-muted",
        accent: "bg-accent-muted text-accent-strong",
        producer: "bg-producer/15 text-producer",
        herbivore: "bg-herbivore/15 text-herbivore",
        omnivore: "bg-omnivore/15 text-omnivore",
        carnivore: "bg-carnivore/15 text-carnivore",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
