"use client";

import { Command as Cmdk } from "cmdk";
import { Search } from "lucide-react";
import { Dialog, DialogContent } from "@/ui/dialog";
import { KeyCombo } from "@/ui/kbd";
import { useUi } from "@/state/ui-store";
import { useSim } from "@/state/sim-store";
import { getCommands, type CommandGroup } from "../commands/commands";

const GROUP_ORDER: CommandGroup[] = ["Simulation", "Camera", "Events", "Navigate", "Panels", "Help"];

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  // Re-render labels like "Play"/"Pause" when state changes.
  useSim((s) => s.paused);
  useUi((s) => s.dockOpen);

  const commands = getCommands().filter((c) => c.id !== "help.palette");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Command palette" hideClose className="max-w-[560px]">
        <Cmdk loop filter={rankCommand} className="flex min-h-0 flex-col">
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-[18px] text-fg-subtle" aria-hidden />
            <Cmdk.Input
              autoFocus
              placeholder="Type a command or search…"
              className="h-14 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
            />
          </div>
          <Cmdk.List className="max-h-[min(420px,56vh)] overflow-y-auto overscroll-contain p-2">
            <Cmdk.Empty className="px-3 py-8 text-center text-sm text-fg-subtle">
              No matching commands.
            </Cmdk.Empty>
            {GROUP_ORDER.map((group) => (
              <Cmdk.Group
                key={group}
                heading={group}
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-subtle [&_[cmdk-group-heading]]:uppercase"
              >
                {commands
                  .filter((c) => c.group === group)
                  .map((c) => {
                    const Icon = c.icon;
                    return (
                      <Cmdk.Item
                        key={c.id}
                        value={c.label}
                        keywords={c.keywords}
                        onSelect={() => {
                          setOpen(false);
                          c.run();
                        }}
                        className="flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-fg-muted data-[selected=true]:bg-surface-3 data-[selected=true]:text-fg"
                      >
                        {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
                        <span className="flex-1 truncate">{c.label}</span>
                        {c.shortcut && <KeyCombo combo={c.shortcut} />}
                      </Cmdk.Item>
                    );
                  })}
              </Cmdk.Group>
            ))}
          </Cmdk.List>
        </Cmdk>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Predictable ranking: label word-prefix > label substring > keyword substring > fuzzy label.
 * (cmdk's default fuzzy scorer lets long keyword lists outrank exact label hits.)
 */
function rankCommand(value: string, search: string, keywords?: string[]) {
  const q = search.trim().toLowerCase();
  if (!q) return 1;
  const label = value.toLowerCase();
  if (label.split(/\s+/).some((w) => w.startsWith(q))) return 1;
  if (label.includes(q)) return 0.8;
  if (keywords?.some((k) => k.toLowerCase().includes(q))) return 0.5;
  let i = 0;
  for (const ch of label) if (ch === q[i]) i++;
  return i === q.length ? 0.1 : 0;
}
