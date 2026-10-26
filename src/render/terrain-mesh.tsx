"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Rng } from "@/engine/rng/rng";
import { HALF, MAX_HEIGHT, Terrain, WORLD_SIZE, type TerrainKind } from "@/engine/world/terrain";
import { VEG_RES } from "@/engine/sim/vegetation";
import { sim } from "@/sim/client";
import { useWorld } from "@/sim/world-store";
import { useEnv } from "@/state/env-store";

const SEG = 150;
const c = (h: string) => new THREE.Color(h);
const SEABED = c("#1f3d44");
const SAND = c("#c9b98a");
const DRY = c("#a39456");
const LUSH = c("#3e6f2c");
const FOREST = c("#2f5a2a");
const ROCK = c("#6d6a66");
const SNOW = c("#eef3f6");
const BARE = c("#7a6a4a");

function vegAt(veg: Float32Array | null, x: number, z: number) {
  if (!veg) return 0.6;
  const i = Math.max(0, Math.min(VEG_RES - 1, Math.floor(((x + HALF) / WORLD_SIZE) * VEG_RES)));
  const j = Math.max(0, Math.min(VEG_RES - 1, Math.floor(((z + HALF) / WORLD_SIZE) * VEG_RES)));
  return veg[j * VEG_RES + i];
}

const col = new THREE.Color();

/** Vertex colours from height, vegetation, humidity and local temperature (snow line). */
function recolorTerrain(geometry: THREE.BufferGeometry, veg: Float32Array | null, temp: number, hum: number) {
  const p = geometry.attributes.position;
  const colors = geometry.attributes.color as THREE.BufferAttribute;
  const dryTint = DRY.clone().lerp(c("#c2a865"), Math.max(0, 0.5 - hum));
  for (let f = 0; f < p.count; f += 3) {
    const x = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3;
    const z = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3;
    const h = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
    const t = h / MAX_HEIGHT;
    if (h < -0.25) col.copy(SEABED);
    else if (h < 0.55) col.copy(SAND);
    else {
      const v = Math.max(0, vegAt(veg, x, z));
      const lush = Math.min(1, v * 1.7);
      col.copy(v < 0.05 ? BARE : dryTint).lerp(LUSH, lush);
      if (lush > 0.75) col.lerp(FOREST, (lush - 0.75) * 2);
      if (t > 0.45) col.lerp(ROCK, Math.min(1, (t - 0.45) / 0.15));
      const localT = temp - 0.28 * h;
      if (localT < 1) col.lerp(SNOW, Math.min(1, (1 - localT) / 5));
    }
    const j = 1 + (((f * 2654435761) >>> 0) / 4294967296 - 0.5) * 0.08;
    for (let k = 0; k < 3; k++) colors.setXYZ(f + k, col.r * j, col.g * j, col.b * j);
  }
  colors.needsUpdate = true;
}

export function TerrainMesh({ seed, kind }: { seed: number; kind: TerrainKind }) {
  const terrain = useMemo(() => new Terrain({ seed, kind }), [seed, kind]);
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEG, SEG);
    plane.rotateX(-Math.PI / 2);
    const pos = plane.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrain.heightAt(pos.getX(i), pos.getZ(i)));
    const g = plane.toNonIndexed();
    plane.dispose();
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    g.computeVertexNormals();
    return g;
  }, [terrain]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const last = useRef({ veg: -1, temp: 999, hum: -1 });

  useFrame(() => {
    const temp = useWorld.getState().temperature;
    const hum = useEnv.getState().humidity;
    const l = last.current;
    if (l.veg === sim.vegVersion && Math.abs(l.temp - temp) < 0.75 && Math.abs(l.hum - hum) < 0.05) return;
    last.current = { veg: sim.vegVersion, temp, hum };
    recolorTerrain(geometry, sim.vegetation, temp, hum);
  });

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
      </mesh>
      <Trees terrain={terrain} seed={seed} />
      <Water />
    </group>
  );
}

function Water() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = -0.05 + Math.sin(clock.elapsedTime * 0.6) * 0.05;
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} receiveShadow>
      <circleGeometry args={[420, 48]} />
      <meshStandardMaterial
        color="#1b6a78"
        transparent
        opacity={0.8}
        roughness={0.2}
        metalness={0.1}
        flatShading
      />
    </mesh>
  );
}

function Trees({ terrain, seed }: { terrain: Terrain; seed: number }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const placements = useMemo(() => {
    const rng = new Rng(seed + 1);
    const out: { x: number; y: number; z: number; s: number; r: number }[] = [];
    for (let tries = 0; tries < 5000 && out.length < 480; tries++) {
      const x = rng.range(-HALF + 4, HALF - 4);
      const z = rng.range(-HALF + 4, HALF - 4);
      const y = terrain.heightAt(x, z);
      const t = y / MAX_HEIGHT;
      if (y < 1 || t > 0.45 || !rng.chance(0.75 - t)) continue;
      out.push({ x, y, z, s: rng.range(0.7, 1.4), r: rng.range(0, Math.PI * 2) });
    }
    return out;
  }, [terrain, seed]);

  const last = useRef({ veg: -1, temp: 999 });
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      p: new THREE.Vector3(),
      c: new THREE.Color(),
    }),
    [],
  );
  useFrame(() => {
    const tr = trunks.current;
    const cr = crowns.current;
    if (!tr || !cr) return;
    const temp = useWorld.getState().temperature;
    if (last.current.veg === sim.vegVersion && Math.abs(last.current.temp - temp) < 1) return;
    last.current = { veg: sim.vegVersion, temp };
    const veg = sim.vegetation;
    placements.forEach((t, i) => {
      const v = Math.max(0, vegAt(veg, t.x, t.z));
      // Trees vanish where habitat is cleared or burned; thin out under drought.
      const k = v < 0.06 ? 0 : Math.min(1, 0.35 + v * 1.4);
      tmp.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, t.r);
      tmp.s.setScalar(t.s * k);
      tmp.p.set(t.x, t.y + 0.9 * t.s * k, t.z);
      tr.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
      tmp.p.set(t.x, t.y + 3.1 * t.s * k, t.z);
      cr.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
      const localT = temp - 0.28 * t.y;
      tmp.c.set("#2f5a2c").lerp(SNOW, Math.max(0, Math.min(0.8, (1 - localT) / 6)));
      cr.setColorAt(i, tmp.c);
    });
    tr.instanceMatrix.needsUpdate = true;
    cr.instanceMatrix.needsUpdate = true;
    if (cr.instanceColor) cr.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, placements.length]} castShadow>
        <cylinderGeometry args={[0.18, 0.28, 1.8, 5]} />
        <meshStandardMaterial color="#5a4330" flatShading roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, placements.length]} castShadow receiveShadow>
        <coneGeometry args={[1.4, 3.6, 6]} />
        <meshStandardMaterial color="#ffffff" flatShading roughness={0.9} />
      </instancedMesh>
    </>
  );
}
