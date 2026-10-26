"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FolderOpen, Link2, Save, Trash2, Upload } from "lucide-react";
import { scenarioById } from "@/engine/sim/scenarios";
import { useScenario } from "@/sim/scenario-store";
import { useWorld } from "@/sim/world-store";
import { useEnv } from "@/state/env-store";
import { useUi } from "@/state/ui-store";
import { exportLibrary, importLibrary } from "@/persistence/library-io";
import { copyText, shareUrl } from "@/persistence/share";
import {
  deleteSave,
  exportWorldFile,
  importWorldFile,
  listSaves,
  loadWorld,
  saveWorld,
  AUTOSAVE_ID,
} from "@/persistence/world-io";
import type { SaveMeta } from "@/persistence/db";
import { Button } from "@/ui/button";
import { Dialog, DialogContent } from "@/ui/dialog";
import { InfoTip } from "@/ui/info-tip";

export function SavesDialog() {
  const open = useUi((s) => s.dialog === "saves");
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const close = () => useUi.getState().setDialog(null);
  const refresh = useCallback(
    () =>
      void listSaves()
        .then(setSaves)
        .catch(() => setSaves([])),
    [],
  );
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg(ok);
      refresh();
    } catch (e) {
      setMsg(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const { scenarioId, seed } = useScenario.getState();
    const url = shareUrl({ scenario: scenarioId, seed, env: useEnv.getState().settings() });
    setMsg(
      (await copyText(url)) ? "Link copied — it recreates this scenario, seed and settings from day 0." : url,
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent title="Save and load" className="max-w-[640px]">
        <div className="border-b border-border px-5 py-4 pr-14">
          <h2 className="text-base font-semibold">Save &amp; load</h2>
          <p className="text-sm text-fg-muted">
            Worlds are stored on this device (IndexedDB). Export files to move them elsewhere.
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5">
          <div className="flex gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${scenarioById(useScenario.getState().scenarioId).name} — year ${Math.floor(useWorld.getState().day / 365)}`}
              aria-label="Save name"
              className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-3 text-sm focus-ring placeholder:text-fg-subtle"
            />
            <Button
              variant="primary"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    saveWorld(
                      name ||
                        `${scenarioById(useScenario.getState().scenarioId).name} — year ${Math.floor(useWorld.getState().day / 365)}`,
                    ),
                  "Saved.",
                )
              }
            >
              <Save /> Save world
            </Button>
          </div>
          <ul className="space-y-1.5">
            {saves.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 pr-1"
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await loadWorld(s.id);
                      useUi.getState().setMode("world");
                      close();
                    })
                  }
                  className="flex min-h-14 min-w-0 flex-1 flex-col justify-center rounded-lg px-3 text-left focus-ring"
                >
                  <span className="truncate text-sm">{s.id === AUTOSAVE_ID ? "⟳ Autosave" : s.name}</span>
                  <span className="text-[11px] text-fg-subtle">
                    {scenarioById(s.scenario).name} · year {Math.floor(s.day / 365)} · {s.animals} animals,{" "}
                    {s.species} species · {(s.bytes / 1024).toFixed(0)} KB ·{" "}
                    {new Date(s.savedAt).toLocaleString()}
                  </span>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${s.name}`}
                  onClick={() => void run(() => deleteSave(s.id))}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
            {!saves.length && (
              <li className="py-4 text-center text-sm text-fg-subtle">No saved worlds yet.</li>
            )}
          </ul>
          <section className="space-y-2">
            <h3 className="text-[11px] font-medium tracking-wider text-fg-subtle uppercase">
              Files &amp; sharing
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(exportWorldFile)}>
                <Download /> Export world (.modulo)
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void run(async () => (await importWorldFile()) && close())}
              >
                <Upload /> Import world
              </Button>
              <Button variant="outline" size="sm" onClick={exportLibrary}>
                <Download /> Export genome library
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void run(async () => setMsg(`Imported ${await importLibrary()} lines.`))}
              >
                <FolderOpen /> Import library
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => void share()}>
                <Link2 /> Copy share link
              </Button>
              <InfoTip title="Share links" side="top">
                A compact link encoding the scenario, seed and environment settings, so anyone can rerun the
                same experiment. Full worlds (every animal&apos;s genome) are too big for a link — export a
                file instead. Genomes can be shared from the Genome Editor.
              </InfoTip>
            </div>
          </section>
          {msg && <p className="rounded-md bg-surface-2 px-3 py-2 text-sm break-all text-fg-muted">{msg}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
