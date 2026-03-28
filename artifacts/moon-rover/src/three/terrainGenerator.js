/**
 * Terrain Generator - Realistic NASA-inspired Moon surface
 * Based on LRO/Apollo elevation and albedo data characteristics:
 *   - Multi-scale fractal undulation (highlands wavelength ~30m, meso ~8m, micro ~2m)
 *   - Physically-proportioned craters with bowl, rim, and ejecta blanket
 *   - Lunar regolith vertex colours (grey-brown, albedo ~0.12–0.19)
 *   - Brighter fresh rims, darker compressed interiors
 */

import * as THREE from 'three';

export const TERRAIN_SIZE = 100;
export const GRID_RES = 256;

// ─── Canonical crater list ─────────────────────────────────────────────────
export const CRATERS = [
  { x:  15, z: -10, radius:  9,   depth: 3.8,  rimH: 1.40, rimW: 0.28 },
  { x: -20, z:  18, radius:  6,   depth: 2.4,  rimH: 0.85, rimW: 0.30 },
  { x:  35, z:  32, radius: 14,   depth: 5.2,  rimH: 1.90, rimW: 0.25 },
  { x: -38, z: -28, radius: 11,   depth: 4.1,  rimH: 1.50, rimW: 0.27 },
  { x:   5, z:  38, radius:  5,   depth: 1.8,  rimH: 0.65, rimW: 0.32 },
  { x: -12, z: -38, radius:  7,   depth: 2.7,  rimH: 0.95, rimW: 0.28 },
  { x:  42, z: -18, radius: 17,   depth: 6.2,  rimH: 2.20, rimW: 0.22 },
  { x: -42, z:  30, radius:  9,   depth: 3.1,  rimH: 1.10, rimW: 0.29 },
  { x:  22, z: -36, radius:  5,   depth: 1.7,  rimH: 0.60, rimW: 0.31 },
  { x: -28, z:   8, radius:  4,   depth: 1.3,  rimH: 0.50, rimW: 0.33 },
  { x:   0, z:   0, radius: 11,   depth: 3.5,  rimH: 1.30, rimW: 0.26 },
  { x: -18, z:  42, radius:  8,   depth: 2.8,  rimH: 1.00, rimW: 0.28 },
  { x:  30, z:  10, radius:  3.5, depth: 1.0,  rimH: 0.38, rimW: 0.35 },
  { x:  -8, z: -18, radius:  3,   depth: 0.9,  rimH: 0.35, rimW: 0.36 },
  { x:  40, z:  46, radius:  7,   depth: 2.3,  rimH: 0.85, rimW: 0.29 },
  { x: -44, z: -10, radius:  5.5, depth: 1.8,  rimH: 0.70, rimW: 0.30 },
  { x:  10, z:  22, radius:  4,   depth: 1.2,  rimH: 0.45, rimW: 0.34 },
  { x: -30, z: -44, radius: 12,   depth: 4.3,  rimH: 1.55, rimW: 0.25 },
  { x:  46, z:  -4, radius:  3,   depth: 0.8,  rimH: 0.30, rimW: 0.36 },
  { x:  -6, z:  46, radius:  6.5, depth: 2.1,  rimH: 0.78, rimW: 0.29 },
  { x:  25, z: -48, radius:  4,   depth: 1.1,  rimH: 0.42, rimW: 0.33 },
  { x: -46, z:  46, radius:  6,   depth: 1.9,  rimH: 0.72, rimW: 0.30 },
  { x:  -2, z: -26, radius:  3,   depth: 0.85, rimH: 0.32, rimW: 0.36 },
  { x:  48, z:  30, radius:  4,   depth: 1.2,  rimH: 0.46, rimW: 0.33 },
];

