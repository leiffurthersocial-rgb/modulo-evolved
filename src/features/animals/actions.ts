import type { Sex } from "@/engine/genetics/types";
import { SPECIES } from "@/engine/species/roster";
import type { SpeciesId } from "@/engine/species/types";
import { sim } from "@/sim/client";
import { useWorld } from "@/sim/world-store";
import { useUi } from "@/state/ui-store";

const notice = (text: string) => useWorld.getState().pushNotice(text);

/** Mate two animals immediately; the litter appears next to the mother. */
export async function breedPair(a: number, b: number) {
  useUi.getState().setPairing(null);
  const res = await sim.rpc<{ born: number[]; stillborn: number; error?: string }>("breed", a, b);
  if (res.error) return notice(`Can't breed: ${res.error}`);
  const body = sim.bodies.get(res.born[0]);
  const name = body ? SPECIES[body.species].name.toLowerCase() : "";
  const sb = res.stillborn ? ` (${res.stillborn} stillborn)` : "";
  if (!res.born.length) notice(`No surviving young${sb}. Recessive load or hybrid incompatibility.`);
  else notice(`${res.born.length} young ${name}${res.born.length > 1 ? "s" : ""} born${sb}.`);
  if (res.born.length) useWorld.getState().select(res.born[0]);
}

export async function feedAnimal(id: number) {
  await sim.rpc("feed", id);
  notice(`Fed #${id}.`);
}

/** Release wild-type animals at a world position (tap-to-place tool). */
export async function placeAnimals(
  species: SpeciesId,
  x: number,
  z: number,
  count: number,
  sex: Sex | "pair",
) {
  const res = await sim.rpc<{ ids: number[]; error?: string }>("spawnWild", species, x, z, count, sex);
  if (res.error) notice(res.error);
}
