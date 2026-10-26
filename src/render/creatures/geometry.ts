import * as THREE from "three";

export const GEO = { sphere: 0, cone: 1, cyl: 2, box: 3, blade: 4, taper: 5 } as const;
export type GeoId = (typeof GEO)[keyof typeof GEO];
export const GEO_COUNT = 6;

/**
 * Unit low-poly geometries. Cones/cylinders/blades have their base at y = 0 and extend to y = 1.
 * `taper` is a limb/muzzle/tail segment that narrows to half its base radius.
 */
export function createGeometries(): THREE.BufferGeometry[] {
  const sphere = new THREE.IcosahedronGeometry(1, 1);
  const cone = new THREE.ConeGeometry(1, 1, 6, 1);
  cone.translate(0, 0.5, 0);
  const cyl = new THREE.CylinderGeometry(0.85, 1, 1, 7, 1);
  cyl.translate(0, 0.5, 0);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const blade = createBlade();
  const taper = new THREE.CylinderGeometry(0.5, 1, 1, 7, 1);
  taper.translate(0, 0.5, 0);
  return [sphere, cone, cyl, box, blade, taper].map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.computeVertexNormals();
    return ng;
  });
}

/** A tapered, slightly thick flat shape: wings, fins, ears, tail fans. */
function createBlade() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(0.5, 0);
  shape.lineTo(0.32, 0.7);
  shape.lineTo(0, 1);
  shape.lineTo(-0.22, 0.75);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -0.03);
  return g;
}

/**
 * Flat-shaded standard material with per-instance colour, a secondary colour and a pattern:
 * 0..1 stripes (zebra, barred pike, banded crocodiles), >1 spots, <0 countershading (a pale
 * belly in the secondary colour, on ellipsoid parts).
 */
export function createCreatureMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0,
    flatShading: true,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 aColor2;
attribute float aPattern;
varying vec3 vLocal;
varying vec3 vColor2;
varying float vPattern;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vLocal = position;
vColor2 = aColor2;
vPattern = aPattern;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vLocal;
varying vec3 vColor2;
varying float vPattern;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
if (vPattern < -0.01) {
  float s = smoothstep(0.05, -0.45, vLocal.y);
  diffuseColor.rgb = mix(diffuseColor.rgb, vColor2, s * -vPattern);
} else if (vPattern > 1.0) {
  float n = sin(vLocal.x * 9.0 + 1.3) * sin(vLocal.y * 11.0) * sin(vLocal.z * 8.0 + 0.7);
  diffuseColor.rgb = mix(diffuseColor.rgb, vColor2, step(0.3, n) * min(1.0, vPattern - 1.0));
} else if (vPattern > 0.01) {
  float s = step(0.5, fract(dot(vLocal, vec3(0.25, 0.55, 1.0)) * 4.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, vColor2, s * vPattern);
}`,
      );
  };
  return mat;
}
