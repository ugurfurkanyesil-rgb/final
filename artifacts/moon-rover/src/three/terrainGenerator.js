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

// ─── Multi-octave fractal noise (hash-based value noise, deterministic) ─────
// Mimics LRO LOLA-derived elevation fractals at three wavelength bands.
//
// Was previously a sum of sin(wx·f)·cos(wz·f) products — the exact same
// basis createLunarRegolithTexture() used to have, and it has the same
// flaw: a product of axis-aligned sinusoids always resolves into a regular
// diagonal interference lattice (confirmed visually: the vertex-colour
// slope-shading this height field drives showed an unmistakable plaid
// pattern even from a straight-down camera, since it's a property of the
// height field's geometry/gradient, not a texture-minification artifact).
// Replaced with the same seamless-value-noise approach as the regolith
// texture (see regolithHash/seamlessValueNoise below), just WITHOUT their
// toroidal wraparound — the terrain is a single fixed -50..50m sheet that's
// never tiled/repeated, so plain (non-wrapping) value noise over continuous
// world coordinates is already gap-free everywhere; no seam to guard against.
function terrainHash(ix, iy, seed) {
  const s = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}
function valueNoise2D(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const sx = x - x0, sy = y - y0;
  const fx = sx * sx * (3 - 2 * sx), fy = sy * sy * (3 - 2 * sy);
  const n00 = terrainHash(x0,     y0,     seed);
  const n10 = terrainHash(x0 + 1, y0,     seed);
  const n01 = terrainHash(x0,     y0 + 1, seed);
  const n11 = terrainHash(x0 + 1, y0 + 1, seed);
  const nx0 = n00 + fx * (n10 - n00);
  const nx1 = n01 + fx * (n11 - n01);
  return nx0 + fy * (nx1 - nx0); // in [0,1)
}

// cellSize is in metres (world space): 50m/25m highland swells down to 3m
// fine roughness, same "highlands → meso → micro" band progression the old
// sin/cos comments claimed. Amplitudes are calibrated on TWO targets, not
// just one — matching height stdev alone (as a first pass did) let slope
// come out ~2x too steep, because value noise's gradient-per-unit-height-
// amplitude isn't the same as a sum-of-sines' at a given wavelength:
//   1) lunarFBM's own standalone height stdev ≈ old implementation's
//      (0.68 vs 0.68, sampled over the full terrain)
//   2) buildSlopeMap()'s mean slope ≈ old implementation's (0.101 vs 0.101,
//      central-difference over the real GRID_RES grid) — THIS is what
//      pathfinder.js's slope/hazard/cost actually consume, so it's the one
//      that matters for routing behaviour, not raw height amplitude.
// Persistence ~0.51 (each octave ~half the amplitude of the last) is a
// standard, non-extreme fBm falloff — every octave contributes visible
// detail, unlike an earlier attempt that needed persistence 0.1 (fine
// octaves basically zeroed out) to hit the slope target at a smaller base
// cell size. See bugs/ page for the calibration measurements.
const LUNAR_FBM_OCTAVES = [
  { cellSize: 50, amp: 4.62, seed: 1.1 },  // long-wavelength highland swells
  { cellSize: 25, amp: 2.36, seed: 2.7 },  // mid-scale undulation
  { cellSize: 12, amp: 1.20, seed: 4.3 },
  { cellSize: 6,  amp: 0.61, seed: 6.6 },  // fine-scale roughness
  { cellSize: 3,  amp: 0.31, seed: 8.9 },  // regolith gardening micro-texture
];

