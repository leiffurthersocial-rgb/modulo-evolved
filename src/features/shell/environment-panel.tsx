"use client";

import { cn } from "@/lib/cn";
import { InfoTip } from "@/ui/info-tip";
import { Slider } from "@/ui/slider";
import { Switch } from "@/ui/switch";
import { BIOMES, useEnv, type BiomeId, type EnvParams } from "@/state/env-store";

type NumericKey = { [K in keyof EnvParams]: EnvParams[K] extends number ? K : never }[keyof EnvParams];

const SLIDERS: {
  key: NumericKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  info: string;
}[] = [
  {
    key: "temperature",
    label: "Temperature",
    min: -20,
    max: 40,
    step: 0.5,
    format: (v) => `${v.toFixed(1)} °C`,
    info: "Mean annual temperature. Animals outside their genetically determined thermal tolerance pay extra metabolic cost to thermoregulate — a key driver of Bergmann's rule (larger bodies in colder climates). For crocodiles it also sets offspring sex.",
  },
  {
    key: "humidity",
    label: "Humidity",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
    info: "Relative humidity. Together with temperature it controls plant growth and water availability, and changes how fast skin types lose water.",
  },
  {
    key: "food",
    label: "Primary productivity",
    min: 0,
    max: 2,
    step: 0.01,
    format: (v) => `${v.toFixed(2)}×`,
    info: "How fast vegetation and plankton regrow. This is the energy entering the food web — it ultimately caps the carrying capacity of every trophic level above it (~10% of energy passes up each level).",
  },
  {
    key: "seasonality",
    label: "Seasonality",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
    info: "Amplitude of the yearly cycle in temperature and productivity. Strong seasons favour fat storage, migration and timed breeding.",
  },
];

export function EnvironmentPanel() {
  const env = useEnv();

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-[11px] font-medium tracking-wider text-fg-subtle uppercase">Biome preset</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(BIOMES) as BiomeId[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={env.biome === id}
              onClick={() => env.applyBiome(id)}
              className={cn(
                "h-11 rounded-md border border-border bg-surface-2 text-sm text-fg-muted focus-ring transition-colors hover:border-border-strong hover:text-fg",
                env.biome === id &&
                  "border-accent/60 bg-accent-muted/40 text-accent-strong hover:border-accent/60 hover:text-accent-strong",
              )}
            >
              {BIOMES[id].label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium tracking-wider text-fg-subtle uppercase">
          Climate &amp; resources
        </h3>
        {SLIDERS.map((s) => (
          <div key={s.key}>
            <div className="flex items-center justify-between">
              <label id={`env-${s.key}`} className="flex items-center gap-1.5 text-sm text-fg">
                {s.label}
                <InfoTip title={s.label} side="left">
                  {s.info}
                </InfoTip>
              </label>
              <span className="font-mono text-xs text-fg-muted tabular-nums">{s.format(env[s.key])}</span>
            </div>
            <Slider
              aria-labelledby={`env-${s.key}`}
              min={s.min}
              max={s.max}
              step={s.step}
              value={[env[s.key]]}
              onValueChange={([v]) => env.set({ [s.key]: v })}
            />
          </div>
        ))}
      </section>

      <section className="flex items-center justify-between">
        <label htmlFor="env-disease" className="flex items-center gap-1.5 text-sm text-fg">
          Disease
          <InfoTip title="Disease" side="left">
            Pathogens spread by contact and scale with population density, so they act as density-dependent
            regulation. Hosts can evolve resistance at a metabolic cost.
          </InfoTip>
        </label>
        <Switch id="env-disease" checked={env.disease} onCheckedChange={(disease) => env.set({ disease })} />
      </section>
      <p className="text-xs text-fg-subtle">
        These controls drive the simulation once the ecology engine lands in milestone 4.
      </p>
    </div>
  );
}
