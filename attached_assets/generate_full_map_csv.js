const fs = require('fs');
const path = require('path');

const outPath = path.join(process.cwd(), 'attached_assets', 'harita_tum_grid_parametreleri.csv');

const TERRAIN_SIZE = 100;
const GRID_RES = 256;
const CRATERS = [
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

function lunarFBM(wx, wz) {
  let h = 0;
  h += Math.sin(wx * 0.072 + 1.17) * Math.cos(wz * 0.081 + 2.35) * 0.90;
  h += Math.sin(wx * 0.061 + 4.40) * Math.cos(wz * 0.058 + 0.71) * 0.70;
  h += Math.sin(wx * 0.190 + 3.72) * Math.cos(wz * 0.210 + 1.43) * 0.35;
  h += Math.sin(wx * 0.245 + 0.88) * Math.cos(wz * 0.175 + 5.10) * 0.28;
  h += Math.sin((wx + wz) * 0.155 + 2.61) * 0.22;
  h += Math.sin(wx * 0.520 + 1.95) * Math.cos(wz * 0.470 + 3.80) * 0.10;
  h += Math.sin(wx * 0.780 + 0.33) * Math.cos(wz * 0.840 + 4.55) * 0.06;
  h += Math.sin(wx * 1.350 + 5.70) * Math.cos(wz * 1.220 + 2.20) * 0.03;
  return h;
}

function craterProfile(wx, wz, c) {
  const dx = wx - c.x;
  const dz = wz - c.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  const t = d / c.radius;
  if (t > 2.5) return 0;

  let h = 0;
  if (t <= 1.0) {
    const bowl = 2 * t * t * t - 3 * t * t + 1;
    h -= bowl * c.depth;
    if (t < 0.25) h += ((0.25 - t) / 0.25) * c.depth * 0.12;
  }

  const rimCenter = 1.0 + c.rimW * 0.5;
  const rimDist = t - rimCenter;
  h += Math.exp(-(rimDist * rimDist) / (2 * c.rimW * c.rimW)) * c.rimH;

  if (t > 1.0 && t < 2.0) {
    const ej = t - 1.0;
    h += (1 - ej) * c.rimH * 0.15 * Math.exp(-ej * 3);
  }

  return h;
}

function getTerrainHeight(wx, wz) {
  let h = lunarFBM(wx, wz);
  for (const c of CRATERS) h += craterProfile(wx, wz, c);
  return h;
}

function craterMaskAt(wx, wz) {
  let val = 0;
  for (const c of CRATERS) {
    const t = Math.sqrt((wx - c.x) ** 2 + (wz - c.z) ** 2) / c.radius;
    if (t < 1.0) val = Math.max(val, 1.0 - t * 0.35);
    else if (t < 1.0 + c.rimW * 2) val = Math.max(val, (1 - (t - 1.0) / (c.rimW * 2)) * 0.7);
    else if (t < 1.8) val = Math.max(val, (1 - (t - 1.0 - c.rimW * 2) / (0.8 - c.rimW * 2)) * 0.35);
  }
  return val;
}

const half = TERRAIN_SIZE / 2;
const cellSize = TERRAIN_SIZE / (GRID_RES - 1);

const xs = new Float64Array(GRID_RES * GRID_RES);
const zs = new Float64Array(GRID_RES * GRID_RES);
const hMap = new Float64Array(GRID_RES * GRID_RES);
const cMask = new Float64Array(GRID_RES * GRID_RES);

for (let row = 0; row < GRID_RES; row++) {
  for (let col = 0; col < GRID_RES; col++) {
    const idx = row * GRID_RES + col;
    const x = -half + (col / (GRID_RES - 1)) * TERRAIN_SIZE;
    const z = -half + (row / (GRID_RES - 1)) * TERRAIN_SIZE;
    xs[idx] = x;
    zs[idx] = z;
    hMap[idx] = getTerrainHeight(x, z);
    cMask[idx] = craterMaskAt(x, z);
  }
}

const slope = new Float64Array(GRID_RES * GRID_RES);
const dHdx = new Float64Array(GRID_RES * GRID_RES);
const dHdz = new Float64Array(GRID_RES * GRID_RES);

for (let row = 1; row < GRID_RES - 1; row++) {
  for (let col = 1; col < GRID_RES - 1; col++) {
    const idx = row * GRID_RES + col;
    const gx = (hMap[row * GRID_RES + (col + 1)] - hMap[row * GRID_RES + (col - 1)]) / (2 * cellSize);
    const gz = (hMap[(row + 1) * GRID_RES + col] - hMap[(row - 1) * GRID_RES + col]) / (2 * cellSize);
    dHdx[idx] = gx;
    dHdz[idx] = gz;
    slope[idx] = Math.sqrt(gx * gx + gz * gz);
  }
}

const stream = fs.createWriteStream(outPath, { encoding: 'utf8' });
stream.write('row,col,x,y,z,height,slope,dh_dx,dh_dz,slope_deg,crater_mask,in_crater,nearest_crater_id,nearest_crater_dist,nearest_crater_t\n');

for (let row = 0; row < GRID_RES; row++) {
  for (let col = 0; col < GRID_RES; col++) {
    const idx = row * GRID_RES + col;
    const x = xs[idx];
    const z = zs[idx];

    let nearestId = -1;
    let nearestDist = Number.POSITIVE_INFINITY;
    let nearestT = Number.POSITIVE_INFINITY;

    for (let i = 0; i < CRATERS.length; i++) {
      const c = CRATERS[i];
      const dx = x - c.x;
      const dz = z - c.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const t = dist / c.radius;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestT = t;
        nearestId = i + 1;
      }
    }

    const s = slope[idx];
    const sDeg = Math.atan(s) * (180 / Math.PI);
    const inCrater = cMask[idx] > 0 ? 1 : 0;

    stream.write([
      row,
      col,
      x.toFixed(6),
      hMap[idx].toFixed(6),
      z.toFixed(6),
      hMap[idx].toFixed(6),
      s.toFixed(6),
      dHdx[idx].toFixed(6),
      dHdz[idx].toFixed(6),
      sDeg.toFixed(6),
      cMask[idx].toFixed(6),
      inCrater,
      nearestId,
      nearestDist.toFixed(6),
      nearestT.toFixed(6),
    ].join(',') + '\n');
  }
}

stream.end();
stream.on('finish', () => {
  console.log(`Wrote: ${outPath}`);
  console.log(`Data rows: ${GRID_RES * GRID_RES}`);
});