// ─── Multi-octave fractal noise (sin/cos basis, deterministic) ──────────────
// Mimics LRO LOLA-derived elevation fractals at three wavelength bands.
function lunarFBM(wx, wz) {
  // Long-wavelength highland swells (~30 m)
  let h = 0;
  h += Math.sin(wx * 0.072 + 1.17) * Math.cos(wz * 0.081 + 2.35) * 0.90;
  h += Math.sin(wx * 0.061 + 4.40) * Math.cos(wz * 0.058 + 0.71) * 0.70;
  // Mid-scale undulation (~8 m)
  h += Math.sin(wx * 0.190 + 3.72) * Math.cos(wz * 0.210 + 1.43) * 0.35;
  h += Math.sin(wx * 0.245 + 0.88) * Math.cos(wz * 0.175 + 5.10) * 0.28;
  h += Math.sin((wx + wz) * 0.155 + 2.61) * 0.22;
  // Fine-scale roughness (~2 m) — regolith gardening texture
  h += Math.sin(wx * 0.520 + 1.95) * Math.cos(wz * 0.470 + 3.80) * 0.10;
  h += Math.sin(wx * 0.780 + 0.33) * Math.cos(wz * 0.840 + 4.55) * 0.06;
  h += Math.sin(wx * 1.350 + 5.70) * Math.cos(wz * 1.220 + 2.20) * 0.03;
  return h;
}

// ─── Crater profile ─────────────────────────────────────────────────────────
function craterProfile(wx, wz, c) {
  const dx = wx - c.x, dz = wz - c.z;
  const d  = Math.sqrt(dx * dx + dz * dz);
  const t  = d / c.radius;
  if (t > 2.5) return 0;

  let h = 0;
  if (t <= 1.0) {
    const bowl = 2 * t * t * t - 3 * t * t + 1; // 1 at centre → 0 at rim
    h -= bowl * c.depth;
    if (t < 0.25) h += (0.25 - t) / 0.25 * c.depth * 0.12; // flat floor
  }

  // Sharp Gaussian rim
  const rimCenter = 1.0 + c.rimW * 0.5;
  const rimDist   = t - rimCenter;
  h += Math.exp(-(rimDist * rimDist) / (2 * c.rimW * c.rimW)) * c.rimH;

  // Outer ejecta blanket
  if (t > 1.0 && t < 2.0) {
    const ej = (t - 1.0);
    h += (1 - ej) * c.rimH * 0.15 * Math.exp(-ej * 3);
  }
  return h;
}

// ─── Public height API ───────────────────────────────────────────────────────
export function getTerrainHeight(wx, wz) {
  let h = lunarFBM(wx, wz);
  for (const c of CRATERS) h += craterProfile(wx, wz, c);
  return h;
}

// ─── Crater colour contribution (for colourmap) ──────────────────────────────
// Returns a value in [-1, +1]: negative = interior (darken), positive = rim (brighten)
function craterColourBias(wx, wz) {
  let bias = 0;
  for (const c of CRATERS) {
    const dx = wx - c.x, dz = wz - c.z;
    const t  = Math.sqrt(dx * dx + dz * dz) / c.radius;
    if (t < 1.0) {
      // Interior: clearly darker — gives the "cheese hole" look
      bias -= (1.0 - t) * 0.38 * Math.min(1, c.depth / 3.5);
    } else if (t < 1.0 + c.rimW * 3) {
      // Rim: noticeably brighter fresh ejecta
      const rf = 1 - (t - 1.0) / (c.rimW * 3);
      bias += rf * 0.28 * Math.min(1, c.rimH / 1.2);
    }
  }
  return Math.max(-0.42, Math.min(0.42, bias));
}

// ─── Canvas texture factories ────────────────────────────────────────────────
/**
 * Procedural lunar regolith colour texture.
 * Multi-frequency sin/cos grain — matches LRO LROC NAC surface appearance.
 * Tiled 16× across the terrain (each tile ≈ 6.25 m).
 */
export function createLunarRegolithTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx  = canvas.getContext('2d');
  const img  = ctx.createImageData(size, size);
  const d    = img.data;

  // Seamless frequencies: k × 2π / size → at x=size wraps back to x=0 exactly
  const TP = Math.PI * 2;
  const f1 = TP *   7 / size;   // coarse grain
  const f2 = TP *  19 / size;   // medium grain
  const f3 = TP *  43 / size;   // fine grain
  const f4 = TP *  89 / size;   // very fine
  const f5 = TP * 181 / size;   // micro
  const f6 = TP * 359 / size;   // ultra fine

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = (py * size + px) * 4;

      // All terms are seamlessly tileable (integer-k frequencies)
      const n0 = Math.sin(px * f1 + 1.1) * Math.cos(py * f1 + 2.3) * 0.40 + 0.50;
      const n1 = Math.sin(px * f2 + 3.7) * Math.cos(py * f2 + 0.9) * 0.25 + 0.50;
      const n2 = Math.sin(px * f3 + 5.2) * Math.cos(py * f3 + 4.4) * 0.16 + 0.50;
      const n3 = Math.sin(px * f4 + 2.8) * Math.cos(py * f4 + 1.6) * 0.10 + 0.50;
      const n4 = Math.sin(px * f5 + 0.5) * Math.cos(py * f5 + 3.2) * 0.05 + 0.50;
      const n5 = Math.sin(px * f6 + 4.1) * Math.cos(py * f6 + 5.8) * 0.03 + 0.50;
      // Cross-axis blend for organic feel (still seamless: uses same integer freq)
      const nc = Math.sin(px * f2 + py * f1 * 0.5 + 2.0) * 0.08 + 0.50;

      const combined = n0*0.32 + n1*0.23 + n2*0.17 + n3*0.13 + n4*0.08 + n5*0.05 + nc*0.10 - 0.50*0.98;
      // 0–1 → bright neutral grey 118–192
      const v = Math.min(255, Math.max(0, Math.round(118 + combined * 74)));
      d[i]   = v;
      d[i+1] = v;
      d[i+2] = v;
      d[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);   // was 16 — fewer seams visible
  tex.anisotropy = 16;
  return tex;
}

