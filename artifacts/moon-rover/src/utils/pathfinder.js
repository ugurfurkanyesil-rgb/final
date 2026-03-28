/**
 * Pathfinder - A* with EXTREME crater/slope avoidance.
 * Craters and steep terrain have massive costs so paths strictly avoid them.
 * Always guaranteed to find a path.
 */

import { TERRAIN_SIZE, GRID_RES, getTerrainHeight } from '../three/terrainGenerator.js';

const HALF = TERRAIN_SIZE / 2;

export function worldToGrid(wx, wz) {
  const col = Math.round(((wx + HALF) / TERRAIN_SIZE) * (GRID_RES - 1));
  const row = Math.round(((wz + HALF) / TERRAIN_SIZE) * (GRID_RES - 1));
  return {
    col: Math.max(0, Math.min(GRID_RES - 1, col)),
    row: Math.max(0, Math.min(GRID_RES - 1, row)),
  };
}

export function gridToWorld(col, row) {
  return {
    wx: -HALF + (col / (GRID_RES - 1)) * TERRAIN_SIZE,
    wz: -HALF + (row / (GRID_RES - 1)) * TERRAIN_SIZE,
  };
}

// Binary min-heap
class MinHeap {
  constructor() { this.data = []; }
  push(item) { this.data.push(item); this._up(this.data.length - 1); }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length) { this.data[0] = last; this._down(0); }
    return top;
  }
  get size() { return this.data.length; }
  _up(i) {
    while (i > 0) {
      const p = (i-1)>>1;
      if (this.data[p].f <= this.data[i].f) break;
      [this.data[p],this.data[i]] = [this.data[i],this.data[p]]; i = p;
    }
  }
  _down(i) {
    const n = this.data.length;
    while (true) {
      let min=i, l=2*i+1, r=2*i+2;
      if (l<n && this.data[l].f<this.data[min].f) min=l;
      if (r<n && this.data[r].f<this.data[min].f) min=r;
      if (min===i) break;
      [this.data[min],this.data[i]]=[this.data[i],this.data[min]]; i=min;
    }
  }
}

let _costCache = {};

/**
 * Build traversal cost map.
 * SAFE:  crater=5000 + slope=800  → wide detour around everything
 * ECO:   crater=2000 + slope=600  → avoids craters, prefers gentle slopes
 * FAST:  crater=1500 + slope=200  → avoids craters, accepts minor slopes
 * AUTO:  crater=3000 + slope=500  → balanced
 */
function buildCostMap(mode, slopeMap, craterMask) {
  const cost = new Float32Array(GRID_RES * GRID_RES);

  const params = {
    SAFE: { craterC: 5000, slopeC: 800,  slopeThr: 0.15 },
    ECO:  { craterC: 2000, slopeC: 600,  slopeThr: 0.20 },
    FAST: { craterC: 1500, slopeC: 200,  slopeThr: 0.30 },
    AUTO: { craterC: 3000, slopeC: 500,  slopeThr: 0.22 },
  };
  const p = params[mode] || params.AUTO;

  for (let i = 0; i < GRID_RES * GRID_RES; i++) {
    const slope = slopeMap ? slopeMap[i] : 0;
    const crater = craterMask ? craterMask[i] : 0;

    // Base movement cost
    let c = 1.0;

    // Crater penalty — exponential so interior = extremely costly
    if (crater > 0.05) {
      c += crater * crater * p.craterC;
    }

    // Slope penalty — exponential above threshold
    if (slope > p.slopeThr) {
      const excess = (slope - p.slopeThr) / p.slopeThr;
      c += excess * excess * p.slopeC;
    }

    cost[i] = c;
  }
  return cost;
}

