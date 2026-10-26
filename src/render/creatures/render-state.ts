/** Smoothed per-agent render positions, shared between the creature renderer and picking. */
export interface RenderAgent {
  x: number;
  y: number;
  z: number;
  heading: number;
  size: number;
}

export const renderAgents = new Map<number, RenderAgent>();
