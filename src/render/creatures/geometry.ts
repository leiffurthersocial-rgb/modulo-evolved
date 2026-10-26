import * as THREE from "three";

export const GEO = { sphere: 0, cone: 1, cyl: 2, box: 3, blade: 4 } as const;
export type GeoId = (typeof GEO)[keyof typeof GEO];
export const GEO_COUNT = 5;

/** Unit low-poly geometries. Cones/cylinders/blades have their base at y = 0 and extend to y = 1. */
export function createGeometries(): THREE.BufferGeometry[] {
  const sphere = new THREE.IcosahedronGeometry(1, 1);
  const cone = new THREE.ConeGeometry(1, 1, 6, 1);
  cone.translate(0, 0.5, 0);
  const cyl = new THREE.CylinderGeometry(0.85, 1, 1, 6, 1);
  cyl.translate(0, 0.5, 0);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const blade = createBlade();
  return [sphere, cone, cyl, box, blade].map((g) => {
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
 * Flat-shaded standard material with per-instance colour, a secondary colour and a stripe
 * pattern strength (zebra stripes, barred pike, banded crocodiles).
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
if (vPattern > 0.01) {
  float s = step(0.5, fract(dot(vLocal, vec3(0.25, 0.55, 1.0)) * 4.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, vColor2, s * vPattern);
}`,
      );
  };
  return mat;
}
