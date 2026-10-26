"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "@/sim/world-store";

/** Gradient sky dome: deep slate overhead, teal haze at the horizon (tinted by season). */
export function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color("#070a0e") },
          horizon: { value: new THREE.Color("#16323a") },
          warm: { value: 0.5 },
        },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform float warm; varying vec3 vDir;
          void main(){ float h = clamp(vDir.y, -0.2, 1.0);
            vec3 hz = mix(horizon, vec3(0.24,0.22,0.18), warm * 0.35);
            vec3 c = mix(hz, top, smoothstep(-0.05, 0.55, h));
            gl_FragColor = vec4(c, 1.0); }`,
      }),
    [],
  );
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!mesh.current) return;
    const u = (mesh.current.material as THREE.ShaderMaterial).uniforms.warm;
    u.value += (useWorld.getState().seasonWarmth - u.value) * 0.05;
  });
  return (
    <mesh ref={mesh} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[900, 24, 12]} />
    </mesh>
  );
}