/**
 * Procedural micro-normal map for regolith grain bumps.
 * Tiled 32× for very fine surface irregularity.
 */
export function createLunarNormalMap(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d   = img.data;

  // Seamless integer-k frequencies for size=256
  const TP = Math.PI * 2;
  const g1 = TP *  6 / size;  // ≈ 0.147 — coarse bumps
  const g2 = TP * 13 / size;  // ≈ 0.319 — medium bumps
  const g3 = TP * 29 / size;  // ≈ 0.712 — fine bumps

  // Seamless height function for normal generation
  const H = (x, y) =>
    Math.sin(x * g1 + 1.1) * Math.cos(y * g1 + 2.2) * 0.55 +
    Math.sin(x * g2 + 3.5) * Math.cos(y * g2 + 0.7) * 0.28 +
    Math.sin(x * g3 + 0.8) * Math.cos(y * g3 + 4.3) * 0.12;

  const eps = 1.0;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i  = (py * size + px) * 4;
      const hL = H(px - eps, py), hR = H(px + eps, py);
      const hD = H(px, py - eps), hU = H(px, py + eps);
      const strength = 14.0;
      const nx = (hL - hR);
      const nz = (hD - hU);
      const len = Math.sqrt(nx * nx + nz * nz + 1 / (strength * strength));
      d[i]   = Math.round(128 + (nx / len) * 127);
      d[i+1] = Math.round(128 + (nz / len) * 127);
      d[i+2] = 255;
      d[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);  // was 32 — fewer visible seams
  tex.anisotropy = 16;
  return tex;
}

// ─── Geometry builder ────────────────────────────────────────────────────────
export function generateTerrain() {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, GRID_RES - 1, GRID_RES - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;

  // 1. Displace vertices
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, getTerrainHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  // 2. Vertex colours — real Moon surface palette (reference: LRO/Kaguya imagery)
  //    Pure neutral grey, no warm tint.
  //    Highlands base ≈ 0.38–0.44, Mare dark patches ≈ 0.14–0.24
  const normals = geo.attributes.normal;
  const colors  = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i), wz = pos.getZ(i);

    // Slope darkening (crater walls and steep terrain absorb more light)
    const ny    = Math.abs(normals.getY(i));
    const slope = 1.0 - ny;

    // Crater albedo: darker interior, slightly brighter fresh rim
    const cbias = craterColourBias(wx, wz);

    // ── Large-scale patchwork (gives varied bright/dark zones across terrain) ─
    const macro =
      Math.sin(wx * 0.055 + 1.8) * Math.cos(wz * 0.050 + 0.4) * 0.045 +
      Math.sin(wx * 0.120 + 3.2) * Math.cos(wz * 0.110 + 2.7) * 0.030 +
      Math.sin(wx * 0.250 + 0.6) * Math.cos(wz * 0.230 + 4.1) * 0.018 +
      Math.sin((wx - wz) * 0.080 + 2.0) * 0.014;

    // ── Fine grain for micro-texture variation ────────────────────────────
    const grain =
      Math.sin(wx * 1.80 + 0.9) * Math.cos(wz * 1.65 + 3.4) * 0.018 +
      Math.sin(wx * 3.50 + 2.5) * Math.cos(wz * 3.80 + 0.8) * 0.010 +
      Math.sin(wx * 7.00 + 4.8) * Math.cos(wz * 6.90 + 5.2) * 0.005;

    // Composite luminance — bright lunar highland base 0.62
    const lum = Math.max(0.24, Math.min(0.88,
      0.620
      - slope  * 0.090  // steep walls darker
      + cbias            // crater dark/bright: ±42%
      + macro            // large patches: ±11%
      + grain            // micro grain: ±3%
    ));

    // Pure neutral grey — R = G = B (no warm tint, matches reference photo)
    colors[i * 3]     = lum;
    colors[i * 3 + 1] = lum;
    colors[i * 3 + 2] = lum;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// ─── Map data builders (unchanged interface) ─────────────────────────────────
