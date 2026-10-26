# Modulo Evolved: Plan

## Decisions

| Topic         | Decision                                                                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Target device | **iPad first** (landscape primary, portrait supported), touch and hardware keyboard as equal inputs. Desktop works too.                                                                                                                          |
| Roster        | Real species only, 18 across land, air and water. Fantasy forms come only from evolution and Splice Lab.                                                                                                                                         |
| Scale         | ~500 agents at 60 fps on iPad; graceful degradation (impostors, no shadows) on weaker GPUs.                                                                                                                                                      |
| Genetics      | Diploid, 40–80 loci per species on 6–10 chromosomes with a cM linkage map; polygenic, dominance, epistasis, regulatory loci, recessive load, sexual selection, neutral markers. Sex: XY mammals, ZW birds, temperature-dependent for crocodiles. |
| Chimeras      | Free-form; anatomy and physics impose honest trade-offs plus a developmental-compatibility cost. Spliced parts are encoded as body-module loci, so chimeras breed true.                                                                          |
| Producers     | Regrowing biomass grid (land vegetation and aquatic plankton), driven by climate and season.                                                                                                                                                     |
| Persistence   | IndexedDB autosave, versioned JSON export/import, compressed share URLs. No backend.                                                                                                                                                             |
| Art           | Stylized low-poly, flat-shaded, soft-lit. Bioluminescent teal accent (#2dd4bf) on near-black slate.                                                                                                                                              |
| Extras        | Heritable behavior (boldness, sociality, aggression, choosiness, foraging).                                                                                                                                                                      |
| Deploy        | Vercel Git integration (imported once from GitHub; every push deploys).                                                                                                                                                                          |

## Roster

| Role       | Land                          | Air     | Water       |
| ---------- | ----------------------------- | ------- | ----------- |
| Producers  | Grass/forest biomass          | –       | Plankton    |
| Herbivores | Rabbit, Deer, Zebra, Elephant | Sparrow | Sardine     |
| Omnivores  | Wild boar, Brown bear, Human  | Mallard | –           |
| Predators  | Fox, Wolf, Lion               | Hawk    | Pike, Shark |
| Amphibious | Crocodile, Frog               | –       | –           |

## Humans

- **Species:** _Homo sapiens_ is a diploid omnivore with XY sex determination, evolving under the same rules as every other species.
- **Anatomy:**
  - Bipedal, built for endurance rather than sprinting.
  - Sweat-based cooling lets them run in heat when other animals must stop, which enables persistence hunting.
  - Low bite force, offset by tools.
  - Large brain with a high energy cost.
  - Long childhood and heavy parental investment, so few offspring.
- **Real loci, simplified:**
  - Skin pigmentation (MC1R/SLC24A5-like), balancing UV damage against vitamin D, so it tracks latitude and climate.
  - Lactase persistence (LCT-like), which is only favored when the Human impact layer has herding switched on.
  - High-altitude adaptation (EPAS1-like).
  - Body-proportion genes that follow Bergmann's and Allen's rules.
- **Culture:** a second inheritance channel alongside genes. Bands hold tool and foraging know-how that spreads by social learning, both to offspring and sideways between bands, much faster than genes. It can be lost when populations are small. Charts plot cultural and genetic change separately.
- **Behavior:** band sociality, cooperative hunting and sharing, built on the heritable behavior traits.
- **Human impact layer** (optional, part of Environment; can be switched on with or without simulated humans):
  - Hunting pressure, habitat clearing, farming and herding (which changes the vegetation grid), and protected areas.
  - Example scenarios: overhunting and megafauna extinction, domestication, island introductions.
- **Labs:** humans can be edited, crossed and spliced like any species. Physics trade-offs apply: wings on a 70 kg biped don't fly. Breeding between species still requires low genetic distance.

## Input model (iPad)

- **Touch:** 1-finger drag orbits, 2-finger drag pans, pinch zooms, tap selects, double-tap follows, long-press opens a context menu. Every target is at least 44 pt. Science explanations open on tap (`InfoTip`); hover tooltips only duplicate labels and shortcuts.
- **Keyboard:** one command registry (`src/features/commands`) drives hotkeys, the ⌘K palette and the `?` shortcut sheet. WASD moves the camera, arrows orbit, `=`/`-` zoom, `0` resets. Avoids combos iPadOS Safari reserves.
- **Installable web app:** fullscreen manifest, safe-area insets, no page zoom or bounce.

## Milestones

1. **Scaffold and design system.** Shell, tokens, docked panels, command palette, CI, Vercel. ✅
2. **Genetics engine and tests.** Includes the human genome template. Mendelian ratios, Hardy–Weinberg, recombination vs map distance, drift ∝ 1/N, inbreeding depression. ✅
3. **3D world and agents.** Worker sim loop, instanced procedural creatures, walk/swim/fly motion and a bipedal gait, follow camera. ✅
4. **Ecology and environments.** Energy flow, biomass grids, predation, disease, seasons, catastrophes, behavior genetics, human culture and the Human impact layer. ✅
5. **Genome Editor and Cross Lab.** Live phenotype preview, Punnett squares, offspring distributions, lines, undo/redo. ✅
6. **Splice Lab.** Modular parts, derived anatomy stats, release into the world. ✅
7. **Charts and phylogeny.** Charts, live tree, species-split detection, inspector. ✅
8. **Persistence, polish and performance.** IndexedDB saves, files and share links, welcome and tour, example scenarios, settings, accessibility, sky and post-processing, iPad performance tuning. ✅

## Risks

- **iPad GPU budget:** fixed draw-call and triangle budget, measured in M3; level of detail → impostors.
- **Chimera seams:** standardized sockets and size-matched blending, prototyped in M3.
- **Balancing 18 species:** allometric defaults (Kleiber), plus an automated "ecosystem survives 500 sim-years" test.
- **3D steering for birds and fish:** layered-altitude steering, not full physics.
- **Cross-browser determinism:** runs are reproducible per browser engine (transcendental float functions differ between engines).
