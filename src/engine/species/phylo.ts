import type { SpeciesId } from "./types";

/**
 * Deep phylogeny of the roster (approximate divergence times, Mya, from TimeTree).
 * Live speciation events in the simulation are grafted onto these tips.
 */
export interface DeepNode {
  name: string;
  /** Age of this node (Mya). Tips are 0. */
  age: number;
  children?: DeepNode[];
  species?: SpeciesId;
}

const tip = (species: SpeciesId, name: string): DeepNode => ({ name, age: 0, species });

export const DEEP_TREE: DeepNode = {
  name: "Vertebrata",
  age: 465,
  children: [
    tip("shark", "Chondrichthyes"),
    {
      name: "Osteichthyes",
      age: 430,
      children: [
        {
          name: "Teleostei",
          age: 230,
          children: [tip("sardine", "Clupeiformes"), tip("pike", "Esociformes")],
        },
        {
          name: "Tetrapoda",
          age: 352,
          children: [
            tip("frog", "Amphibia"),
            {
              name: "Amniota",
              age: 319,
              children: [
                {
                  name: "Archosauria",
                  age: 245,
                  children: [
                    tip("crocodile", "Crocodylia"),
                    {
                      name: "Aves",
                      age: 92,
                      children: [
                        tip("duck", "Anseriformes"),
                        {
                          name: "Neoaves",
                          age: 70,
                          children: [tip("hawk", "Accipitriformes"), tip("sparrow", "Passeriformes")],
                        },
                      ],
                    },
                  ],
                },
                {
                  name: "Placentalia",
                  age: 100,
                  children: [
                    tip("elephant", "Afrotheria"),
                    {
                      name: "Boreoeutheria",
                      age: 92,
                      children: [
                        {
                          name: "Euarchontoglires",
                          age: 87,
                          children: [tip("rabbit", "Glires"), tip("human", "Primates")],
                        },
                        {
                          name: "Laurasiatheria",
                          age: 82,
                          children: [
                            {
                              name: "Ungulata",
                              age: 78,
                              children: [
                                {
                                  name: "Cetartiodactyla",
                                  age: 60,
                                  children: [tip("deer", "Cervidae"), tip("boar", "Suidae")],
                                },
                                tip("zebra", "Perissodactyla"),
                              ],
                            },
                            {
                              name: "Carnivora",
                              age: 55,
                              children: [
                                tip("lion", "Feliformia"),
                                {
                                  name: "Caniformia",
                                  age: 45,
                                  children: [
                                    tip("bear", "Ursidae"),
                                    {
                                      name: "Canidae",
                                      age: 9,
                                      children: [tip("fox", "Vulpini"), tip("wolf", "Canini")],
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

function pathTo(node: DeepNode, sp: SpeciesId, acc: DeepNode[] = []): DeepNode[] | null {
  const here = [...acc, node];
  if (node.species === sp) return here;
  for (const c of node.children ?? []) {
    const p = pathTo(c, sp, here);
    if (p) return p;
  }
  return null;
}

/** Time since the most recent common ancestor of two species (Mya). */
export function divergenceMya(a: SpeciesId, b: SpeciesId): number {
  if (a === b) return 0;
  const pa = pathTo(DEEP_TREE, a)!;
  const pb = pathTo(DEEP_TREE, b)!;
  let mrca = pa[0];
  for (let i = 0; i < Math.min(pa.length, pb.length) && pa[i] === pb[i]; i++) mrca = pa[i];
  return mrca.age;
}