function lunarFBM(wx, wz) {
  let h = 0;
  for (const o of LUNAR_FBM_OCTAVES) {
    h += (valueNoise2D(wx / o.cellSize, wz / o.cellSize, o.seed) - 0.5) * o.amp;
  }
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

// Deterministic hash → pseudo-random float in [0,1) for an integer lattice
// point. Still sin-based (keeps this generator in the same trig-only,
// no-external-noise-lib spirit as the rest of the file), but critically
// UNCORRELATED between neighboring lattice cells — unlike a plain
// sin(x)·cos(y) product (or a small sum of oriented sine gratings), which
// is a smooth deterministic wave and therefore always resolves into a
// regular interference pattern (plaid grid / parallel bands) once you tile
// and view it at an angle. A hash has no such structure to alias into.
function regolithHash(ix, iy, seed) {
  const s = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

// Seamless bilinear value noise on a `cells`×`cells` toroidal lattice: (u,v)
// are in lattice-cell units (0..cells), and lattice indices are wrapped mod
// `cells` before hashing, so the lattice point at u=cells is IDENTICAL to
// the one at u=0 — the noise is then exactly periodic with period `cells`,
// which is what makes RepeatWrapping tile with no visible seam. Smoothstep
// interpolation between the 4 surrounding lattice corners avoids the blocky
// look of raw nearest-neighbour lattice noise.
function seamlessValueNoise(u, v, cells, seed) {
  const x0 = Math.floor(u), y0 = Math.floor(v);
  const sx = u - x0, sy = v - y0;
  const fx = sx * sx * (3 - 2 * sx), fy = sy * sy * (3 - 2 * sy);
  const wrap = n => ((n % cells) + cells) % cells;
  const n00 = regolithHash(wrap(x0),     wrap(y0),     seed);
  const n10 = regolithHash(wrap(x0 + 1), wrap(y0),     seed);
  const n01 = regolithHash(wrap(x0),     wrap(y0 + 1), seed);
  const n11 = regolithHash(wrap(x0 + 1), wrap(y0 + 1), seed);
  const nx0 = n00 + fx * (n10 - n00);
  const nx1 = n01 + fx * (n11 - n01);
  return nx0 + fy * (nx1 - nx0); // in [0,1)
}

// Cell counts double roughly ~2.2× per octave (7→19→43→89→181→359, same
// scale progression the old sin-grain used), amplitude roughly halving —
// coarse octaves dominate the blotchy shape, fine ones just add grain.
const REGOLITH_OCTAVES = [
  { cells: 7,   amp: 32,  seed: 1.1 },  // coarse
  { cells: 19,  amp: 18,  seed: 2.7 },  // medium
  { cells: 43,  amp: 10,  seed: 4.3 },  // fine
  { cells: 89,  amp: 5,   seed: 6.6 },  // very fine
  { cells: 181, amp: 2.5, seed: 8.9 },  // micro
  { cells: 359, amp: 1.3, seed: 3.5 },  // ultra fine
];

// ─── Canvas texture factories ────────────────────────────────────────────────
/**
 * Procedural lunar regolith colour texture.
 * Multi-octave seamless value noise (see REGOLITH_OCTAVES/seamlessValueNoise
 * above) — organic blotchy grain, matches LRO LROC NAC surface appearance.
 * (A naive sin(x)·cos(y) grain basis was tried first but always resolves
 * into a regular plaid/banding interference pattern once tiled and viewed
 * at an angle — value noise has no such periodic structure to alias into.)
 * Tiled 8× across the terrain (each tile ≈ 12.5 m).
 */
export function createLunarRegolithTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx  = canvas.getContext('2d');
  const img  = ctx.createImageData(size, size);
  const d    = img.data;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = (py * size + px) * 4;

      let grain = 0;
      for (const o of REGOLITH_OCTAVES) {
        const u = (px / size) * o.cells, v = (py / size) * o.cells;
        grain += (seamlessValueNoise(u, v, o.cells, o.seed) - 0.5) * o.amp;
      }

      // Base neon silver-grey (cool blue-tinted bright grey) ± grain
      // R:G:B = 185:194:204, same grain applied to all channels so the
      // cool tint balance is preserved, just clamped to a valid byte.
      d[i]   = Math.max(0, Math.min(255, 185 + grain));
      d[i+1] = Math.max(0, Math.min(255, 194 + grain));
      d[i+2] = Math.max(0, Math.min(255, 204 + grain));
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

  // Flat / neutral normal map — (128, 128, 255) everywhere = zero perturbation.
  // Keeps the normalMap slot active so geometry shading is unaffected,
  // but adds NO repeating surface-wave patterns of its own.
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = (py * size + px) * 4;
      d[i]   = 128;  // X = 0
      d[i+1] = 128;  // Y = 0
      d[i+2] = 255;  // Z = up
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

  // 2. Vertex colours — neon silver-grey, no patterns, only crater shading
  const normals = geo.attributes.normal;
  const colors  = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i), wz = pos.getZ(i);

    // Only slope + crater — NO macro / grain noise patterns
    const ny    = Math.abs(normals.getY(i));
    const slope = 1.0 - ny;
    const cbias = craterColourBias(wx, wz);

    // Bright neon-grey base (0.76), clamp wide to show crater contrast
    const lum = Math.max(0.26, Math.min(0.92,
      0.760
      - slope * 0.080   // wall shading only
      + cbias            // crater dark floor / bright rim
    ));

    // Cool silver tint: slight blue cast (neon grey feel)
    colors[i * 3]     = lum * 0.91;  // R — slightly pulled back
    colors[i * 3 + 1] = lum * 0.95;  // G — near neutral
    colors[i * 3 + 2] = lum * 1.00;  // B — dominant for cool neon look
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
