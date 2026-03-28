/**
 * Pathfinder - A* based route planning with 4 modes
 * Guaranteed to always find a path (costs never infinite).
 *
 * Modes:
 *   SAFE  - maximise distance from craters and slopes
 *   ECO   - minimise elevation change (energy efficient)
 *   FAST  - minimise Euclidean distance
 *   AUTO  - balanced multi-objective
 */

import { TERRAIN_SIZE, GRID_RES, getTerrainHeight } from '../three/terrainGenerator.js';

const HALF = TERRAIN_SIZE / 2;

// --- Coordinate helpers ---
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

// --- Binary Min-Heap (priority queue for A*) ---
class MinHeap {
  constructor() { this.data = []; }
  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length) { this.data[0] = last; this._sinkDown(0); }
    return top;
  }
  get size() { return this.data.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].f <= this.data[i].f) break;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
      i = p;
    }
  }
  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let min = i, l = 2*i+1, r = 2*i+2;
      if (l < n && this.data[l].f < this.data[min].f) min = l;
      if (r < n && this.data[r].f < this.data[min].f) min = r;
      if (min === i) break;
      [this.data[min], this.data[i]] = [this.data[i], this.data[min]];
      i = min;
    }
  }
}

// --- Cost maps (cached) ---
let _costCache = {};

function buildCostMap(mode, slopeMap, craterMask) {
  const cost = new Float32Array(GRID_RES * GRID_RES);
  for (let row = 0; row < GRID_RES; row++) {
    for (let col = 0; col < GRID_RES; col++) {
      const idx = row * GRID_RES + col;
      const slope = slopeMap ? slopeMap[idx] : 0;
      const crater = craterMask ? craterMask[idx] : 0;
      // Base cost always ≥ 1 — ensures path always found
      let c = 1.0;
      switch (mode) {
        case 'SAFE':
          // Heavy penalty for craters and slopes
          c += crater * 80 + slope * 25;
          break;
        case 'ECO':
          // Prefer flat, slight crater avoidance
          c += crater * 20 + slope * 40;
          break;
        case 'FAST':
          // Minimal penalties — shortest path
          c += crater * 15 + slope * 5;
          break;
        case 'AUTO':
          // Balanced
          c += crater * 40 + slope * 15;
          break;
      }
      cost[idx] = c;
    }
  }
  return cost;
}

// --- A* search ---
function aStar(startRow, startCol, endRow, endCol, costMap) {
  const N = GRID_RES;
  const key = (r, c) => r * N + c;
  const heuristic = (r, c) => Math.sqrt((r - endRow) ** 2 + (c - endCol) ** 2);

  const gScore = new Float32Array(N * N).fill(Infinity);
  const fScore = new Float32Array(N * N).fill(Infinity);
  const cameFrom = new Int32Array(N * N).fill(-1);
  const visited = new Uint8Array(N * N);

  const startKey = key(startRow, startCol);
  gScore[startKey] = 0;
  fScore[startKey] = heuristic(startRow, startCol);

  const open = new MinHeap();
  open.push({ f: fScore[startKey], row: startRow, col: startCol });

  // 8-directional movement
  const DIRS = [
    [-1,0],[1,0],[0,-1],[0,1],
    [-1,-1],[-1,1],[1,-1],[1,1]
  ];
  const DIAG_MULT = Math.SQRT2;

  while (open.size > 0) {
    const { row, col } = open.pop();
    const k = key(row, col);
    if (visited[k]) continue;
    visited[k] = 1;

    if (row === endRow && col === endCol) {
      // Reconstruct path
      const path = [];
      let cur = k;
      while (cur !== -1) {
        const r = Math.floor(cur / N);
        const c = cur % N;
        const { wx, wz } = gridToWorld(c, r);
        const wy = getTerrainHeight(wx, wz);
        path.unshift([wx, wy + 0.15, wz]);
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
      const moveCost = (diag ? DIAG_MULT : 1.0) * costMap[nk];
      const tentativeG = gScore[k] + moveCost;
      if (tentativeG < gScore[nk]) {
        gScore[nk] = tentativeG;
        fScore[nk] = tentativeG + heuristic(nr, nc);
        cameFrom[nk] = k;
        open.push({ f: fScore[nk], row: nr, col: nc });
      }
    }
  }

  // Fallback: straight line (should never reach here given cost >= 1)
  return buildFallbackPath(startRow, startCol, endRow, endCol);
}

/** Straight-line fallback — guaranteed path */
function buildFallbackPath(sr, sc, er, ec) {
  const path = [];
  const steps = Math.max(Math.abs(er - sr), Math.abs(ec - sc), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = Math.round(sr + t * (er - sr));
    const c = Math.round(sc + t * (ec - sc));
    const { wx, wz } = gridToWorld(c, r);
    path.push([wx, getTerrainHeight(wx, wz) + 0.15, wz]);
  }
  return path;
}

/** Smooth a path by removing redundant collinear points */
function smoothPath(path, factor = 3) {
  if (path.length <= 2) return path;
  const result = [path[0]];
  for (let i = factor; i < path.length - factor; i += factor) {
    result.push(path[i]);
  }
  result.push(path[path.length - 1]);
  return result;
}

/**
 * Plan all 4 routes from worldStart to worldEnd.
 * @returns {{ SAFE, ECO, FAST, AUTO }} — each is array of [x,y,z] points
 */
export function planAllRoutes(worldStart, worldEnd, slopeMap, craterMask) {
  const { col: sc, row: sr } = worldToGrid(worldStart.x, worldStart.z);
  const { col: ec, row: er } = worldToGrid(worldEnd.x, worldEnd.z);

  const modes = ['SAFE', 'ECO', 'FAST', 'AUTO'];
  const result = {};

  for (const mode of modes) {
    const costKey = mode;
    if (!_costCache[costKey]) {
      _costCache[costKey] = buildCostMap(mode, slopeMap, craterMask);
    }
    const rawPath = aStar(sr, sc, er, ec, _costCache[costKey]);
    result[mode] = smoothPath(rawPath, mode === 'FAST' ? 4 : 3);
  }

  return result;
}

/** Clear cost cache (call when terrain changes) */
export function clearPathCache() {
  _costCache = {};
}

/** Compute route statistics */
export function routeStats(path) {
  if (!path || path.length < 2) return { distance: 0, elevGain: 0, hazard: 0 };
  let dist = 0, gain = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i][0] - path[i-1][0];
    const dy = path[i][1] - path[i-1][1];
    const dz = path[i][2] - path[i-1][2];
    dist += Math.sqrt(dx*dx + dz*dz);
    if (dy > 0) gain += dy;
  }
  return { distance: dist.toFixed(1), elevGain: gain.toFixed(2) };
}
