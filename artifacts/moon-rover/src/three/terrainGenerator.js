/**
 * Terrain Generator
 * Procedurally generates a Moon-like terrain using simplex-noise-style
 * displacement via a custom height function. Creates craters, ridges,
 * and a dusty gray surface feel.
 */

import * as THREE from 'three';

// Simple pseudo-random noise using sine waves (no external deps)
function hash(n) {
  return Math.sin(n * 127.1 + 311.7) * 43758.5453123 % 1;
}

function smoothNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  // Smooth step
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash(ix + iy * 57);
  const b = hash(ix + 1 + iy * 57);
  const c = hash(ix + (iy + 1) * 57);
  const d = hash(ix + 1 + (iy + 1) * 57);

  return a + (b - a) * ux + (c - a) * uy + (d - a + b - c - b + a) * ux * uy;
}

// Fractal brownian motion — layered noise for terrain variation
function fbm(x, y, octaves = 6) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1.0;
  let maxVal = 0;

  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * frequency, y * frequency) * amplitude;
    maxVal += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return value / maxVal;
}

// Generate a crater dip at a given world position
function craterHeight(wx, wz, craterList) {
  let totalDip = 0;
  for (const crater of craterList) {
    const dx = wx - crater.x;
    const dz = wz - crater.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const r = crater.radius;
    if (dist < r * 1.5) {
      // Bowl shape inside crater
      const t = dist / r;
      if (t < 1.0) {
        // Inside crater: concave bowl
        const bowl = (t * t - 1.0) * crater.depth;
        // Rim ring just outside bowl center
        const rim = Math.exp(-((t - 1.0) * (t - 1.0)) / 0.05) * crater.depth * 0.4;
        totalDip += bowl + rim;
      } else {
        // Outside rim: ejecta fade
        const ejecta = Math.exp(-((t - 1.0) * (t - 1.0)) / 0.2) * crater.depth * 0.2;
        totalDip += ejecta;
      }
    }
  }
  return totalDip;
}

/**
 * Generate terrain geometry for the Moon surface.
 * @param {number} size - World size (e.g. 200)
 * @param {number} segments - Number of grid subdivisions
 * @returns {THREE.BufferGeometry}
 */
export function generateTerrain(size = 200, segments = 128) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2); // Lay flat

  const pos = geometry.attributes.position;
  const count = pos.count;

  // Pre-define craters scattered across terrain
  const craters = [
    { x: 20, z: -15, radius: 12, depth: 3.5 },
    { x: -40, z: 30, radius: 8, depth: 2.5 },
    { x: 60, z: 60, radius: 18, depth: 5.0 },
    { x: -70, z: -50, radius: 15, depth: 4.0 },
    { x: 10, z: 70, radius: 6, depth: 1.8 },
    { x: -20, z: -70, radius: 9, depth: 2.8 },
    { x: 80, z: -30, radius: 20, depth: 6.0 },
    { x: -80, z: 60, radius: 10, depth: 3.0 },
    { x: 35, z: -55, radius: 7, depth: 2.0 },
    { x: -55, z: 15, radius: 5, depth: 1.5 },
    { x: 0, z: 0, radius: 14, depth: 3.8 },
    { x: -30, z: 80, radius: 11, depth: 3.2 },
  ];

  for (let i = 0; i < count; i++) {
    const wx = pos.getX(i);
    const wz = pos.getZ(i);

    // Base terrain from fbm noise
    const nx = wx / size * 4;
    const nz = wz / size * 4;
    const baseHeight = fbm(nx, nz, 7) * 8 - 4; // -4 to +4 range

    // Add crater depressions
    const craterDip = craterHeight(wx, wz, craters);

    pos.setY(i, baseHeight + craterDip);
  }

  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Generate vertex colors for the terrain based on height.
 * Simulates a dusty gray Moon surface with slight variation.
 * @param {THREE.BufferGeometry} geometry
 */
export function addTerrainColors(geometry) {
  const pos = geometry.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    // Moon surface: grayscale with slight variation based on height
    const base = 0.45 + y * 0.015; // Brighter at peaks
    const noise = (smoothNoise(pos.getX(i) * 0.3, pos.getZ(i) * 0.3) - 0.5) * 0.06;
    const gray = Math.max(0.2, Math.min(0.8, base + noise));

    colors[i * 3] = gray;
    colors[i * 3 + 1] = gray * 0.98; // Slight warm tint
    colors[i * 3 + 2] = gray * 0.95;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/**
 * Get terrain height at a given world (x, z) position.
 * Used for rover placement on terrain.
 * @param {number} x
 * @param {number} z
 * @param {number} size
 * @returns {number}
 */
export function getTerrainHeight(x, z, size = 200) {
  const craters = [
    { x: 20, z: -15, radius: 12, depth: 3.5 },
    { x: -40, z: 30, radius: 8, depth: 2.5 },
    { x: 60, z: 60, radius: 18, depth: 5.0 },
    { x: -70, z: -50, radius: 15, depth: 4.0 },
    { x: 10, z: 70, radius: 6, depth: 1.8 },
    { x: -20, z: -70, radius: 9, depth: 2.8 },
    { x: 80, z: -30, radius: 20, depth: 6.0 },
    { x: -80, z: 60, radius: 10, depth: 3.0 },
    { x: 35, z: -55, radius: 7, depth: 2.0 },
    { x: -55, z: 15, radius: 5, depth: 1.5 },
    { x: 0, z: 0, radius: 14, depth: 3.8 },
    { x: -30, z: 80, radius: 11, depth: 3.2 },
  ];

  const nx = x / size * 4;
  const nz = z / size * 4;
  const baseHeight = fbm(nx, nz, 7) * 8 - 4;
  const craterDip = craterHeight(x, z, craters);

  return baseHeight + craterDip;
}

/**
 * Generate random rock positions on the terrain.
 * Rocks are scattered far from the center.
 */
export function generateRockPositions(count = 40, terrainSize = 200) {
  const rocks = [];
  const half = terrainSize / 2 - 10;

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 2 * half;
    const z = (Math.random() - 0.5) * 2 * half;
    // Avoid placing rocks too close to starting position
    if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
    const y = getTerrainHeight(x, z);
    const scale = 0.3 + Math.random() * 1.2;
    const rotY = Math.random() * Math.PI * 2;
    rocks.push({ x, y, z, scale, rotY });
  }

  return rocks;
}
