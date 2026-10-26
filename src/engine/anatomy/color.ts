/** Small colour helpers shared by engine (camouflage) and renderer. */
export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Scale perceived lightness: k > 0 lightens towards white, k < 0 darkens towards black. */
export function shade([r, g, b]: RGB, k: number): RGB {
  if (k >= 0) return [r + (1 - r) * k, g + (1 - g) * k, b + (1 - b) * k];
  const m = 1 + k;
  return [r * m, g * m, b * m];
}

export function colorDistance(a: RGB, b: RGB): number {
  // Approximate perceptual weighting (redmean-like).
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db) / 3;
}
