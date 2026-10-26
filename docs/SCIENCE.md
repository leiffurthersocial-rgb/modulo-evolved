# The science in Modulo Evolved

Modulo Evolved aims to be **qualitatively faithful**: the mechanisms are real, and you should see the classic patterns of population genetics and ecology emerge. To run about 600 animals at 60 fps on an iPad, some quantities are compressed or scaled. This document lists the models, then the simplifications.

## Genetics

- **Genome.** Every animal is diploid, with 59 loci on 8 autosomes plus a sex chromosome (X or Z).
  - Loci have positions in centimorgans.
  - Each allele carries an additive effect, a dominance weight, a copy number, an expression level, a loss-of-function flag, and (for body-part loci) a module payload.
- **Expression.**
  - A heterozygote's value is the dominance-weighted mean of its two alleles, so complete dominance, incomplete dominance and overdominance all come from one rule.
  - Hemizygous loci (XY males, ZW females) are dosage-compensated.
  - Regulatory loci scale their target traits multiplicatively: exp(0.5·Σ effects).
- **Epistasis.**
  - Pairwise interaction terms.
  - Pigmentation uses real recessive epistasis: _ee_ at MC1R masks TYRP1 (B/b), so a dihybrid cross gives 9 : 3 : 4.
- **Recombination.** Meiosis draws a Poisson number of crossovers per chromosome. Recombination fraction follows Haldane's map function, r = ½(1 − e^(−2d)).
- **Sex determination.**
  - XY in mammals, the frog and fish.
  - ZW in birds.
  - Temperature-dependent in the Nile crocodile: mostly male near 32 °C, female at cooler and hotter incubation temperatures.
- **Mutation.**
  - Types: point (effect-size change), indel (loss of function), duplication (copy-number gain), and regulatory (change in expression).
  - Neutral marker loci mutate fastest and serve as a molecular clock.
- **Fitness effects.**
  - Recessive deleterious load produces inbreeding depression.
  - MHC loci give a heterozygote advantage against disease.
- **Hybridization.** Fertility falls smoothly from 1 to 0 as genetic distance (allele sharing) rises from 0.55 to 0.80, a stand-in for accumulated Dobzhansky–Muller incompatibilities.

## Anatomy and physiology

Body plans are built from the genotype, and performance is derived from the body, never set directly:

| Quantity            | Model                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Basal metabolism    | Kleiber's law, BMR ≈ 70·M^0.75 kcal/day; field metabolic rate = BMR × physical activity level                                   |
| Running speed       | Hirt et al. (2017) time-dependent model: speed rises with mass, then falls for very large bodies as acceleration time limits it |
| Flight              | Wing loading against a power limit; heavy bodies with small wings cannot fly                                                    |
| Bite force          | biteK·60·M^0.67 N, with jaw-shape and tooth modifiers                                                                           |
| Thermal comfort     | Insulation, size (Bergmann) and appendage length (Allen) shift the comfort range                                                |
| Lifespan, fecundity | Species baselines from AnAge and PanTHERIA, modified by genotype                                                                |

**Chimeras.** Splice Lab parts are encoded as module alleles, so they are inherited. A foreign part carries a developmental-compatibility cost that grows with the divergence time between donor and host (from TimeTree). The physics above still applies: eagle wings on a 70 kg human add drag and mass but no flight.

## Ecology

- **Producers.**
  - A 64×64 vegetation grid grows logistically.
  - Growth depends on temperature, humidity, season and the productivity setting.
  - Aquatic cells hold plankton.
- **Energy budgets.**
  - Animals gain energy by grazing or by killing and eating prey, and spend it on metabolism, movement and reproduction.
  - Starvation, old age, predation, disease and extrinsic mortality kill.
- **Predation.**
  - Hunting is a stalk, then a pounce.
  - Prey defend themselves with vigilance (scaled by group size) and the confusion effect of herds and schools.
  - Predators choose prey near an optimal size ratio, and large carnivores show intraguild restraint.
  - A Holling type III refuge keeps rare prey from being hunted to zero.
  - Flyers escape ground predators; omnivores hunt only when hungry.
