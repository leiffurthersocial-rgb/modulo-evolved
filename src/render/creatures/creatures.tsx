"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sim } from "@/sim/client";
import { F, FLAG, STRIDE, type BodyDesc } from "@/sim/protocol";
import { useWorld } from "@/sim/world-store";
import { createCreatureMaterial, createGeometries, GEO_COUNT } from "./geometry";
import { buildRig, displayLength, type Anim, type RigPart } from "./rig";
import { renderAgents } from "./render-state";
import { defaultBody } from "./default-body";
import { SPECIES_IDS } from "@/engine/species/roster";

interface Slotted {
  rig: RigPart[];
  slots: Int32Array;
  size: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  anim: number;
  gait: number;
  flap: number;
  seen: number;
}

/**
 * Instance slots per agent for each geometry: the most any species' rig uses, plus headroom for
 * chimeras (which can combine parts from several species).
 */
const CAP_PER_AGENT = (() => {
  const max = new Array<number>(GEO_COUNT).fill(0);
  for (const id of SPECIES_IDS)
    for (const sex of ["F", "M"] as const) {
      const n = new Array<number>(GEO_COUNT).fill(0);
      for (const p of buildRig({ ...defaultBody(id, sex), ornament: 1 })) n[p.geo]++;
      n.forEach((v, g) => (max[g] = Math.max(max[g], v)));
    }
  return max.map((m) => m + 3);
})();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/** Per-part joint angle for the current gait/idle animation. */
function angleFor(p: RigPart, a: Slotted, time: number, flying: boolean): number {
  const ph = a.anim;
  const g = a.gait;
  switch (p.anim as Anim) {
    case "legA":
      return Math.sin(ph) * p.amp * g;
    case "legB":
      return Math.sin(ph + Math.PI) * p.amp * g;
    case "armA":
      return Math.sin(ph) * p.amp * g;
    case "armB":
      return Math.sin(ph + Math.PI) * p.amp * g;
    case "hop":
      return -Math.max(0, Math.sin(ph)) * p.amp * g;
    case "wingL":
      return flying ? Math.sin(time * a.flap) * p.amp : 0;
    case "wingR":
      return flying ? -Math.sin(time * a.flap) * p.amp : 0;
    case "tail":
      return Math.sin(time * 2.2 + p.phase + a.x) * p.amp * 0.5 + Math.sin(ph) * p.amp * 0.3 * g;
    case "fishTail":
      return Math.sin(ph * 1.6 + time * 2.5) * p.amp * (0.4 + 0.6 * g);
    case "trunk":
      return Math.sin(time * 1.2 + p.phase + a.z) * p.amp;
    case "earFlap":
      return Math.sin(time * 0.9 + p.phase + a.x) * p.amp;
    case "fin":
      return Math.sin(time * 3 + p.phase) * p.amp;
    default:
      return 0;
  }
}

