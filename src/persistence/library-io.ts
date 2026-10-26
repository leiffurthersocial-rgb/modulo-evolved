"use client";

import { useLab, type LabGenome } from "@/state/lab-store";
import { download, pickFile } from "./codec";

export function exportLibrary() {
  const lib = useLab.getState().library;
  download(
    "modulo-library.json",
    JSON.stringify({ format: "modulo-evolved/library", version: 1, lines: lib }),
    "application/json",
  );
}

export async function importLibrary() {
  const f = await pickFile(".json,application/json");
  if (!f) return 0;
  const data = JSON.parse(await f.text()) as { format?: string; lines?: LabGenome[] };
  if (data.format !== "modulo-evolved/library" || !Array.isArray(data.lines))
    throw new Error("Not a Modulo Evolved library file");
  for (const g of data.lines) useLab.getState().save(g);
  return data.lines.length;
}
