"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { SPECIES, SPECIES_IDS } from "@/engine/species/roster";
import { CreaturePreview } from "@/render/creatures/creature-preview";
import { defaultBody } from "@/render/creatures/default-body";
import type { SpeciesId } from "@/engine/species/types";

export default function Scene() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const flying = params?.get("fly") === "1";
  const only = params?.get("only")?.split(",");
  const cam = params?.get("cam")?.split(",").map(Number) as [number, number, number] | undefined;
  const solo = params?.get("solo") as SpeciesId | null | undefined;
  if (solo) return <Solo id={solo} sex={params?.get("sex") === "F" ? "F" : "M"} flying={flying} />;
  return (
    <Canvas shadows camera={{ position: cam ?? [0, 9, 15], fov: 40 }}>
      <color attach="background" args={["#0b1016"]} />
      <hemisphereLight args={["#bcd7ff", "#2b2a22", 1]} />
      <directionalLight position={[6, 12, 8]} intensity={2.2} castShadow />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#3e5a33" />
      </mesh>
      {SPECIES_IDS.filter((id) => !only || only.includes(id)).map((id, i) => (
        <CreaturePreview
          key={id}
          body={defaultBody(id, i % 2 ? "F" : "M")}
          lengthM={1}
          normalize
          flying={flying}
          heading={Math.PI / 4}
          position={[
            ((i % 6) - 2.5) * 2.6,
            SPECIES[id].parts.torso.kind === "fish" ? 0.4 : 0,
            (Math.floor(i / 6) - 1) * 3.2,
          ]}
        />
      ))}
      <OrbitControls target={[0, 0.5, 0]} />
    </Canvas>
  );
}

/** One species, centred and framed for close-up QA screenshots (?solo=deer&sex=F). */
function Solo({ id, sex, flying }: { id: SpeciesId; sex: "F" | "M"; flying: boolean }) {
  const fish = SPECIES[id].parts.torso.kind === "fish";
  return (
    <Canvas shadows camera={{ position: [2.7, 1.5, 2.1], fov: 35 }}>
      <color attach="background" args={["#1d2a33"]} />
      <hemisphereLight args={["#bcd7ff", "#2b2a22", 1.1]} />
      <directionalLight position={[4, 8, 5]} intensity={2.4} castShadow />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#3e5a33" />
      </mesh>
      <CreaturePreview
        body={defaultBody(id, sex)}
        lengthM={1}
        normalize
        flying={flying}
        heading={Math.PI / 2}
        position={[0, fish ? 0.45 : 0, 0]}
      />
      <OrbitControls target={[0, 0.55, 0]} />
    </Canvas>
  );
}
