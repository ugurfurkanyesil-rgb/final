/**
 * Terrain Generator - 100x100m Moon terrain
 * Smooth base surface with realistic crater depressions.
 * No rocky noise - pure crater geometry only.
 */

import * as THREE from 'three';

export const TERRAIN_SIZE = 100;
export const GRID_RES = 200; // cells per side = 0.5m resolution

// Canonical crater list for 100x100m terrain
export const CRATERS = [
  { x:  15, z: -10, radius: 9,  depth: 3.2, rimH: 1.1 },
  { x: -20, z:  18, radius: 6,  depth: 2.1, rimH: 0.7 },
  { x:  35, z:  32, radius: 14, depth: 4.8, rimH: 1.6 },
  { x: -38, z: -28, radius: 11, depth: 3.8, rimH: 1.3 },
  { x:   5, z:  38, radius: 5,  depth: 1.6, rimH: 0.5 },
  { x: -12, z: -38, radius: 7,  depth: 2.4, rimH: 0.8 },
  { x:  42, z: -18, radius: 16, depth: 5.5, rimH: 1.8 },
  { x: -42, z:  30, radius: 8,  depth: 2.8, rimH: 0.9 },
  { x:  22, z: -36, radius: 5,  depth: 1.5, rimH: 0.5 },
  { x: -28, z:   8, radius: 4,  depth: 1.2, rimH: 0.4 },
  { x:   0, z:   0, radius: 10, depth: 3.0, rimH: 1.0 },
  { x: -18, z:  42, radius: 8,  depth: 2.6, rimH: 0.9 },
  { x:  30, z:  10, radius: 3,  depth: 0.8, rimH: 0.3 },
  { x: -8,  z: -18, radius: 3,  depth: 0.9, rimH: 0.3 },
  { x:  40, z:  46, radius: 7,  depth: 2.2, rimH: 0.7 },
  { x: -44, z: -10, radius: 5,  depth: 1.7, rimH: 0.6 },
  { x:  10, z:  22, radius: 4,  depth: 1.1, rimH: 0.4 },
  { x: -30, z: -44, radius: 12, depth: 4.0, rimH: 1.4 },
  { x:  46, z:  -4, radius: 3,  depth: 0.7, rimH: 0.2 },
  { x:  -6, z:  46, radius: 6,  depth: 2.0, rimH: 0.7 },
];

/** Compute height at world (x,z) - purely crater-based, smooth base */
export function getTerrainHeight(wx, wz) {
  let h = 0;
  for (const c of CRATERS) {
    const dx = wx - c.x;
    const dz = wz - c.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const t = d / c.radius;
    if (t < 2.2) {
      if (t < 1.0) {
        // Bowl: smooth cubic concave shape
        const bowl = (2 * t * t * t - 3 * t * t + 1) * (-c.depth);
        h += bowl;
      } else {
        // Rim ring
        const rimT = (t - 1.0) / 0.35;
        const rim = Math.exp(-rimT * rimT * 1.5) * c.rimH;
        h += rim;
      }
    }
  }
  return h;
}

/** Generate Three.js terrain geometry */
export function generateTerrain() {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, GRID_RES - 1, GRID_RES - 1);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, getTerrainHeight(x, z));
  }
  geo.computeVertexNormals();
  return geo;
}

/** Precompute a flat height map array [GRID_RES x GRID_RES] */
export function buildHeightMap() {
  const map = new Float32Array(GRID_RES * GRID_RES);
  const half = TERRAIN_SIZE / 2;
  for (let row = 0; row < GRID_RES; row++) {
    for (let col = 0; col < GRID_RES; col++) {
      const wx = -half + (col / (GRID_RES - 1)) * TERRAIN_SIZE;
      const wz = -half + (row / (GRID_RES - 1)) * TERRAIN_SIZE;
      map[row * GRID_RES + col] = getTerrainHeight(wx, wz);
    }
  }
  return map;
}

/** Precompute crater "danger" map — used for path planning */
export function buildCraterMask(inflate = 1.0) {
  const mask = new Float32Array(GRID_RES * GRID_RES);
  const half = TERRAIN_SIZE / 2;
  for (let row = 0; row < GRID_RES; row++) {
    for (let col = 0; col < GRID_RES; col++) {
      const wx = -half + (col / (GRID_RES - 1)) * TERRAIN_SIZE;
      const wz = -half + (row / (GRID_RES - 1)) * TERRAIN_SIZE;
      let val = 0;
      for (const c of CRATERS) {
        const d = Math.sqrt((wx - c.x) ** 2 + (wz - c.z) ** 2);
        const t = d / (c.radius * inflate);
        if (t < 1.5) {
          val = Math.max(val, Math.max(0, 1.0 - t / 1.5));
        }
      }
      mask[row * GRID_RES + col] = val;
    }
  }
  return mask;
}

/** Compute slope magnitude map from height map */
export function buildSlopeMap(hMap) {
  const slope = new Float32Array(GRID_RES * GRID_RES);
  const cellSize = TERRAIN_SIZE / (GRID_RES - 1);
  for (let row = 1; row < GRID_RES - 1; row++) {
    for (let col = 1; col < GRID_RES - 1; col++) {
      const dX = (hMap[row * GRID_RES + col + 1] - hMap[row * GRID_RES + col - 1]) / (2 * cellSize);
      const dZ = (hMap[(row + 1) * GRID_RES + col] - hMap[(row - 1) * GRID_RES + col]) / (2 * cellSize);
      slope[row * GRID_RES + col] = Math.sqrt(dX * dX + dZ * dZ);
    }
  }
  return slope;
}

/** Generate rock scatter positions (small rocks, not on crater floors) */
export function generateRockPositions(count = 60) {
  const rocks = [];
  const half = TERRAIN_SIZE / 2 - 3;
  let attempts = 0;
  while (rocks.length < count && attempts < count * 10) {
    attempts++;
    const x = (Math.random() - 0.5) * 2 * half;
    const z = (Math.random() - 0.5) * 2 * half;
    // Only place on crater rims or flat areas, avoid deep bowls
    const h = getTerrainHeight(x, z);
    if (h > -0.5) {
      const scale = 0.12 + Math.random() * 0.5;
      rocks.push({ x, y: h, z, scale, rotY: Math.random() * Math.PI * 2 });
    }
  }
  return rocks;
}
