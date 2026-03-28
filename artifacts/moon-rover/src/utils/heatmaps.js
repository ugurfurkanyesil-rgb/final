/**
 * Heatmap Generator
 * Generates 2D canvas heatmaps for different terrain parameters.
 */

import { GRID_RES, TERRAIN_SIZE, buildHeightMap, buildSlopeMap, buildCraterMask, CRATERS } from '../three/terrainGenerator.js';

// Thermal color scale: blue→cyan→green→yellow→red
function thermalColor(t) {
  t = Math.max(0, Math.min(1, t));
  let r, g, b;
  if (t < 0.25) {
    r = 0; g = t * 4 * 255; b = 255;
  } else if (t < 0.5) {
    r = 0; g = 255; b = (1 - (t - 0.25) * 4) * 255;
  } else if (t < 0.75) {
    r = (t - 0.5) * 4 * 255; g = 255; b = 0;
  } else {
    r = 255; g = (1 - (t - 0.75) * 4) * 255; b = 0;
  }
  return [Math.round(r), Math.round(g), Math.round(b)];
}

// Grayscale
function grayColor(t) {
  const v = Math.round(t * 255);
  return [v, v, v];
}

// Cold to warm (blue → white → red)
function divergingColor(t) {
  if (t < 0.5) {
    const s = t * 2;
    return [Math.round(s * 255), Math.round(s * 255), 255];
  } else {
    const s = (t - 0.5) * 2;
    return [255, Math.round((1 - s) * 255), Math.round((1 - s) * 255)];
  }
}

let _heightMap = null;
let _slopeMap = null;
let _craterMask = null;

function ensureMaps() {
  if (!_heightMap) {
    _heightMap = buildHeightMap();
    _slopeMap = buildSlopeMap(_heightMap);
    _craterMask = buildCraterMask(1.0);
  }
}

export function getHeightMap() { ensureMaps(); return _heightMap; }
export function getSlopeMap() { ensureMaps(); return _slopeMap; }
export function getCraterMask() { ensureMaps(); return _craterMask; }

/** Draw a heatmap to a canvas element (also exported as generateHeatmapCanvas for compatibility) */
export function generateHeatmapCanvas(canvas, type, slopeMapOverride, craterMaskOverride, hMapOverride, sunAngle) {
  return drawHeatmap(canvas, type, null);
}

export function drawHeatmap(canvas, type, experienceMap) {
  ensureMaps();
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const imgData = ctx.createImageData(W, H);
  const px = imgData.data;

  // Build the parameter map
  let paramMap;
  let maxVal = 1;

  switch (type) {
    case 'Slope': {
      paramMap = _slopeMap;
      maxVal = 0.8;
      break;
    }
    case 'Slope Angle': {
      // Convert slope to degrees
      paramMap = new Float32Array(_slopeMap.length);
      for (let i = 0; i < _slopeMap.length; i++) {
        paramMap[i] = Math.atan(_slopeMap[i]) * (180 / Math.PI);
      }
      maxVal = 35;
      break;
    }
    case 'Roughness': {
      // Local height variance
      paramMap = new Float32Array(GRID_RES * GRID_RES);
      for (let row = 1; row < GRID_RES - 1; row++) {
        for (let col = 1; col < GRID_RES - 1; col++) {
          const c = _heightMap[row * GRID_RES + col];
          let sum = 0;
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++)
              sum += Math.abs(_heightMap[(row+dr)*GRID_RES+(col+dc)] - c);
          paramMap[row * GRID_RES + col] = sum / 8;
        }
      }
      maxVal = 1.5;
      break;
    }
    case 'Slip Risk': {
      paramMap = new Float32Array(GRID_RES * GRID_RES);
      for (let i = 0; i < GRID_RES * GRID_RES; i++) {
        paramMap[i] = Math.min(1, _slopeMap[i] * 1.5 + _craterMask[i] * 0.3);
      }
      maxVal = 1;
      break;
    }
    case 'Illumination': {
      // Simulate sun from NE direction — slopes facing away are darker
      paramMap = new Float32Array(GRID_RES * GRID_RES);
      const sunX = 0.707, sunZ = -0.707;
      for (let row = 1; row < GRID_RES - 1; row++) {
        for (let col = 1; col < GRID_RES - 1; col++) {
          const dX = (_heightMap[row*GRID_RES+col+1] - _heightMap[row*GRID_RES+col-1]);
          const dZ = (_heightMap[(row+1)*GRID_RES+col] - _heightMap[(row-1)*GRID_RES+col]);
          // Dot product of surface normal with sun direction
          const nx = -dX, ny = 2.0, nz = -dZ;
          const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
          const illum = Math.max(0, (nx/len * sunX + ny/len * 0.5 + nz/len * sunZ));
          paramMap[row * GRID_RES + col] = illum;
        }
      }
      maxVal = 1;
      break;
    }
    case 'Hazard Score': {
      paramMap = new Float32Array(GRID_RES * GRID_RES);
      for (let i = 0; i < GRID_RES * GRID_RES; i++) {
        const s = Math.min(1, _slopeMap[i] / 0.6);
        const c = _craterMask[i];
        paramMap[i] = Math.min(1, s * 0.4 + c * 0.6);
      }
      maxVal = 1;
      break;
    }
    case 'Traversability': {
      paramMap = new Float32Array(GRID_RES * GRID_RES);
      for (let i = 0; i < GRID_RES * GRID_RES; i++) {
        const s = Math.min(1, _slopeMap[i] / 0.6);
        const c = _craterMask[i];
        paramMap[i] = 1 - Math.min(1, s * 0.4 + c * 0.6);
      }
      maxVal = 1;
      break;
    }
    case 'Experience': {
      paramMap = experienceMap || new Float32Array(GRID_RES * GRID_RES);
      maxVal = 0.5;
      break;
    }
    default:
      paramMap = _heightMap;
      maxVal = 6;
  }

  // Sample down to canvas size
  for (let py = 0; py < H; py++) {
    for (let px2 = 0; px2 < W; px2++) {
      const row = Math.floor((py / H) * GRID_RES);
      const col = Math.floor((px2 / W) * GRID_RES);
      const val = paramMap[row * GRID_RES + col];
      const t = Math.max(0, Math.min(1, val / maxVal));

      let [r, g, b] = type === 'Illumination' ? grayColor(t)
        : type === 'Traversability' ? divergingColor(t)
        : thermalColor(t);

      const i = (py * W + px2) * 4;
      px[i]   = r;
      px[i+1] = g;
      px[i+2] = b;
      px[i+3] = 200;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}