- **Carrion.** Kills and carcasses persist and feed scavengers.
- **Disease.** Contact transmission. Susceptibility depends on immunity genotype and MHC heterozygosity.
- **Behavior genetics.** Boldness, sociality, aggression, mate choosiness and foraging style are heritable traits that affect fitness.
- **Sexual selection.** Ornaments are costly to produce and raise the bearer's chance of being chosen by choosy mates.
- **Catastrophes.**
  - Drought (vegetation collapse).
  - Ice age (−9 °C for a long period).
  - Meteor impact (local mass mortality).
  - Plague (a disease outbreak).

## Humans

- _Homo sapiens_ is an ordinary diploid species in the simulation.
- **Anatomy and energy:** bipedal endurance locomotion and a high-cost brain. Physical activity level is 1.8.
- **Pigmentation loci:** balanced by UV damage on one side and vitamin D on the other, so mean skin lightness tracks the UV setting.
- **Lactase persistence:** a dominant allele, favored only when the Human impact layer has herding switched on.
- **Culture:** a second inheritance channel, learned from parents and band members. It raises foraging and hunting efficiency. It changes much faster than genes, and small groups can lose it.
- **Human impact layer:** hunting pressure, land clearing, and farming or herding. Each of these changes the vegetation grid and mortality.

## Population genetics and speciation

- **Charts:** allele frequencies, heterozygosity and trait means are recorded over time. Drift, selective sweeps, mutation–selection balance and founder effects can be watched directly. The Hardy–Weinberg Lab and Founder Effect scenarios are built for this.
- **Speciation:**
  1. Each species is clustered into **spatial demes**: animals within 22 world units are linked, and connected groups form demes.
  2. The engine measures F<sub>ST</sub> between demes from allele frequencies at every locus.
  3. When the most divergent deme stays at F<sub>ST</sub> ≥ 0.08 for three checks in a row, it becomes a new lineage, appears in the phylogeny, and is given a Latin name.
  4. After the split, reproductive isolation between the two lineages grows with time.
- **Phylogeny view:** shows the real deep tree of the roster (TimeTree divergence times) with the lineages that arose in the simulation on top.

## Simplifications and scaling

| What                    | Real world                                                 | In the simulator                                                   | Why                                                          |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| Population size         | Thousands to millions                                      | About 600 agents, each species with a budget it can borrow against | Frame rate on iPad                                           |
| Mutation rate           | ~10⁻⁸ per base per generation                              | ~10⁻³ per locus per meiosis (adjustable)                           | Evolution visible within minutes                             |
| Speciation threshold    | Typically F<sub>ST</sub> ≫ 0.1 plus reproductive isolation | F<sub>ST</sub> ≥ 0.08 sustained over three checks                  | Splits visible within one session                            |
| Isolation growth        | Thousands of generations                                   | About 12 simulated years                                           | Same                                                         |
| Small prey and plankton | Countless insects, fish, rodents                           | A background "fauna field" that predators can also feed on         | Food webs stay stable without simulating millions of animals |
| Genome                  | Thousands of genes                                         | 59 representative loci                                             | Readable in the editor                                       |
| Geography               | Continents                                                 | One 220-unit island or archipelago                                 | One screen                                                   |
| Time                    | —                                                          | 0.1 days per second at 1×; up to 512×                              | —                                                            |

Within one browser engine, runs are deterministic for a given seed, scenario and sequence of actions. Engines differ slightly in their transcendental math functions, so runs can diverge between browsers.

## Data sources

- **AnAge:** the Animal Ageing and Longevity Database (de Magalhães & Costa, 2009). Maximum lifespan, age at maturity.
- **PanTHERIA:** a species-level database of mammalian life history (Jones et al., 2009). Body mass, litter size, gestation.
- **TimeTree 5:** divergence times between taxa (Kumar et al., 2022). Deep phylogeny and Splice Lab compatibility.
- **Hirt, M. R. et al. (2017):** "A general scaling law reveals why the largest animals are not the fastest." _Nature Ecology & Evolution_ 1, 1116–1122.
- **Kleiber, M. (1947):** "Body size and metabolic rate." _Physiological Reviews_ 27, 511–541.
- **Haldane, J. B. S. (1919):** "The combination of linkage values and the calculation of distances between the loci of linked factors." _Journal of Genetics_ 8, 299–309.
- **Holling, C. S. (1959):** functional responses of predators.
- **Jablonski, N. G. & Chaplin, G. (2000):** "The evolution of human skin coloration." _Journal of Human Evolution_ 39, 57–106.

Species values are rounded and sometimes adjusted for balance. Treat in-app numbers as illustrative rather than reference data.
