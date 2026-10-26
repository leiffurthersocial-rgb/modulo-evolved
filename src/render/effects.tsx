"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sim } from "@/sim/client";
import { useWorld } from "@/sim/world-store";

const MAX = 48;

/** Small expanding puffs where animals die; a flash and shockwave for meteor strikes. */
export function Effects() {
  const puffs = useRef<THREE.InstancedMesh>(null);
  const flash = useRef<THREE.Mesh>(null);
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      p: new THREE.Vector3(),
    }),
    [],
  );
  const meteorAt = useRef<{ t: number; x: number; z: number; start: number } | null>(null);

  useFrame(() => {
    const now = performance.now();
    const m = puffs.current;
    if (m) {
      let n = 0;
      for (const d of sim.deaths) {
        const age = (now - d.at) / 900;
        if (age > 1 || n >= MAX) continue;
        tmp.p.set(d.x, d.y + 0.4 + age * 0.8, d.z);
        tmp.s.setScalar(0.3 + age * 1.2);
        m.setMatrixAt(n++, tmp.m.compose(tmp.p, tmp.q, tmp.s));
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    }
    const ev = useWorld.getState().events.find((e) => e.kind === "meteor");
    if (ev && ev.x !== undefined && (!meteorAt.current || meteorAt.current.start !== ev.start)) {
      meteorAt.current = { t: now, x: ev.x, z: ev.z!, start: ev.start };
    }
    const f = flash.current;
    if (f) {
      const mt = meteorAt.current;
      const age = mt ? (now - mt.t) / 2500 : 2;
      f.visible = age < 1;
      if (mt && age < 1) {
        f.position.set(mt.x, 2, mt.z);
        f.scale.setScalar(5 + age * 90);
        (f.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - age);
      }
    }
  });

  return (
    <>
      <instancedMesh ref={puffs} args={[undefined, undefined, MAX]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#e6edf3" transparent opacity={0.25} depthWrite={false} />
      </instancedMesh>
      <mesh ref={flash} visible={false}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </>
  );
}