export function Creatures({ maxAgents, selectedId }: { maxAgents: number; selectedId: number | null }) {
  const geos = useMemo(() => createGeometries(), []);
  const material = useMemo(() => createCreatureMaterial(), []);
  const capacity = useMemo(() => CAP_PER_AGENT.map((k) => Math.ceil(k * maxAgents * 1.15)), [maxAgents]);
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const state = useRef({
    agents: new Map<number, Slotted>(),
    free: CAP_PER_AGENT.map(() => [] as number[]),
    high: CAP_PER_AGENT.map(() => 0),
    epoch: -1,
    stamp: 0,
  });
  const epoch = useWorld((s) => s.epoch);

  // Extra per-instance attributes for the pattern shader.
  useEffect(() => {
    meshes.current.forEach((m, gi) => {
      if (!m) return;
      const n = capacity[gi];
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      m.geometry.setAttribute("aColor2", new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
      m.geometry.setAttribute("aPattern", new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
      m.count = 0;
    });
  }, [capacity]);

  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose());
      material.dispose();
    },
    [geos, material],
  );

  const m4 = useMemo(
    () => ({
      root: new THREE.Matrix4(),
      rot: new THREE.Matrix4(),
      tmp: new THREE.Matrix4(),
      out: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      v: new THREE.Vector3(),
      s: new THREE.Vector3(),
      e: new THREE.Euler(),
    }),
    [],
  );

  useFrame(({ camera, clock }, delta) => {
    const st = state.current;
    const ms = meshes.current;
    if (ms.some((m) => !m)) return;
    const dt = Math.min(0.1, delta);

    if (st.epoch !== epoch) {
      // New world: release everything.
      for (const [id, a] of st.agents) release(id, a);
      st.agents.clear();
      renderAgents.clear();
      st.free = CAP_PER_AGENT.map(() => []);
      st.high = CAP_PER_AGENT.map(() => 0);
      ms.forEach((m) => (m!.count = 0));
      st.epoch = epoch;
    }

    const { buf, count } = sim.frame;
    const stamp = ++st.stamp;
    const dirty = new Uint8Array(GEO_COUNT);

    function allocate(body: BodyDesc): Slotted | null {
      const rig = buildRig(body);
      const slots = new Int32Array(rig.length);
      for (let i = 0; i < rig.length; i++) {
        const g = rig[i].geo;
        let slot = st.free[g].pop();
        if (slot === undefined) {
          if (st.high[g] >= capacity[g]) {
            for (let j = 0; j < i; j++) st.free[rig[j].geo].push(slots[j]);
            return null;
          }
          slot = st.high[g]++;
        }
        slots[i] = slot;
        const m = ms[g]!;
        const p = rig[i];
        m.instanceColor!.setXYZ(slot, p.color[0], p.color[1], p.color[2]);
        (m.geometry.getAttribute("aColor2") as THREE.BufferAttribute).setXYZ(
          slot,
          p.color2[0],
          p.color2[1],
          p.color2[2],
        );
        (m.geometry.getAttribute("aPattern") as THREE.BufferAttribute).setX(slot, p.pattern);
        dirty[g] = 1;
      }
      const size = displayLength(body.lengthM);
      return {
        rig,
        slots,
        size,
        x: 0,
        y: 0,
        z: 0,
        heading: 0,
        anim: 0,
        gait: 0,
        flap: 9 / Math.sqrt(size),
        seen: 0,
      };
    }

    function release(id: number, a: Slotted) {
      for (let i = 0; i < a.rig.length; i++) {
        const g = a.rig[i].geo;
        ms[g]!.setMatrixAt(a.slots[i], ZERO);
        st.free[g].push(a.slots[i]);
      }
      renderAgents.delete(id);
    }

    const time = clock.elapsedTime;
    const k = 1 - Math.exp(-dt * 14);
    const camPos = camera.position;

    for (let i = 0; i < count; i++) {
      const o = i * STRIDE;
      const id = buf[o + F.id];
      let a = st.agents.get(id);
      if (!a) {
        const body = sim.bodies.get(id);
        if (!body) continue;
        const created = allocate(body);
        if (!created) continue;
        a = created;
        a.x = buf[o + F.x];
        a.y = buf[o + F.y];
        a.z = buf[o + F.z];
        a.heading = buf[o + F.heading];
        a.anim = buf[o + F.anim];
        st.agents.set(id, a);
      }
      a.seen = stamp;
      const tx = buf[o + F.x];
      const ty = buf[o + F.y];
      const tz = buf[o + F.z];
      const jump = Math.abs(tx - a.x) + Math.abs(tz - a.z) > 12;
      a.x = jump ? tx : a.x + (tx - a.x) * k;
      a.y = jump ? ty : a.y + (ty - a.y) * k;
      a.z = jump ? tz : a.z + (tz - a.z) * k;
      let dh = buf[o + F.heading] - a.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      a.heading += dh * k;
      const targetAnim = buf[o + F.anim];
      const dAnim = targetAnim - a.anim;
      a.anim = Math.abs(dAnim) > 20 ? targetAnim : a.anim + dAnim * k;
      a.gait += (Math.min(1, Math.abs(dAnim) * 3) - a.gait) * k;
      const flags = buf[o + F.flags];
      const flying = (flags & FLAG.flying) !== 0;
      const swimming = (flags & FLAG.swimming) !== 0;
      const scale = a.size * buf[o + F.scale];

      let ra = renderAgents.get(id);
      if (!ra) renderAgents.set(id, (ra = { x: 0, y: 0, z: 0, heading: 0, size: scale }));
      ra.x = a.x;
      ra.y = a.y;
      ra.z = a.z;
      ra.heading = a.heading;
      ra.size = scale;

      const dx = a.x - camPos.x;
      const dy = a.y - camPos.y;
      const dz = a.z - camPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / Math.max(0.4, scale);
      const lod = dist < 45 ? 2 : dist < 130 ? 1 : 0;

      m4.q.setFromEuler(m4.e.set(0, a.heading, 0));
      m4.v.set(a.x, a.y - (swimming ? scale * 0.35 : 0), a.z);
      m4.s.setScalar(scale);
      m4.root.compose(m4.v, m4.q, m4.s);

      for (let p = 0; p < a.rig.length; p++) {
        const part = a.rig[p];
        const mesh = ms[part.geo]!;
        if (part.lod > lod) {
          mesh.setMatrixAt(a.slots[p], ZERO);
          continue;
        }
        const isWing = part.anim === "wingL" || part.anim === "wingR";
        const pre = part.preAlt ? ((isWing ? !flying : flying) ? part.preAlt : part.pre) : part.pre;
        if (part.anim === "none" && pre === part.pre) {
          m4.out.multiplyMatrices(m4.root, part.local);
        } else {
          const ang = angleFor(part, a, time, flying);
          if (part.axis === 0) m4.rot.makeRotationX(ang);
          else if (part.axis === 1) m4.rot.makeRotationY(ang);
          else m4.rot.makeRotationZ(ang);
          m4.tmp.multiplyMatrices(pre, m4.rot).multiply(part.post);
          m4.out.multiplyMatrices(m4.root, m4.tmp);
        }
        mesh.setMatrixAt(a.slots[p], m4.out);
      }
    }

    for (const [id, a] of st.agents) {
      if (a.seen !== stamp) {
        release(id, a);
        st.agents.delete(id);
      }
    }

    ms.forEach((m, gi) => {
      m!.count = st.high[gi];
      m!.instanceMatrix.needsUpdate = true;
      if (dirty[gi]) {
        m!.instanceColor!.needsUpdate = true;
        m!.geometry.getAttribute("aColor2").needsUpdate = true;
        m!.geometry.getAttribute("aPattern").needsUpdate = true;
      }
    });
  });

  return (
    <group>
      {geos.map((g, i) => (
        <instancedMesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          args={[g, material, capacity[i]]}
          frustumCulled={false}
          castShadow
          receiveShadow={i === 0}
        />
      ))}
      <SelectionRing selectedId={selectedId} />
    </group>
  );
}

function SelectionRing({ selectedId }: { selectedId: number | null }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const a = selectedId !== null ? renderAgents.get(selectedId) : undefined;
    m.visible = !!a;
    if (!a) return;
    m.position.set(a.x, a.y + 0.05, a.z);
    const s = Math.max(0.6, a.size * 0.8) * (1 + 0.06 * Math.sin(clock.elapsedTime * 4));
    m.scale.set(s, s, s);
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} renderOrder={10}>
      <ringGeometry args={[0.85, 1, 40]} />
      <meshBasicMaterial color="#2dd4bf" transparent opacity={0.9} depthTest={false} />
    </mesh>
  );
}
