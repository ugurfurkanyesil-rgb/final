/**
 * Terrain Generator - 100×100m Moon terrain
 * Smooth base with realistic crater geometry, rim walls, and space debris.
 */

import * as THREE from 'three';

export const TERRAIN_SIZE = 100;
export const GRID_RES = 256; // higher resolution = sharper craters

// Canonical crater list
export const CRATERS = [
  { x:  15, z: -10, radius: 9,  depth: 3.8, rimH: 1.4, rimW: 0.28 },
  { x: -20, z:  18, radius: 6,  depth: 2.4, rimH: 0.85, rimW: 0.30 },
  { x:  35, z:  32, radius: 14, depth: 5.2, rimH: 1.9, rimW: 0.25 },
  { x: -38, z: -28, radius: 11, depth: 4.1, rimH: 1.5, rimW: 0.27 },
  { x:   5, z:  38, radius: 5,  depth: 1.8, rimH: 0.65, rimW: 0.32 },
  { x: -12, z: -38, radius: 7,  depth: 2.7, rimH: 0.95, rimW: 0.28 },
  { x:  42, z: -18, radius: 17, depth: 6.2, rimH: 2.2, rimW: 0.22 },
  { x: -42, z:  30, radius: 9,  depth: 3.1, rimH: 1.1, rimW: 0.29 },
  { x:  22, z: -36, radius: 5,  depth: 1.7, rimH: 0.60, rimW: 0.31 },
  { x: -28, z:   8, radius: 4,  depth: 1.3, rimH: 0.50, rimW: 0.33 },
  { x:   0, z:   0, radius: 11, depth: 3.5, rimH: 1.3, rimW: 0.26 },
  { x: -18, z:  42, radius: 8,  depth: 2.8, rimH: 1.0, rimW: 0.28 },
  { x:  30, z:  10, radius: 3.5, depth: 1.0, rimH: 0.38, rimW: 0.35 },
  { x: -8,  z: -18, radius: 3,  depth: 0.9, rimH: 0.35, rimW: 0.36 },
  { x:  40, z:  46, radius: 7,  depth: 2.3, rimH: 0.85, rimW: 0.29 },
  { x: -44, z: -10, radius: 5.5, depth: 1.8, rimH: 0.70, rimW: 0.30 },
  { x:  10, z:  22, radius: 4,  depth: 1.2, rimH: 0.45, rimW: 0.34 },
  { x: -30, z: -44, radius: 12, depth: 4.3, rimH: 1.55, rimW: 0.25 },
  { x:  46, z:  -4, radius: 3,  depth: 0.8, rimH: 0.30, rimW: 0.36 },
  { x:  -6, z:  46, radius: 6.5, depth: 2.1, rimH: 0.78, rimW: 0.29 },
  { x:  25, z: -48, radius: 4,  depth: 1.1, rimH: 0.42, rimW: 0.33 },
  { x: -46, z:  46, radius: 6,  depth: 1.9, rimH: 0.72, rimW: 0.30 },
  { x:  -2, z: -26, radius: 3,  depth: 0.85, rimH: 0.32, rimW: 0.36 },
  { x:  48, z:  30, radius: 4,  depth: 1.2, rimH: 0.46, rimW: 0.33 },
];

/**
 * Smooth bowl + sharp rim crater profile.
 * Returns height contribution at world position (wx, wz) from a single crater.
 */
function craterProfile(wx, wz, c) {
  const dx = wx - c.x;
  const dz = wz - c.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  const t = d / c.radius;

  if (t > 2.5) return 0;

  let h = 0;
  if (t <= 1.0) {
    // Bowl: smooth cubic concave depression
    const bowl = (2 * t * t * t - 3 * t * t + 1); // 1 at center, 0 at rim
    h -= bowl * c.depth;

    // Flat floor at center (t < 0.25)
    if (t < 0.25) {
      h += (0.25 - t) / 0.25 * c.depth * 0.12; // slight floor flatness
    }
  }

  // Rim: sharp Gaussian ring
  const rimCenter = 1.0 + c.rimW * 0.5;
  const rimDist = t - rimCenter;
  const rimSigma = c.rimW;
  const rim = Math.exp(-(rimDist * rimDist) / (2 * rimSigma * rimSigma)) * c.rimH;
  h += rim;

  // Outer ejecta blanket (slight elevation)
  if (t > 1.0 && t < 2.0) {
    const ejT = (t - 1.0) / 1.0;
    h += (1 - ejT) * c.rimH * 0.15 * Math.exp(-ejT * 3);
  }

  return h;
}

/** Height at world (wx, wz) */
export function getTerrainHeight(wx, wz) {
  let h = 0;
  for (const c of CRATERS) h += craterProfile(wx, wz, c);
  return h;
}

