import type { EnvSettings, WorldEvent } from "./types";

const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

export function dayOfYear(day: number) {
  return ((day % 365) + 365) % 365;
}

/** 0 at the coldest point of winter, 1 at the height of summer. */
export function seasonWarmth(day: number) {
  return 0.5 + 0.5 * Math.sin((2 * Math.PI * (dayOfYear(day) - 110)) / 365);
}

export function seasonName(day: number): "Spring" | "Summer" | "Autumn" | "Winter" {
  const d = dayOfYear(day);
  if (d < 80 || d >= 355) return "Winter";
  if (d < 172) return "Spring";
  if (d < 266) return "Summer";
  return "Autumn";
}

/** Temperature offset (°C) from ongoing catastrophes. */
export function eventTempOffset(events: readonly WorldEvent[], day: number) {
  let off = 0;
  for (const e of events) {
    if (day < e.start || day > e.end) continue;
    const len = e.end - e.start;
    if (e.kind === "iceAge") {
      const ramp = Math.min(smooth((day - e.start) / 120), smooth((e.end - day) / 120));
      off -= 13 * ramp * (len > 0 ? 1 : 0);
    } else if (e.kind === "meteor") {
      // Impact winter: dust and soot block sunlight, decaying over about a year.
      off -= 9 * Math.exp(-(day - e.start) / 120);
    } else if (e.kind === "drought") {
      off += 2;
    }
  }
  return off;
}

/** Ambient temperature (°C) at a day and terrain height (lapse rate ≈ 6.5 °C/km). */
export function temperatureAt(env: EnvSettings, events: readonly WorldEvent[], day: number, height = 0) {
  const seasonal = env.seasonality * 12 * (seasonWarmth(day) * 2 - 1);
  return env.temperature + seasonal + eventTempOffset(events, day) - 0.28 * Math.max(0, height);
}

/** Multiplier on plant/plankton growth from catastrophes. */
export function eventProductivity(events: readonly WorldEvent[], day: number) {
  let k = 1;
  for (const e of events) {
    if (day < e.start || day > e.end) continue;
    if (e.kind === "drought") k *= 0.15;
    if (e.kind === "meteor") k *= 0.25 + 0.75 * (1 - Math.exp(-(day - e.start) / 150));
  }
  return k;
}

export function effectiveHumidity(env: EnvSettings, events: readonly WorldEvent[], day: number) {
  let h = env.humidity;
  for (const e of events) if (e.kind === "drought" && day >= e.start && day <= e.end) h *= 0.25;
  return h;
}
