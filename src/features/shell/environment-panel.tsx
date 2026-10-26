"use client";

import { Biohazard, Flame, Snowflake, SunDim } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/button";
import { InfoTip } from "@/ui/info-tip";
import { Slider } from "@/ui/slider";
import { Switch } from "@/ui/switch";
import { BIOMES, useEnv, type BiomeId } from "@/state/env-store";
import type { EnvSettings, HumanImpact } from "@/engine/sim/types";
import { sim } from "@/sim/client";
import { useWorld } from "@/sim/world-store";

type NumKey = "temperature" | "humidity" | "food" | "seasonality" | "uv" | "mutationRate";

const CLIMATE: {
  key: NumKey;
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
    info: "Mean annual temperature at sea level (−0.28 °C per unit of altitude). Outside its genetically set thermal range an endotherm pays extra energy to stay warm or cool — the root of Bergmann's rule. It also sets crocodile hatchling sex.",
  },
  {
    key: "humidity",
    label: "Humidity",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
    info: "Water availability. With temperature it controls plant growth (net primary productivity).",
  },
  {
    key: "food",
    label: "Primary productivity",
    min: 0,
    max: 2,
    step: 0.01,
    format: (v) => `${v.toFixed(2)}×`,
    info: "Capacity and regrowth of vegetation and plankton: the energy entering the food web. Only ~10% passes to each trophic level above.",
  },
  {
    key: "seasonality",
    label: "Seasonality",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
    info: "Amplitude of the yearly cycle (±12 °C at 100%). Strong seasons favour fat storage and timed, seasonal breeding.",
  },
  {
    key: "uv",
    label: "UV intensity",
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
    info: "Sunlight UV. Dark skin protects folate from UV; light skin makes vitamin D when UV is weak. Drives human pigmentation genes (SLC24A5, SLC45A2).",
  },
  {
    key: "mutationRate",
    label: "Mutation rate",
    min: 0,
    max: 10,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}×`,
    info: "Multiplier on point, indel, duplication and regulatory mutation rates (base rates are already ~1000× real so change is visible in minutes).",
  },
];

const IMPACT: { key: "hunting" | "clearing" | "farming" | "protectedArea"; label: string; info: string }[] = [
  {
    key: "hunting",
    label: "Hunting pressure",
    info: "Extra mortality on animals over 4 kg outside protected areas. Large, slow-breeding species are hit hardest (the overkill hypothesis).",
  },
  {
    key: "clearing",
    label: "Habitat clearing",
    info: "Removes vegetation capacity outside protected areas. Watch trees disappear and herbivores decline.",
  },
  { key: "farming", label: "Agriculture", info: "Extra food for humans, at the cost of wild plant habitat." },
  {
    key: "protectedArea",
    label: "Protected area",
    info: "A central reserve (radius as a fraction of the island) where hunting and clearing don't happen.",
  },
];

export function EnvironmentPanel() {
  const env = useEnv();
  const temperature = useWorld((s) => s.temperature);
  const season = useWorld((s) => s.season);
  const events = useWorld((s) => s.events);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2.5">
        <div>
          <p className="text-[11px] tracking-wider text-fg-subtle uppercase">Now</p>
          <p className="text-sm font-medium">
            {season} · {temperature.toFixed(1)} °C at sea level
          </p>
        </div>
        {events.length > 0 && (
          <span className="rounded-sm bg-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-warning uppercase">
            {events.map((e) => e.kind).join(" · ")}
          </span>
        )}
      </div>

      <section>
        <h3 className="mb-2 text-[11px] font-medium tracking-wider text-fg-subtle uppercase">
          Climate preset
        </h3>
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
          Climate, resources &amp; evolution
        </h3>
        {CLIMATE.map((s) => (
          <SliderRow
            key={s.key}
            id={`env-${s.key}`}
            label={s.label}
            info={s.info}
            value={env[s.key]}
            min={s.min}
            max={s.max}
            step={s.step}
            format={s.format}
            onChange={(v) => env.set({ [s.key]: v } as Partial<EnvSettings>)}
          />
        ))}
        <ToggleRow
          id="env-disease"
          label="Disease"
          info="Contact-transmitted pathogens. Spread scales with density (density-dependent regulation); MHC diversity and immunity genes resist. Mostly spreads within a clade."
          checked={env.disease}
          onChange={(disease) => env.set({ disease })}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium tracking-wider text-fg-subtle uppercase">Catastrophes</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <Button variant="outline" size="sm" onClick={() => sim.trigger("drought")}>
            <SunDim /> Drought
          </Button>
          <Button variant="outline" size="sm" onClick={() => sim.trigger("iceAge")}>
            <Snowflake /> Ice age
          </Button>
          <Button variant="outline" size="sm" onClick={() => sim.trigger("meteor")}>
            <Flame /> Meteor
          </Button>
          <Button variant="outline" size="sm" onClick={() => sim.trigger("plague")}>
            <Biohazard /> Plague
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-fg-subtle uppercase">
            Human impact
            <InfoTip title="Human impact" side="left">
              Humans as an environmental force, independent of the simulated human band: hunting, land
              clearing, farming and herding. Herding makes milk available, so lactase persistence (LCT)
              becomes advantageous — gene–culture coevolution.
            </InfoTip>
          </h3>
          <Switch
            aria-label="Enable human impact"
            checked={env.impact.enabled}
            onCheckedChange={(enabled) => env.setImpact({ enabled })}
          />
        </div>
        <div
          className={cn(
            "space-y-3 transition-opacity",
            !env.impact.enabled && "pointer-events-none opacity-40",
          )}
        >
          {IMPACT.map((s) => (
            <SliderRow
              key={s.key}
              id={`imp-${s.key}`}
              label={s.label}
              info={s.info}
              value={env.impact[s.key]}
              min={0}
              max={1}
              step={0.01}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => env.setImpact({ [s.key]: v } as Partial<HumanImpact>)}
            />
          ))}
          <ToggleRow
            id="imp-herding"
            label="Herding (milk)"
            info="Pastoralism. Lactase-persistent humans gain 25% more energy, so the LCT allele rises in frequency."
            checked={env.impact.herding}
            onChange={(herding) => env.setImpact({ herding })}
          />
        </div>
      </section>
    </div>
  );
}

function SliderRow(p: {
  id: string;
  label: string;
  info: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label id={p.id} className="flex items-center gap-1.5 text-sm text-fg">
          {p.label}
          <InfoTip title={p.label} side="left">
            {p.info}
          </InfoTip>
        </label>
        <span className="font-mono text-xs text-fg-muted tabular-nums">{p.format(p.value)}</span>
      </div>
      <Slider
        aria-labelledby={p.id}
        min={p.min}
        max={p.max}
        step={p.step}
        value={[p.value]}
        onValueChange={([v]) => p.onChange(v)}
      />
    </div>
  );
}

function ToggleRow(p: {
  id: string;
  label: string;
  info: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex h-11 items-center justify-between">
      <label htmlFor={p.id} className="flex items-center gap-1.5 text-sm text-fg">
        {p.label}
        <InfoTip title={p.label} side="left">
          {p.info}
        </InfoTip>
      </label>
      <Switch id={p.id} checked={p.checked} onCheckedChange={p.onChange} />
    </div>
  );
}