export function buildHeightMap() {
  const map  = new Float32Array(GRID_RES * GRID_RES);
  const half = TERRAIN_SIZE / 2;
  for (let row = 0; row < GRID_RES; row++) {
    for (let col = 0; col < GRID_RES; col++) {
      map[row * GRID_RES + col] = getTerrainHeight(
        -half + (col / (GRID_RES - 1)) * TERRAIN_SIZE,
        -half + (row / (GRID_RES - 1)) * TERRAIN_SIZE,
      );
    }
  }
  return map;
}

export function buildSlopeMap(hMap) {
  const slope    = new Float32Array(GRID_RES * GRID_RES);
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

export function buildCraterMask() {
  const mask = new Float32Array(GRID_RES * GRID_RES);
  const half = TERRAIN_SIZE / 2;
  for (let row = 0; row < GRID_RES; row++) {
    for (let col = 0; col < GRID_RES; col++) {
      const wx = -half + (col / (GRID_RES - 1)) * TERRAIN_SIZE;
      const wz = -half + (row / (GRID_RES - 1)) * TERRAIN_SIZE;
      let val  = 0;
      for (const c of CRATERS) {
        const t = Math.sqrt((wx - c.x) ** 2 + (wz - c.z) ** 2) / c.radius;
        if (t < 1.0)                       val = Math.max(val, 1.0 - t * 0.35);
        else if (t < 1.0 + c.rimW * 2)    val = Math.max(val, (1 - (t - 1.0) / (c.rimW * 2)) * 0.7);
        else if (t < 1.8)                  val = Math.max(val, (1 - (t - 1.0 - c.rimW * 2) / (0.8 - c.rimW * 2)) * 0.35);
      }
      mask[row * GRID_RES + col] = val;
    }
  }
  return mask;
}

// ─── Rock positions ──────────────────────────────────────────────────────────
export function generateRockPositions(count = 80) {
  const rocks   = [];
  const half    = TERRAIN_SIZE / 2 - 3;
  let   attempts = 0;
  while (rocks.length < count && attempts < count * 15) {
    attempts++;
    const x = (Math.random() - 0.5) * 2 * half;
    const z = (Math.random() - 0.5) * 2 * half;
    if (getTerrainHeight(x, z) > -0.2) {
      rocks.push({
        x, z,
        y:      getTerrainHeight(x, z),
        scale:  0.08 + Math.random() * 0.45,
        rotY:   Math.random() * Math.PI * 2,
        rotX:   Math.random() * 0.4,
      });
    }
  }
  return rocks;
}

// ─── Space debris positions ──────────────────────────────────────────────────
export function generateDebrisPositions() {
  const positions = [
    { x: -32, z:  14, rot: 0.4, type: 'panel', scale: 0.9  },
    { x:  28, z: -42, rot: 1.2, type: 'tank',  scale: 0.7  },
    { x: -14, z: -30, rot: 2.1, type: 'hull',  scale: 1.1  },
    { x:  44, z:  20, rot: 0.8, type: 'strut', scale: 0.6  },
    { x:  -4, z:  30, rot: 3.4, type: 'panel', scale: 1.3  },
    { x:  18, z:  48, rot: 1.7, type: 'tank',  scale: 0.85 },
    { x: -46, z:  -4, rot: 0.3, type: 'hull',  scale: 0.75 },
    { x:  38, z: -44, rot: 2.8, type: 'panel', scale: 1.05 },
    { x: -24, z:  46, rot: 1.1, type: 'strut', scale: 0.55 },
    { x:   8, z: -44, rot: 0.6, type: 'hull',  scale: 0.9  },
  ];
  return positions.map(d => ({ ...d, y: getTerrainHeight(d.x, d.z) }));
}