/** Three.js geometry */
export function generateTerrain() {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, GRID_RES - 1, GRID_RES - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, getTerrainHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  // Vertex colors for texture variation
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    // Darker in craters, lighter on rims and flat
    const base = 0.55 + y * 0.04;
    const noiseX = Math.sin(pos.getX(i) * 1.3) * 0.018;
    const noiseZ = Math.cos(pos.getZ(i) * 1.7) * 0.014;
    const v = Math.max(0.18, Math.min(0.78, base + noiseX + noiseZ));
    colors[i*3]   = v;
    colors[i*3+1] = v * 0.97;
    colors[i*3+2] = v * 0.94;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// ---- Map data builders ----

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

export function buildSlopeMap(hMap) {
  const slope = new Float32Array(GRID_RES * GRID_RES);
  const cellSize = TERRAIN_SIZE / (GRID_RES - 1);
  for (let row = 1; row < GRID_RES - 1; row++) {
    for (let col = 1; col < GRID_RES - 1; col++) {
      const dX = (hMap[row * GRID_RES + col + 1] - hMap[row * GRID_RES + col - 1]) / (2 * cellSize);
      const dZ = (hMap[(row+1)*GRID_RES+col] - hMap[(row-1)*GRID_RES+col]) / (2 * cellSize);
      slope[row * GRID_RES + col] = Math.sqrt(dX*dX + dZ*dZ);
    }
  }
  return slope;
}

/**
 * Crater danger mask - STRICT version.
 * Interior floor = 1.0, bowl walls = high, rim = medium.
 */
export function buildCraterMask() {
  const mask = new Float32Array(GRID_RES * GRID_RES);
  const half = TERRAIN_SIZE / 2;
  for (let row = 0; row < GRID_RES; row++) {
    for (let col = 0; col < GRID_RES; col++) {
      const wx = -half + (col / (GRID_RES - 1)) * TERRAIN_SIZE;
      const wz = -half + (row / (GRID_RES - 1)) * TERRAIN_SIZE;
      let val = 0;
      for (const c of CRATERS) {
        const d = Math.sqrt((wx - c.x)**2 + (wz - c.z)**2);
        const t = d / c.radius;
        // Inside bowl: full danger
        if (t < 1.0) {
          val = Math.max(val, 1.0 - t * 0.35);
        }
        // Rim zone: high danger due to slip risk
        else if (t < 1.0 + c.rimW * 2) {
          const rimT = (t - 1.0) / (c.rimW * 2);
          val = Math.max(val, (1 - rimT) * 0.7);
        }
        // Near rim: moderate
        else if (t < 1.8) {
          const nearT = (t - (1.0 + c.rimW*2)) / (1.8 - 1.0 - c.rimW*2);
          val = Math.max(val, (1 - nearT) * 0.35);
        }
      }
      mask[row * GRID_RES + col] = val;
    }
  }
  return mask;
}

// ---- Rock positions ----
export function generateRockPositions(count = 80) {
  const rocks = [];
  const half = TERRAIN_SIZE / 2 - 3;
  let attempts = 0;
  while (rocks.length < count && attempts < count * 15) {
    attempts++;
    const x = (Math.random() - 0.5) * 2 * half;
    const z = (Math.random() - 0.5) * 2 * half;
    const h = getTerrainHeight(x, z);
    // Place preferentially on crater rims and flat areas
    if (h > -0.2) {
      const scale = 0.08 + Math.random() * 0.45;
      rocks.push({ x, y: h, z, scale, rotY: Math.random() * Math.PI * 2, rotX: Math.random() * 0.4 });
    }
  }
  return rocks;
}

// ---- Space debris positions ----
// Types: 'panel' (solar panel), 'tank' (fuel cylinder), 'hull' (angular hull piece), 'strut'
const DEBRIS_TYPES = ['panel', 'panel', 'tank', 'hull', 'strut', 'panel', 'tank', 'hull', 'panel', 'strut'];
export function generateDebrisPositions() {
  const positions = [
    { x: -32, z:  14, rot: 0.4,   type: 'panel', scale: 0.9 },
    { x:  28, z: -42, rot: 1.2,   type: 'tank',  scale: 0.7 },
    { x: -14, z: -30, rot: 2.1,   type: 'hull',  scale: 1.1 },
    { x:  44, z:  20, rot: 0.8,   type: 'strut', scale: 0.6 },
    { x:  -4, z:  30, rot: 3.4,   type: 'panel', scale: 1.3 },
    { x:  18, z:  48, rot: 1.7,   type: 'tank',  scale: 0.85 },
    { x: -46, z:  -4, rot: 0.3,   type: 'hull',  scale: 0.75 },
    { x:  38, z: -44, rot: 2.8,   type: 'panel', scale: 1.05 },
    { x: -24, z:  46, rot: 1.1,   type: 'strut', scale: 0.55 },
    { x:   8, z: -44, rot: 0.6,   type: 'hull',  scale: 0.9 },
  ];
  return positions.map(d => ({
    ...d,
    y: getTerrainHeight(d.x, d.z),
  }));
}
