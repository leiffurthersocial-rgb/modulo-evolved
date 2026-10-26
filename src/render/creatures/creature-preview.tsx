"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { createCreatureMaterial, createGeometries, GEO_COUNT } from "./geometry";
import { buildRig, displayLength, type RigInput, type RigPart } from "./rig";

/**
 * A single procedurally assembled creature (for the labs and previews). It uses the same
 * rig, shader and animation rules as the world renderer, via small instanced meshes.
 */
export function CreaturePreview({
  body,
  lengthM,
  walking = false,
  flying = false,
  position = [0, 0, 0],
  heading = 0,
  normalize = false,
}: {
  body: RigInput;
  lengthM: number;
  walking?: boolean;
  flying?: boolean;
  position?: [number, number, number];
  heading?: number;
  /** Scale to unit torso length regardless of real size. */
  normalize?: boolean;
}) {
  const rig = useMemo(() => buildRig(body), [body]);
  const geos = useMemo(() => createGeometries(), []);
  const material = useMemo(() => createCreatureMaterial(), []);
  const byGeo = useMemo(() => {
    const out: RigPart[][] = Array.from({ length: GEO_COUNT }, () => []);
    rig.forEach((p) => out[p.geo].push(p));
    return out;
  }, [rig]);
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const anim = useRef(0);
  const tmp = useMemo(() => ({ rot: new THREE.Matrix4(), m: new THREE.Matrix4() }), []);
  const scale = normalize ? 1 : displayLength(lengthM);

  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose());
      material.dispose();
    },
    [geos, material],
  );

  useLayoutEffect(() => {
    byGeo.forEach((parts, gi) => {
      const m = meshes.current[gi];
      if (!m || !parts.length) return;
      const n = parts.length;
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      const c2 = new Float32Array(n * 3);
      const pat = new Float32Array(n);
      parts.forEach((p, i) => {
        m.instanceColor!.setXYZ(i, ...p.color);
        c2.set(p.color2, i * 3);
        pat[i] = p.pattern;
        m.setMatrixAt(i, p.local);
      });
      m.geometry.setAttribute("aColor2", new THREE.InstancedBufferAttribute(c2, 3));
      m.geometry.setAttribute("aPattern", new THREE.InstancedBufferAttribute(pat, 1));
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    });
  }, [byGeo]);

  useFrame(({ clock }, dt) => {
    if (walking) anim.current += dt * 6;
    const t = clock.elapsedTime;
    const ph = anim.current;
    const g = walking ? 1 : 0;
    byGeo.forEach((parts, gi) => {
      const m = meshes.current[gi];
      if (!m || !parts.length) return;
      parts.forEach((p, i) => {
        const isWing = p.anim === "wingL" || p.anim === "wingR";
        const pre = p.preAlt ? ((isWing ? !flying : flying) ? p.preAlt : p.pre) : p.pre;
        let ang = 0;
        switch (p.anim) {
          case "legA":
          case "armA":
            ang = Math.sin(ph) * p.amp * g;
            break;
          case "legB":
          case "armB":
            ang = Math.sin(ph + Math.PI) * p.amp * g;
            break;
          case "hop":
            ang = -Math.max(0, Math.sin(ph)) * p.amp * g;
            break;
          case "wingL":
            ang = flying ? Math.sin(t * 8) * p.amp : 0;
            break;
          case "wingR":
            ang = flying ? -Math.sin(t * 8) * p.amp : 0;
            break;
          case "tail":
            ang = Math.sin(t * 2.2 + p.phase) * p.amp * 0.5;
            break;
          case "fishTail":
            ang = Math.sin(t * 3) * p.amp * 0.6;
            break;
          case "trunk":
            ang = Math.sin(t * 1.2 + p.phase) * p.amp;
            break;
          case "earFlap":
            ang = Math.sin(t * 0.9 + p.phase) * p.amp;
            break;
          case "fin":
            ang = Math.sin(t * 3 + p.phase) * p.amp;
            break;
        }
        if (p.axis === 0) tmp.rot.makeRotationX(ang);
        else if (p.axis === 1) tmp.rot.makeRotationY(ang);
        else tmp.rot.makeRotationZ(ang);
        tmp.m.multiplyMatrices(pre, tmp.rot).multiply(p.post);
        m.setMatrixAt(i, tmp.m);
      });
      m.instanceMatrix.needsUpdate = true;
    });
  });

  return (
    <group position={position} rotation-y={heading} scale={scale}>
      {byGeo.map((parts, gi) =>
        parts.length ? (
          <instancedMesh
            key={`${gi}-${parts.length}`}
            ref={(m) => {
              meshes.current[gi] = m;
            }}
            args={[geos[gi], material, parts.length]}
            castShadow
            frustumCulled={false}
          />
        ) : null,
      )}
    </group>
  );
}
