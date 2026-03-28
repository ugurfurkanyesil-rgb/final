/**
 * Terrain Renderer - pre-renders Moon terrain to a canvas for the mini-map.
 * Produces a satellite-view style grayscale shaded-relief image.
 */

import { TERRAIN_SIZE, GRID_RES, getTerrainHeight, CRATERS, buildHeightMap, buildCraterMask, buildSlopeMap } from '../three/terrainGenerator.js';

let _rendered = null;
let _offscreen = null;

/**
 * Renders the terrain to an offscreen canvas (cached).
 * @param {number} size - Canvas resolution
 * @returns {HTMLCanvasElement}
 */
export function getTerrainCanvas(size = 256) {
  if (_offscreen && _offscreen.width === size) return _offscreen;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const px = imgData.data;

  const hMap = buildHeightMap();
  const sMap = buildSlopeMap(hMap);
  const cMask = buildCraterMask();

  // Sun direction for hillshade
  const sunAz = Math.PI * 0.55;  // ~100° azimuth
  const sunEl = Math.PI * 0.35;  // elevation
  const lx = Math.cos(sunEl) * Math.cos(sunAz);
  const lz = Math.cos(sunEl) * Math.sin(sunAz);
  const ly = Math.sin(sunEl);
  const cellSize = TERRAIN_SIZE / (GRID_RES - 1);

  for (let py = 0; py < size; py++) {
    for (let px2 = 0; px2 < size; px2++) {
      const row = Math.floor((py / size) * GRID_RES);
      const col = Math.floor((px2 / size) * GRID_RES);

      // Clamp for normal computation
      const rowC = Math.max(1, Math.min(GRID_RES - 2, row));
      const colC = Math.max(1, Math.min(GRID_RES - 2, col));

      const hC = hMap[rowC * GRID_RES + colC];
      const hR = hMap[rowC * GRID_RES + (colC + 1)];
      const hL = hMap[rowC * GRID_RES + (colC - 1)];
      const hD = hMap[(rowC + 1) * GRID_RES + colC];
      const hU = hMap[(rowC - 1) * GRID_RES + colC];

      // Surface normal via finite differences
      const dX = (hR - hL) / (2 * cellSize);
      const dZ = (hD - hU) / (2 * cellSize);
      const nx = -dX, ny = 1.0, nz = -dZ;
      const nLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
      const diffuse = Math.max(0, (nx/nLen)*lx + (ny/nLen)*ly + (nz/nLen)*lz);

      const crater = cMask[row * GRID_RES + col];
      const slope = sMap[row * GRID_RES + col];

      // Base: light gray lunar surface
      let v = 0.50 + diffuse * 0.35 + hC * 0.018;

      // Darken crater floors
      if (crater > 0.6) v -= crater * 0.22;

      // Slightly darken steep slopes
      if (slope > 0.3) v -= (slope - 0.3) * 0.12;

      v = Math.max(0.1, Math.min(0.92, v));
      const bv = Math.round(v * 255);

      const i = (py * size + px2) * 4;
      px[i]   = bv;
      px[i+1] = Math.round(bv * 0.97);
      px[i+2] = Math.round(bv * 0.93);
      px[i+3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Draw crater outlines
  for (const c of CRATERS) {
    const half = TERRAIN_SIZE / 2;
    const cx = ((c.x + half) / TERRAIN_SIZE) * size;
    const cy = ((c.z + half) / TERRAIN_SIZE) * size;
    const rx = (c.radius / TERRAIN_SIZE) * size;
    ctx.beginPath();
    ctx.arc(cx, cy, rx * 1.05, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(160,160,155,0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  _offscreen = canvas;
  return canvas;
}

/** Invalidate cache (e.g. after terrain changes) */
export function invalidateTerrainCanvas() {
  _offscreen = null;
}
