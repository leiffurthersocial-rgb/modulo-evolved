"use client";

import type { Genome, Sex } from "@/engine/genetics/types";
import type { EnvSettings } from "@/engine/sim/types";
import type { SpeciesId } from "@/engine/species/types";
import { decodeUrl, encodeUrl } from "./codec";

/** What a share link carries: a reproducible scenario (seed + settings) and/or a genome. */
export interface SharePayload {
  v: 1;
  scenario?: string;
  seed?: number;
  env?: EnvSettings;
  genome?: { species: SpeciesId; sex: Sex; name: string; genome: Genome };
}

export function shareUrl(p: Omit<SharePayload, "v">) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = `m=${encodeUrl({ v: 1, ...p })}`;
  return url.toString();
}

export function readShare(): SharePayload | null {
  if (typeof window === "undefined") return null;
  const m = /[#&]m=([^&]+)/.exec(window.location.hash);
  if (!m) return null;
  try {
    const p = decodeUrl<SharePayload>(m[1]);
    return p.v === 1 ? p : null;
  } catch {
    return null;
  }
}

export function clearShareHash() {
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
