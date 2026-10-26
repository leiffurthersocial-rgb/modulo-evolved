# Modulo Evolved: Plan

## Decisions

| Topic         | Decision                                                                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Target device | **iPad first** (landscape primary, portrait supported), touch and hardware keyboard as equal inputs. Desktop works too.                                                                                                                          |
| Roster        | Real species only, 16 across land, air and water. Fantasy forms come only from evolution and Splice Lab.                                                                                                                                         |
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
| Omnivores  | Wild boar, Brown bear         | Duck    | –           |
| Predators  | Fox, Wolf, Lion               | Hawk    | Pike, Shark |
| Amphibious | Crocodile, Frog               | –       | –           |

## Input model (iPad)

- **Touch:** 1-finger drag orbits, 2-finger drag pans, pinch zooms, tap selects, double-tap follows, long-press opens a context menu. Every target is at least 44 pt. Science explanations open on tap (`InfoTip`); hover tooltips only duplicate labels and shortcuts.
- **Keyboard:** one command registry (`src/features/commands`) drives hotkeys, the ⌘K palette and the `?` shortcut sheet. WASD moves the camera, arrows orbit, `=`/`-` zoom, `0` resets. Avoids combos iPadOS Safari reserves.
- **Installable web app:** fullscreen manifest, safe-area insets, no page zoom or bounce.

## Milestones

1. **Scaffold and design system.** Shell, tokens, docked panels, command palette, CI, Vercel. ✅
2. **Genetics engine and tests.** Mendelian ratios, Hardy–Weinberg, recombination vs map distance, drift ∝ 1/N, inbreeding depression.
3. **3D world and agents.** Worker sim loop, instanced procedural creatures, walk/swim/fly motion, follow camera.
4. **Ecology and environments.** Energy flow, biomass grids, predation, disease, seasons, catastrophes, behavior genetics.
5. **Genome Editor and Cross Lab.** Live phenotype preview, Punnett squares, offspring distributions, lines, undo/redo.
6. **Splice Lab.** Modular parts, derived anatomy stats, release into the world.
7. **Charts and phylogeny.** uPlot charts, live tree, species-split detection, inspector.
8. **Polish and performance.** Tour, example scenarios, accessibility, iPad performance tuning.

## Risks

- **iPad GPU budget:** fixed draw-call and triangle budget, measured in M3; level of detail → impostors.
- **Chimera seams:** standardized sockets and size-matched blending, prototyped in M3.
- **Balancing 16 species:** allometric defaults (Kleiber), plus an automated "ecosystem survives 500 sim-years" test.
- **3D steering for birds and fish:** layered-altitude steering, not full physics.
- **Cross-browser determinism:** runs are reproducible per browser engine (transcendental float functions differ between engines).