function aStar(startRow, startCol, endRow, endCol, costMap) {
  const N = GRID_RES;
  const key = (r, c) => r * N + c;
  const h = (r, c) => Math.sqrt((r - endRow)**2 + (c - endCol)**2);

  const gScore = new Float32Array(N*N).fill(Infinity);
  const cameFrom = new Int32Array(N*N).fill(-1);
  const visited = new Uint8Array(N*N);

  const sk = key(startRow, startCol);
  gScore[sk] = 0;
  const open = new MinHeap();
  open.push({ f: h(startRow, startCol), row: startRow, col: startCol });

  const DIRS = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];

  while (open.size > 0) {
    const { row, col } = open.pop();
    const k = key(row, col);
    if (visited[k]) continue;
    visited[k] = 1;

    if (row === endRow && col === endCol) {
      const path = [];
      let cur = k;
      while (cur !== -1) {
        const r = Math.floor(cur / N), c = cur % N;
        const { wx, wz } = gridToWorld(c, r);
        path.unshift([wx, getTerrainHeight(wx, wz) + 0.18, wz]);
        cur = cameFrom[cur];
      }
      return path;
    }

    for (const [dr, dc] of DIRS) {
      const nr = row + dr, nc = col + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      const nk = key(nr, nc);
      if (visited[nk]) continue;
      const diag = dr !== 0 && dc !== 0;
      const moveCost = (diag ? 1.414 : 1.0) * costMap[nk];
      const tg = gScore[k] + moveCost;
      if (tg < gScore[nk]) {
        gScore[nk] = tg;
        cameFrom[nk] = k;
        open.push({ f: tg + h(nr, nc), row: nr, col: nc });
      }
    }
  }
  return buildFallback(startRow, startCol, endRow, endCol);
}

function buildFallback(sr, sc, er, ec) {
  const path = [];
  const steps = Math.max(Math.abs(er-sr), Math.abs(ec-sc), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = Math.round(sr + t*(er-sr)), c = Math.round(sc + t*(ec-sc));
    const { wx, wz } = gridToWorld(c, r);
    path.push([wx, getTerrainHeight(wx, wz)+0.18, wz]);
  }
  return path;
}

/** Smooth path using Catmull-Rom style averaging */
function smoothPath(path, passes = 2) {
  if (path.length < 4) return path;
  let pts = [...path];
  for (let pass = 0; pass < passes; pass++) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const px = (pts[i-1][0] + pts[i][0]*2 + pts[i+1][0]) / 4;
      const pz = (pts[i-1][2] + pts[i][2]*2 + pts[i+1][2]) / 4;
      const py = getTerrainHeight(px, pz) + 0.18;
      out.push([px, py, pz]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  // Thin to ~150 pts for rendering
  const step = Math.max(1, Math.floor(pts.length / 150));
  const result = [];
  for (let i = 0; i < pts.length; i += step) result.push(pts[i]);
  if (result[result.length-1] !== pts[pts.length-1]) result.push(pts[pts.length-1]);
  return result;
}

export function planAllRoutes(worldStart, worldEnd, slopeMap, craterMask) {
  const { col: sc, row: sr } = worldToGrid(worldStart.x, worldStart.z);
  const { col: ec, row: er } = worldToGrid(worldEnd.x, worldEnd.z);

  const result = {};
  for (const mode of ['SAFE','ECO','FAST','AUTO']) {
    if (!_costCache[mode]) {
      _costCache[mode] = buildCostMap(mode, slopeMap, craterMask);
    }
    result[mode] = smoothPath(aStar(sr, sc, er, ec, _costCache[mode]));
  }
  return result;
}

export function clearPathCache() { _costCache = {}; }

export function routeStats(path) {
  if (!path || path.length < 2) return { distance: 0, elevGain: 0 };
  let dist = 0, gain = 0;
  for (let i = 1; i < path.length; i++) {
    dist += Math.sqrt((path[i][0]-path[i-1][0])**2 + (path[i][2]-path[i-1][2])**2);
    const dy = path[i][1] - path[i-1][1];
    if (dy > 0) gain += dy;
  }
  return { distance: dist.toFixed(1), elevGain: gain.toFixed(2) };
}
