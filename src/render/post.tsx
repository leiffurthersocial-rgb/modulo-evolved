"use client";

import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";

/** Subtle post-processing for capable devices only (bloom on highlights, gentle vignette). */
export default function Post() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={0.35} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
      <Vignette eskil={false} offset={0.25} darkness={0.55} />
    </EffectComposer>
  );
}
