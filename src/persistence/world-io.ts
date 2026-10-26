"use client";

import type { SaveFile } from "@/engine/sim/serialize";
import { scenarioById } from "@/engine/sim/scenarios";
import { sim } from "@/sim/client";
import { useWorld } from "@/sim/world-store";
import { useEnv } from "@/state/env-store";
import { useScenario } from "@/sim/scenario-store";
import { download, gunzipJson, gzipJson, pickFile } from "./codec";
import { deleteSave, getSave, listSaves, putSave, type SaveMeta } from "./db";

export const AUTOSAVE_ID = "autosave";

async function snapshot(): Promise<{ file: SaveFile; data: Uint8Array } | null> {
  const file = await sim.rpc<SaveFile | null>("exportState");
  if (!file) return null;
  return { file, data: gzipJson(file) };
}

function metaFor(id: string, name: string, file: SaveFile, bytes: number): SaveMeta {
  const species = new Set(file.agents.map((a) => a.species)).size;
  return {
    id,
    name,
    savedAt: Date.now(),
    day: file.day,
    scenario: file.scenario,
    animals: file.agents.length,
    species,
    bytes,
  };
}

export async function saveWorld(name: string, id = `save-${Date.now().toString(36)}`) {
  const snap = await snapshot();
  if (!snap) return null;
  const meta = metaFor(id, name, snap.file, snap.data.byteLength);
  await putSave(meta, snap.data);
  return meta;
}

export async function loadWorld(id: string) {
  const rec = await getSave(id);
  if (!rec) throw new Error("Save not found");
  await applyFile(gunzipJson<SaveFile>(rec.data));
}

async function applyFile(file: SaveFile) {
  await sim.rpc("importState", file);
  useEnv.getState().load(file.env, "custom");
  useScenario.getState().set({ scenarioId: file.scenario, seed: file.config.seed });
  useWorld
    .getState()
    .pushNotice(`Loaded world: ${scenarioById(file.scenario).name}, year ${Math.floor(file.day / 365)}.`);
}

export async function exportWorldFile() {
  const snap = await snapshot();
  if (!snap) return;
  const y = Math.floor(snap.file.day / 365);
  download(`modulo-${snap.file.scenario}-y${y}.modulo`, snap.data, "application/gzip");
}

export async function importWorldFile() {
  const f = await pickFile(".modulo,application/gzip,.gz,.json");
  if (!f) return false;
  const buf = new Uint8Array(await f.arrayBuffer());
  const file =
    buf[0] === 0x1f && buf[1] === 0x8b
      ? gunzipJson<SaveFile>(buf)
      : (JSON.parse(new TextDecoder().decode(buf)) as SaveFile);
  await applyFile(file);
  return true;
}

export { listSaves, deleteSave };
