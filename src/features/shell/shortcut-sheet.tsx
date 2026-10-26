"use client";

import { Dialog, DialogContent } from "@/ui/dialog";
import { KeyCombo } from "@/ui/kbd";
import { useUi } from "@/state/ui-store";
import { getCommands, type CommandGroup } from "../commands/commands";

const GESTURES: { gesture: string; action: string }[] = [
  { gesture: "Drag (1 finger)", action: "Orbit camera" },
  { gesture: "Drag (2 fingers)", action: "Pan camera" },
  { gesture: "Pinch", action: "Zoom" },
  { gesture: "Tap", action: "Select animal" },
  { gesture: "Double-tap", action: "Follow animal" },
  { gesture: "Long-press", action: "Context menu" },
];

const CAMERA_KEYS: { combo: string; action: string }[] = [
  { combo: "w", action: "Move forward" },
  { combo: "s", action: "Move back" },
  { combo: "a", action: "Strafe left" },
  { combo: "d", action: "Strafe right" },
  { combo: "arrowleft", action: "Orbit left" },
  { combo: "arrowright", action: "Orbit right" },
  { combo: "arrowup", action: "Tilt up" },
  { combo: "arrowdown", action: "Tilt down" },
  { combo: "=", action: "Zoom in" },
  { combo: "-", action: "Zoom out" },
  { combo: "0", action: "Reset view" },
];

export function ShortcutSheet() {
  const open = useUi((s) => s.shortcutsOpen);
  const setOpen = useUi((s) => s.setShortcutsOpen);
  const commands = getCommands().filter((c) => c.shortcut);
  const groups = [...new Set(commands.map((c) => c.group))] as CommandGroup[];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Keyboard shortcuts and gestures" className="max-w-[720px]">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">Controls</h2>
          <p className="text-sm text-fg-muted">
            Touch and keyboard work everywhere — use whichever you like.
          </p>
        </div>
        <div className="grid gap-x-8 gap-y-6 overflow-y-auto overscroll-contain px-6 py-5 sm:grid-cols-2">
          {groups.map((group) => (
            <Section key={group} title={group}>
              {commands
                .filter((c) => c.group === group)
                .map((c) => (
                  <Row key={c.id} label={c.label.replace(/^Toggle /, "")}>
                    <KeyCombo combo={c.shortcut!} />
                  </Row>
                ))}
            </Section>
          ))}
          <Section title="Camera (keyboard)">
            {CAMERA_KEYS.map((k) => (
              <Row key={k.combo} label={k.action}>
                <KeyCombo combo={k.combo} />
              </Row>
            ))}
          </Section>
          <Section title="Touch gestures">
            {GESTURES.map((g) => (
              <Row key={g.gesture} label={g.action}>
                <span className="text-xs text-fg-subtle">{g.gesture}</span>
              </Row>
            ))}
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-medium tracking-wider text-fg-subtle uppercase">{title}</h3>
      <ul className="space-y-1">{children}</ul>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex h-8 items-center justify-between gap-4 text-sm text-fg-muted">
      <span>{label}</span>
      {children}
    </li>
  );
}
