import type { ChromosomeDef, LocusDef, TraitId } from "./types";

/**
 * The shared genome architecture: 8 autosomes plus one sex chromosome, 60 loci.
 * Positions are in centiMorgans; nearby loci are linked and tend to be inherited together.
 */
export const CHROMOSOMES: readonly ChromosomeDef[] = [
  { name: "1", lengthCM: 150 },
  { name: "2", lengthCM: 130 },
  { name: "3", lengthCM: 120 },
  { name: "4", lengthCM: 110 },
  { name: "5", lengthCM: 100 },
  { name: "6", lengthCM: 90 },
  { name: "7", lengthCM: 80 },
  { name: "8", lengthCM: 70 },
  { name: "X", lengthCM: 120, sex: true },
];

export const SEX_CHROM = CHROMOSOMES.findIndex((c) => c.sex);

const q = (
  key: string,
  name: string,
  chrom: number,
  posCM: number,
  trait: TraitId,
  info: string,
  weight = 1,
): LocusDef => ({ key, name, chrom, posCM, kind: "quant", trait, weight, info });

/** Ordered by chromosome then position. Index in this array = locus index in genomes. */
export const LOCI: readonly LocusDef[] = [
  // Chromosome 1
  q("size1", "GH1", 0, 10, "size", "Growth hormone. Polygenic contributor to adult body mass."),
  q("size2", "IGF1", 0, 40, "size", "Insulin-like growth factor. Tightly linked to LIMB1 (2 cM).", 1),
  q("limb1", "LIMB1", 0, 42, "limb", "Limb-bud outgrowth. Longer limbs raise top speed but cost stability."),
  q("metab1", "UCP1", 0, 70, "metabolism", "Mitochondrial uncoupling. Raises metabolic heat and energy use."),
  q("therm1", "TRPV1", 0, 95, "thermalOpt", "Thermosensor. Shifts the preferred body/ambient temperature."),
  {
    key: "neut1",
    name: "MS1",
    chrom: 0,
    posCM: 120,
    kind: "neutral",
    info: "Neutral microsatellite marker.",
  },
  {
    key: "load1",
    name: "DEL1",
    chrom: 0,
    posCM: 140,
    kind: "load",
    info: "Housekeeping gene. Loss-of-function homozygotes have reduced viability (inbreeding depression).",
  },
  // Chromosome 2
  q("size3", "HMGA2", 1, 15, "size", "High-mobility group gene. Interacts epistatically with GH1.", 1),
  q("vis1", "RHO", 1, 35, "vision", "Rhodopsin. Low-light visual sensitivity; extends detection range."),
  q("hear1", "OTOF", 1, 55, "hearing", "Otoferlin. Auditory sensitivity."),
  q("smell1", "OR7", 1, 75, "smell", "Olfactory receptor cluster. Scent detection range."),
  q("bite1", "MYH16", 1, 95, "bite", "Jaw-muscle myosin. Stronger bite force."),
  {
    key: "regSize",
    name: "cis-GH",
    chrom: 1,
    posCM: 110,
    kind: "regulatory",
    trait: "size",
    info: "Enhancer controlling growth-axis genes. Scales the effect of every size locus.",
  },
  {
    key: "neut2",
    name: "MS2",
    chrom: 1,
    posCM: 125,
    kind: "neutral",
    info: "Neutral microsatellite marker.",
  },
  // Chromosome 3
  q(
    "orn1",
    "ORN1",
    2,
    20,
    "ornament",
    "Secondary sexual ornament (mane, antlers, plumage). Expressed in males.",
  ),
  q(
    "choose1",
    "PREF1",
    2,
    23,
    "choosiness",
    "Female preference for ornaments. 3 cM from ORN1, so preference and ornament become genetically correlated (Fisherian runaway).",
  ),
  q(
    "fat1",
    "LEP",
    2,
    45,
    "fat",
    "Leptin pathway. Fat storage capacity: survives lean seasons, costs agility.",
  ),
  q("fert1", "FSHB", 2, 65, "fertility", "Fecundity. Larger litters/clutches."),
  q("long1", "FOXO3", 2, 85, "longevity", "Longevity pathway. Slower ageing."),
  {
    key: "load2",
    name: "DEL2",
    chrom: 2,
    posCM: 105,
    kind: "load",
    info: "Essential gene. Recessive lethal-ish when both copies are broken.",
  },
  {
    key: "neut3",
    name: "MS3",
    chrom: 2,
    posCM: 115,
    kind: "neutral",
    info: "Neutral microsatellite marker.",
  },
  // Chromosome 4: pigmentation
  {
    key: "colB",
    name: "TYRP1 (B)",
    chrom: 3,
    posCM: 10,
    kind: "color",
    info: "B = black eumelanin (dominant), b = brown. Only visible if E allows eumelanin.",
  },
  {
    key: "colS",
    name: "ASIP (S)",
    chrom: 3,
    posCM: 70,
    kind: "color",
    info: "Stripes/pattern. Incompletely dominant: heterozygotes are partly patterned.",
  },
  q(
    "light1",
    "SLC24A5",
    3,
    85,
    "lightness",
    "Pigment lightness. In humans balances UV protection against vitamin D synthesis.",
  ),
  q("light2", "SLC45A2", 3, 100, "lightness", "Pigment lightness (second locus)."),
  // Chromosome 5: behaviour
  q("bold1", "DRD4", 4, 10, "boldness", "Novelty seeking. Bold animals flee later and explore more."),
  q("social1", "OXTR", 4, 30, "sociality", "Oxytocin receptor. Herding, pack hunting and band cohesion."),
  q("aggr1", "MAOA", 4, 50, "aggression", "Aggression. Contest success and attack threshold."),
  q("diet1", "TAS2R", 4, 70, "dietBreadth", "Bitter-taste receptors. Wider diet tolerance."),
  q(
    "brain1",
    "ARHGAP11B",
    4,
    85,
    "brain",
    "Neocortex expansion. Learning and culture capacity, high energy cost.",
  ),
  {
    key: "regOrn",
    name: "cis-ORN",
    chrom: 4,
    posCM: 95,
    kind: "regulatory",
    trait: "ornament",
    info: "Regulatory switch scaling ornament expression.",
  },
  // Chromosome 6
  q(
    "imm1",
    "MHC-A",
    5,
    10,
    "immunity",
    "Major histocompatibility complex. Heterozygotes resist more pathogens.",
  ),
  q("imm2", "MHC-B", 5, 30, "immunity", "MHC class II. Interacts with MHC-A."),
  {
    key: "colE",
    name: "MC1R (E)",
    chrom: 5,
    posCM: 40,
    kind: "color",
    info: "E allows dark eumelanin. ee individuals are red/yellow regardless of B: recessive epistasis (9:3:4 ratio). Unlinked to B (different chromosome).",
  },
  q("tbreadth1", "HSP70", 5, 50, "thermalBreadth", "Heat-shock protein. Widens tolerated temperature range."),
  q("sweat1", "EN1", 5, 65, "sweat", "Eccrine sweat-gland density. Evaporative cooling for running in heat."),
  {
    key: "lactase",
    name: "LCT",
    chrom: 5,
    posCM: 80,
    kind: "major",
    trait: "metabolism",
    weight: 0,
    info: "Lactase persistence. Lets adults digest milk; only advantageous where herding is practised.",
  },
  { key: "load3", name: "DEL3", chrom: 5, posCM: 88, kind: "load", info: "Deleterious recessive load." },
  // Chromosome 7: head modules
  {
    key: "modHead",
    name: "HOX-head",
    chrom: 6,
    posCM: 5,
    kind: "module",
    slot: "head",
    info: "Head development module.",
  },
  {
    key: "modJaw",
    name: "DLX-jaw",
    chrom: 6,
    posCM: 12,
    kind: "module",
    slot: "jaw",
    info: "Jaw development module.",
  },
  {
    key: "modTeeth",
    name: "EDA-teeth",
    chrom: 6,
    posCM: 18,
    kind: "module",
    slot: "teeth",
    info: "Dentition module.",
  },
  {
    key: "modEyes",
    name: "PAX6-eye",
    chrom: 6,
    posCM: 30,
    kind: "module",
    slot: "eyes",
    info: "Eye development module.",
  },
  {
    key: "modEars",
    name: "EYA-ear",
    chrom: 6,
    posCM: 36,
    kind: "module",
    slot: "ears",
    info: "External ear module.",
  },
  {
    key: "regLimb",
    name: "ZRS",
    chrom: 6,
    posCM: 50,
    kind: "regulatory",
    trait: "limb",
    info: "Limb enhancer (ZRS of Shh). Scales all limb-length loci.",
  },
  q("limb2", "TBX5", 6, 60, "limb", "Forelimb identity / length."),
  q("metab2", "PPARGC1A", 6, 72, "metabolism", "Mitochondrial biogenesis. Endurance vs. energy cost."),
  // Chromosome 8: body modules
  {
    key: "modFore",
    name: "TBX5-fore",
    chrom: 7,
    posCM: 5,
    kind: "module",
    slot: "forelimbs",
    info: "Forelimb module.",
  },
  {
    key: "modHind",
    name: "PITX1-hind",
    chrom: 7,
    posCM: 12,
    kind: "module",
    slot: "hindlimbs",
    info: "Hindlimb module.",
  },
  {
    key: "modTail",
    name: "WNT-tail",
    chrom: 7,
    posCM: 25,
    kind: "module",
    slot: "tail",
    info: "Tail module.",
  },
  {
    key: "modCover",
    name: "KRT-cover",
    chrom: 7,
    posCM: 35,
    kind: "module",
    slot: "covering",
    info: "Skin covering module: fur, feathers, scales.",
  },
  { key: "modWings", name: "WING", chrom: 7, posCM: 50, kind: "module", slot: "wings", info: "Wing module." },
  { key: "modFins", name: "FIN", chrom: 7, posCM: 58, kind: "module", slot: "fins", info: "Fin module." },
  q(
    "alt1",
    "EPAS1",
    7,
    66,
    "altitude",
    "Hypoxia response. High-altitude and cold-stress adaptation (Tibetan variant).",
  ),
  // Sex chromosome (X in mammals, Z in birds; an autosome-like pair in crocodiles)
  q("therm2", "TRPM8", 8, 15, "thermalOpt", "Cold sensor. Sex-linked."),
  q("vis2", "OPN1LW", 8, 30, "vision", "Long-wave opsin. Sex-linked like human red-green colour vision."),
  {
    key: "load4",
    name: "DEL4",
    chrom: 8,
    posCM: 50,
    kind: "load",
    info: "Sex-linked recessive: hemizygous individuals are always exposed (like haemophilia).",
  },
  { key: "neut4", name: "MS4", chrom: 8, posCM: 70, kind: "neutral", info: "Neutral sex-linked marker." },
  q("choose2", "PREF2", 8, 90, "choosiness", "Sex-linked mate preference."),
  { key: "neut5", name: "MS5", chrom: 8, posCM: 110, kind: "neutral", info: "Neutral sex-linked marker." },
];

