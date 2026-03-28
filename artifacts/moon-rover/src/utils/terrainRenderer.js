/**
 * Terrain Renderer - pre-renders Moon terrain to a canvas for the mini-map.
 * High-contrast satellite-view: hillshaded relief + crater tints + rover-start marker.
 */

import { TERRAIN_SIZE, GRID_RES, CRATERS, buildHeightMap, buildCraterMask, buildSlopeMap } from '../three/terrainGenerator.js';

let _offscreen = null;

/**
 * Renders the terrain to an offscreen canvas (cached by size).
 * @param {number} size - Canvas resolution in pixels
 * @returns {HTMLCanvasElement}
 */
export function getTerrainCanvas(size = 256) {
  if (_offscreen && _offscreen.width === size) return _offscreen;

  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx    = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const px      = imgData.data;

  const hMap = buildHeightMap();
  const sMap = buildSlopeMap(hMap);
  const cMask = buildCraterMask();

  // Sun from upper-left (azimuth ~315°, elevation ~35°)
  const sunAz = 5.5;  // radians
  const sunEl = 0.61;
  const lx =  Math.cos(sunEl) * Math.cos(sunAz);
  const lz =  Math.cos(sunEl) * Math.sin(sunAz);
  const ly =  Math.sin(sunEl);
  const cellSize = TERRAIN_SIZE / (GRID_RES - 1);

  // Find height range for normalisation
  let hMin = Infinity, hMax = -Infinity;
  for (let i = 0; i < hMap.length; i++) {
    if (hMap[i] < hMin) hMin = hMap[i];
    if (hMap[i] > hMax) hMax = hMap[i];
  }
  const hRange = Math.max(hMax - hMin, 0.01);

  for (let py = 0; py < size; py++) {
    for (let px2 = 0; px2 < size; px2++) {
      const row  = Math.floor((py  / size) * GRID_RES);
      const col  = Math.floor((px2 / size) * GRID_RES);
      const rowC = Math.max(1, Math.min(GRID_RES - 2, row));
      const colC = Math.max(1, Math.min(GRID_RES - 2, col));

      const hC = hMap[rowC * GRID_RES + colC];
      const hR = hMap[rowC * GRID_RES + (colC + 1)];
      const hL = hMap[rowC * GRID_RES + (colC - 1)];
      const hD = hMap[(rowC + 1) * GRID_RES + colC];
      const hU = hMap[(rowC - 1) * GRID_RES + colC];

      // Surface normal via central differences
      const dX  = (hR - hL) / (2 * cellSize);
      const dZ  = (hD - hU) / (2 * cellSize);
      const nx  = -dX, ny = 1.0, nz = -dZ;
      const nLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
      const diff = Math.max(0, (nx/nLen)*lx + (ny/nLen)*ly + (nz/nLen)*lz);

      const crater = cMask[row * GRID_RES + col];
      const slope  = sMap [row * GRID_RES + col];
      const hNorm  = (hC - hMin) / hRange; // 0..1

      // --- Base luminance: bright lunar highland ---
      let v = 0.54                 // bright highland base
            + diff * 0.34          // hillshade
            + hNorm * 0.08;        // elevation tint

      // Darken crater floors, brighten rims
      if (crater > 0.5) v -= (crater - 0.5) * 0.36;
      if (crater > 0.15 && crater < 0.45) v += 0.06; // rim highlight

      // Steep slopes slightly darker
      if (slope > 0.25) v -= (slope - 0.25) * 0.08;

      v = Math.max(0.14, Math.min(0.96, v));

      // Convert to RGB — very slight warm bias on lit faces, cool in shadow
      const bv = Math.round(v * 255);
      const warmBias = diff * 8;
      const idx = (py * size + px2) * 4;
      px[idx]   = Math.min(255, bv + warmBias);
      px[idx+1] = bv;
      px[idx+2] = Math.max(0,   bv - warmBias);
      px[idx+3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // --- Draw crater rim circles ---
  for (const c of CRATERS) {
    const half = TERRAIN_SIZE / 2;
    const cx  = ((c.x + half) / TERRAIN_SIZE) * size;
    const cy  = ((c.z + half) / TERRAIN_SIZE) * size;
    const rx  = (c.radius / TERRAIN_SIZE) * size;
    ctx.beginPath();
    ctx.arc(cx, cy, rx * 1.08, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,200,185,0.35)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  // --- Rover start marker (green dot) ---
  const half  = TERRAIN_SIZE / 2;
  const rsx   = ((-38 + half) / TERRAIN_SIZE) * size;
  const rsy   = ((-38 + half) / TERRAIN_SIZE) * size;
  ctx.beginPath();
  ctx.arc(rsx, rsy, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40,255,100,0.85)';
  ctx.fill();

  _offscreen = canvas;
  return canvas;
}

/** Invalidate cache (call when terrain generator changes) */
export function invalidateTerrainCanvas() {
  _offscreen = null;
}