export const LOCUS_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  LOCI.map((l, i) => [l.key, i]),
);

export function locusIndex(key: string): number {
  const i = LOCUS_INDEX[key];
  if (i === undefined) throw new Error(`Unknown locus ${key}`);
  return i;
}

/** Locus indices per chromosome, sorted by position. */
export const LOCI_BY_CHROM: readonly (readonly number[])[] = CHROMOSOMES.map((_, c) =>
  LOCI.map((l, i) => ({ l, i }))
    .filter(({ l }) => l.chrom === c)
    .sort((x, y) => x.l.posCM - y.l.posCM)
    .map(({ i }) => i),
);

export const IS_SEX_LOCUS: readonly boolean[] = LOCI.map((l) => l.chrom === SEX_CHROM);

/** Pairwise epistatic interactions: trait += k * value(a) * value(b). */
export const EPISTASIS: readonly { a: string; b: string; trait: TraitId; k: number; info: string }[] = [
  { a: "size1", b: "size3", trait: "size", k: 0.15, info: "GH1 × HMGA2: growth genes amplify each other." },
  {
    a: "imm1",
    b: "imm2",
    trait: "immunity",
    k: 0.25,
    info: "MHC-A × MHC-B: complementary antigen presentation.",
  },
  {
    a: "bold1",
    b: "aggr1",
    trait: "aggression",
    k: 0.2,
    info: "Bold, aggressive genotypes escalate contests.",
  },
];

export const TRAIT_LOCI: Readonly<Record<TraitId, number[]>> = (() => {
  const out = {} as Record<TraitId, number[]>;
  LOCI.forEach((l, i) => {
    if ((l.kind === "quant" || l.kind === "major") && l.trait) (out[l.trait] ??= []).push(i);
  });
  return out;
})();

export const REGULATORS: Readonly<Partial<Record<TraitId, number[]>>> = (() => {
  const out: Partial<Record<TraitId, number[]>> = {};
  LOCI.forEach((l, i) => {
    if (l.kind === "regulatory" && l.trait) (out[l.trait] ??= []).push(i);
  });
  return out;
})();

export const MODULE_LOCI = LOCI.map((l, i) => ({ l, i })).filter(({ l }) => l.kind === "module");
export const NEUTRAL_LOCI = LOCI.map((l, i) => ({ l, i }))
  .filter(({ l }) => l.kind === "neutral")
  .map(({ i }) => i);
export const LOAD_LOCI = LOCI.map((l, i) => ({ l, i }))
  .filter(({ l }) => l.kind === "load")
  .map(({ i }) => i);
