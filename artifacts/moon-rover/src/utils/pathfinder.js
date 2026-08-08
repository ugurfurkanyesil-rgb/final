/**
 * Pathfinder - A* with crater walls, debris avoidance, illumination-aware costs.
 * Craters are IMPASSABLE walls — rover path can never enter them.
 * Debris objects have exclusion zones added to the cost map.
 */

import { TERRAIN_SIZE, GRID_RES, getTerrainHeight, CRATERS } from '../three/terrainGenerator.js';

const HALF = TERRAIN_SIZE / 2;

// How far (in grid cells) to search for the nearest open cell when a route
// endpoint lands inside a wall. Must cover the largest crater's wall radius,
// or the search comes back empty, the endpoint stays a wall cell, and A* can
// never reach it (walls are never enterable) — guaranteeing a fallback.
const CELL_SIZE = TERRAIN_SIZE / (GRID_RES - 1);
const MAX_WALL_RADIUS_CELLS = Math.ceil((Math.max(...CRATERS.map(c => c.radius)) * 1.05) / CELL_SIZE) + 2;

// Debris positions (x, z, radius) — match generateDebrisPositions() in terrainGenerator.js
const DEBRIS_ZONES = [
  { x: -32, z:  14, r: 3.5 },
  { x:  28, z: -42, r: 2.5 },
  { x: -14, z: -30, r: 3.0 },
  { x:  44, z:  20, r: 2.0 },
  { x:  -4, z:  30, r: 3.5 },
  { x:  18, z:  48, r: 2.5 },
  { x: -46, z:  -4, r: 2.5 },
  { x:  38, z: -44, r: 3.0 },
  { x: -24, z:  46, r: 2.0 },
  { x:   8, z: -44, r: 2.5 },
];

export function worldToGrid(wx, wz) {
  const col = Math.round(((wx + HALF) / TERRAIN_SIZE) * (GRID_RES - 1));
  const row = Math.round(((wz + HALF) / TERRAIN_SIZE) * (GRID_RES - 1));
  return { col: Math.max(0, Math.min(GRID_RES - 1, col)), row: Math.max(0, Math.min(GRID_RES - 1, row)) };
}
export function gridToWorld(col, row) {
  return { wx: -HALF + (col / (GRID_RES - 1)) * TERRAIN_SIZE, wz: -HALF + (row / (GRID_RES - 1)) * TERRAIN_SIZE };
}

// ---- Binary Min-Heap ----
class MinHeap {
  constructor() { this.data = []; }
  push(item) { this.data.push(item); this._up(this.data.length - 1); }
  pop() {
    const top = this.data[0]; const last = this.data.pop();
    if (this.data.length) { this.data[0] = last; this._down(0); }
    return top;
  }
  get size() { return this.data.length; }
  _up(i) {
    while (i > 0) { const p=(i-1)>>1; if (this.data[p].f<=this.data[i].f) break; [this.data[p],this.data[i]]=[this.data[i],this.data[p]]; i=p; }
  }
  _down(i) {
    const n=this.data.length;
    while(true){ let m=i,l=2*i+1,r=2*i+2; if(l<n&&this.data[l].f<this.data[m].f)m=l; if(r<n&&this.data[r].f<this.data[m].f)m=r; if(m===i)break; [this.data[m],this.data[i]]=[this.data[i],this.data[m]]; i=m; }
  }
}

// ---- Illumination Map ----
let _illumCache = {};

export function buildIlluminationMap(sunAngleDeg, hMap) {
  const key = Math.round(sunAngleDeg);
  if (_illumCache[key]) return _illumCache[key];

  const illum = new Float32Array(GRID_RES * GRID_RES);
  const sunRad = (sunAngleDeg * Math.PI) / 180;
  const lx = Math.sin(sunRad), lz = -Math.cos(sunRad), ly = 0.80;
  const lLen = Math.sqrt(lx*lx + ly*ly + lz*lz);
  const nlx = lx/lLen, nly = ly/lLen, nlz = lz/lLen;
  const cellSize = TERRAIN_SIZE / (GRID_RES - 1);

  for (let row = 1; row < GRID_RES-1; row++) {
    for (let col = 1; col < GRID_RES-1; col++) {
      const dX = (hMap[row*GRID_RES+col+1] - hMap[row*GRID_RES+col-1]) / (2*cellSize);
      const dZ = (hMap[(row+1)*GRID_RES+col] - hMap[(row-1)*GRID_RES+col]) / (2*cellSize);
      const nx=-dX, ny=1.0, nz=-dZ;
      const nLen = Math.sqrt(nx*nx+ny*ny+nz*nz);
      illum[row*GRID_RES+col] = Math.max(0, (nx/nLen)*nlx + (ny/nLen)*nly + (nz/nLen)*nlz);
    }
  }
  _illumCache[key] = illum;
  return illum;
}

// ---- Impassable map (craters = walls, debris = obstacles) ----
// Built once and reused. Cells with value true are completely blocked.
let _wallMap = null;
function getWallMap() {
  if (_wallMap) return _wallMap;
  _wallMap = new Uint8Array(GRID_RES * GRID_RES);
  for (let row = 0; row < GRID_RES; row++) {
    for (let col = 0; col < GRID_RES; col++) {
      const wx = -HALF + (col / (GRID_RES - 1)) * TERRAIN_SIZE;
      const wz = -HALF + (row / (GRID_RES - 1)) * TERRAIN_SIZE;

      // Crater interior + rim = impassable wall (full bowl + steep rim walls)
      for (const c of CRATERS) {
        const d = Math.sqrt((wx - c.x) ** 2 + (wz - c.z) ** 2);
        if (d < c.radius * 1.05) { _wallMap[row * GRID_RES + col] = 1; break; }
      }

      // Debris exclusion zones
      if (!_wallMap[row * GRID_RES + col]) {
        for (const dz of DEBRIS_ZONES) {
          const d = Math.sqrt((wx - dz.x) ** 2 + (wz - dz.z) ** 2);
          if (d < dz.r) { _wallMap[row * GRID_RES + col] = 1; break; }
        }
      }
    }
  }
  return _wallMap;
}

// ---- Cost Maps ----
let _costCache = {};

// expC follows the same ~0.7-0.75× ratio to slopeC in every mode (SAFE
// weighs learned-bad cells almost as heavily as slope, FAST barely at all),
// so adding the experience term doesn't shift the existing SAFE/ECO/FAST/AUTO
// balance — it scales with it.
// Hoisted to module scope (not just local to buildCostMap) so
// computeRouteStats/planAllRoutes can look up the same per-mode expC when
// reporting how much of a route's cost came from learned experience —
// single source of truth, no duplicated coefficients.
const COST_PARAMS = {
  SAFE: { slopeC: 900, slopeThr: 0.12, illumC: 120, expC: 700 },
  ECO:  { slopeC: 650, slopeThr: 0.18, illumC: 80,  expC: 450 },
  FAST: { slopeC: 200, slopeThr: 0.28, illumC: 20,  expC: 150 },
  AUTO: { slopeC: 550, slopeThr: 0.18, illumC: 100, expC: 400 },
};

function buildCostMap(mode, slopeMap, craterMask, illumMap, experienceMap) {
  const p = COST_PARAMS[mode] || COST_PARAMS.AUTO;
  const wall = getWallMap();
  const cost = new Float32Array(GRID_RES * GRID_RES);

  for (let i = 0; i < GRID_RES * GRID_RES; i++) {
    // Walls are completely impassable — assign near-infinite cost
    if (wall[i]) { cost[i] = 1e9; continue; }

    const slope  = slopeMap  ? slopeMap[i]  : 0;
    const crater = craterMask? craterMask[i] : 0;
    const illum  = illumMap  ? illumMap[i]   : 0.5;
    const exp    = experienceMap ? experienceMap[i] : 0;

    let c = 1.0;
    // Crater rim / near-crater still expensive
    if (crater > 0.05) c += crater * crater * 3500;
    if (slope > p.slopeThr) { const ex = (slope-p.slopeThr)/p.slopeThr; c += ex*ex*p.slopeC; }
    c += (1.0 - illum) * p.illumC;
    // Learned-experience penalty — additive term on top of the terrain-only
    // cost above, never replacing it. `exp` is the EMA'd difficulty from
    // LearningModel.recordTraversal() (learningModel.js), 0 = never
    // traversed / always easy, up to 1 = consistently rough. Squared like
    // the slope-excess term so mildly-bad cells get a small nudge and
    // consistently-bad cells are strongly steered around. Zero when no
    // experienceMap is passed (or a cell has none), so callers that don't
    // pass one see byte-identical costs to before this term existed.
    if (exp > 0) c += exp * exp * p.expC;
    cost[i] = c;
  }
  return cost;
}

// ---- A* Core ----
// Returns null if goal is a wall (no path possible).
function aStar(sr, sc, er, ec, costMap) {
  const N = GRID_RES;
  const ek = er*N+ec;

  // If goal is a wall, find nearest non-wall grid cell
  const wall = getWallMap();
  let actualEr = er, actualEc = ec;
  if (wall[ek]) {
    let best = Infinity, br = er, bc = ec;
    for (let dr = -MAX_WALL_RADIUS_CELLS; dr <= MAX_WALL_RADIUS_CELLS; dr++) {
      for (let dc = -MAX_WALL_RADIUS_CELLS; dc <= MAX_WALL_RADIUS_CELLS; dc++) {
        const nr = er+dr, nc = ec+dc;
        if (nr<0||nr>=N||nc<0||nc>=N) continue;
        if (wall[nr*N+nc]) continue;
        const d = Math.sqrt(dr*dr+dc*dc);
        if (d < best) { best=d; br=nr; bc=nc; }
      }
    }
    actualEr = br; actualEc = bc;
  }

  const h = (r,c) => Math.sqrt((r-actualEr)**2+(c-actualEc)**2);
  const gScore = new Float32Array(N*N).fill(Infinity);
  const cameFrom = new Int32Array(N*N).fill(-1);
  const visited = new Uint8Array(N*N);
  const sk = sr*N+sc;
  gScore[sk] = 0;
  const open = new MinHeap();
  open.push({ f: h(sr,sc), row:sr, col:sc });
  const DIRS = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];

  while (open.size > 0) {
    const { row, col } = open.pop();
    const k = row*N+col;
    if (visited[k]) continue;
    visited[k] = 1;
    if (row===actualEr && col===actualEc) {
      const path = [];
      let cur = k;
      while (cur !== -1) {
        const r=Math.floor(cur/N), c=cur%N;
        const { wx, wz } = gridToWorld(c, r);
        path.unshift([wx, getTerrainHeight(wx,wz)+0.18, wz]);
        cur = cameFrom[cur];
      }
      return path;
    }
    for (const [dr,dc] of DIRS) {
      const nr=row+dr, nc=col+dc;
      if (nr<0||nr>=N||nc<0||nc>=N) continue;
      const nk=nr*N+nc;
      if (visited[nk]) continue;
      if (wall[nk]) continue; // Skip walls entirely
      const diag = dr!==0&&dc!==0;
      const tg = gScore[k] + (diag?1.414:1.0)*costMap[nk];
      if (tg < gScore[nk]) {
        gScore[nk]=tg; cameFrom[nk]=k;
        open.push({ f:tg+h(nr,nc), row:nr, col:nc });
      }
    }
  }
  return _fallback(sr,sc,actualEr,actualEc);
}

// Wall-safe fallback: only reached when A* exhausts its open set without
// hitting the goal (e.g. the start is boxed in by overlapping crater walls
// with no open neighbor at all). Does an unweighted BFS over non-wall cells
// so the emergency path — like the real A* path — never crosses a crater or
// debris wall. If the goal itself is unreachable from the start (disjoint
// pocket), walks to the closest reachable open cell instead of lying about
// having found a route. Ignores costMap/mode, same as before, since this is
// a last-resort escape path, not a mode-optimized one.
function _fallback(sr,sc,er,ec) {
  const N = GRID_RES;
  const wall = getWallMap();
  const sk = sr*N+sc, ek = er*N+ec;
  const cameFrom = new Int32Array(N*N).fill(-1);
  const visited = new Uint8Array(N*N);
  const DIRS = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];

  const queue = [sk];
  visited[sk] = 1;
  let closest = sk, closestDist = Math.hypot(sr-er, sc-ec);
  for (let qi = 0; qi < queue.length; qi++) {
    const k = queue[qi];
    const r = Math.floor(k / N), c = k % N;
    const d = Math.hypot(r-er, c-ec);
    if (d < closestDist) { closestDist = d; closest = k; }
    if (k === ek) break;
    for (const [dr,dc] of DIRS) {
      const nr=r+dr, nc=c+dc;
      if (nr<0||nr>=N||nc<0||nc>=N) continue;
      const nk = nr*N+nc;
      if (visited[nk] || wall[nk]) continue;
      visited[nk] = 1;
      cameFrom[nk] = k;
      queue.push(nk);
    }
  }

  const target = visited[ek] ? ek : closest;
  const path = [];
  for (let cur = target; cur !== -1; cur = cameFrom[cur]) {
    const r = Math.floor(cur / N), c = cur % N;
    const { wx, wz } = gridToWorld(c, r);
    path.unshift([wx, getTerrainHeight(wx,wz)+0.18, wz]);
  }
  return path;
}

function smoothPath(path, passes=3) {
  if (path.length < 4) return path;
  const wall = getWallMap();
  let pts = [...path];
  for (let p=0; p<passes; p++) {
    const out = [pts[0]];
    for (let i=1; i<pts.length-1; i++) {
      const px=(pts[i-1][0]+pts[i][0]*2+pts[i+1][0])/4;
      const pz=(pts[i-1][2]+pts[i][2]*2+pts[i+1][2])/4;
      // Don't smooth into a wall
      const { col, row } = worldToGrid(px, pz);
      if (wall[row*GRID_RES+col]) { out.push(pts[i]); continue; }
      out.push([px, getTerrainHeight(px,pz)+0.18, pz]);
    }
    out.push(pts[pts.length-1]);
    pts = out;
  }
  const step = Math.max(1, Math.floor(pts.length/200));
  const result = [];
  for (let i=0; i<pts.length; i+=step) result.push(pts[i]);
  if (result[result.length-1] !== pts[pts.length-1]) result.push(pts[pts.length-1]);
  return result;
}

// ---- Route Stats ----
// costMap is the same per-mode cost grid the A* search actually used (see
// buildCostMap), so totalCost reflects the real routing cost instead of a
// separately-hardcoded approximation of it.
//
// experienceMap/expC (both optional) let this also report how much of that
// totalCost came specifically from the learned-experience term — recomputed
// per path cell with the exact same `exp*exp*expC` formula buildCostMap
// used, so expCost/expCostPercent are a real breakdown of totalCost, not a
// separate estimate. Omit either arg to skip the breakdown (expCost stays 0).
function computeRouteStats(path, slopeMap, craterMask, illumMap, costMap, experienceMap, expC) {
  if (!path || path.length < 2) return null;
  let dist=0, sumHazard=0, sumSlip=0, sumSlope=0, sumIllum=0, totalCost=0, expCost=0, n=0;
  for (let i=1; i<path.length; i++) {
    const dx=path[i][0]-path[i-1][0], dz=path[i][2]-path[i-1][2];
    dist += Math.sqrt(dx*dx+dz*dz);
    const { col, row } = worldToGrid(path[i][0], path[i][2]);
    const k = row*GRID_RES+col;
    const slope  = slopeMap?.[k]  ?? 0;
    const crater = craterMask?.[k] ?? 0;
    const illum  = illumMap?.[k]  ?? 0.5;
    const exp    = experienceMap?.[k] ?? 0;
    sumHazard += hazardScore(crater, slope);
    sumSlip   += Math.min(1, slope*1.5 + crater*0.3);
    sumSlope  += Math.atan(slope)*180/Math.PI;
    sumIllum  += illum;
    totalCost += costMap ? costMap[k] : 1;
    if (exp > 0 && expC) expCost += exp * exp * expC;
    n++;
  }
  const avg = x => n ? x/n : 0;
  return {
    distance:          dist,
    avgHazard:         avg(sumHazard),
    avgSlip:           avg(sumSlip),
    avgSlopeAngle:     avg(sumSlope),
    avgIllumination:   avg(sumIllum),
    avgTraversability: 1 - avg(sumHazard),
    totalCost:         totalCost,
    expCost:           expCost,
    expCostPercent:    totalCost > 0 ? (expCost / totalCost) * 100 : 0,
    riskPercent:       (avg(sumHazard) + avg(sumSlip)) / 2 * 100,
  };
}

// ---- Chain Pathfinding ----
function chainAStar(waypoints, costMap) {
  const fullPath = [];
  for (let i=0; i<waypoints.length-1; i++) {
    const { col:sc, row:sr } = worldToGrid(waypoints[i].x, waypoints[i].z);
    const { col:ec, row:er } = worldToGrid(waypoints[i+1].x, waypoints[i+1].z);
    const seg = aStar(sr,sc,er,ec, costMap);
    if (i===0) fullPath.push(...seg);
    else fullPath.push(...seg.slice(1));
  }
  return fullPath;
}

// ---- Main Export ----
// experienceMap: optional Float32Array (GRID_RES×GRID_RES, same layout as
// slopeMap/craterMask) from LearningModel.getExperienceMap() — see
// buildCostMap()'s experience-penalty term. Omit/pass null to plan without it
// (existing callers keep their old behaviour unchanged).
export function planAllRoutes(waypoints, slopeMap, craterMask, hMap, sunAngleDeg = 45, experienceMap = null) {
  if (!waypoints || waypoints.length < 2) throw new Error('Need at least 2 waypoints');

  const illumMap = hMap ? buildIlluminationMap(sunAngleDeg, hMap) : null;

  const result = {};
  for (const mode of ['SAFE','ECO','FAST','AUTO']) {
    const cacheKey = `${mode}_${Math.round(sunAngleDeg)}`;
    if (!_costCache[cacheKey]) {
      // Not keyed on experienceMap — the cache is invalidated wholesale by
      // clearPathCache(), which LearningModel.recordTraversal() already
      // calls every 50 traversals, so cost maps get periodically rebuilt
      // with the latest learned experience without recomputing on every
      // single traversal.
      _costCache[cacheKey] = buildCostMap(mode, slopeMap, craterMask, illumMap, experienceMap);
    }
    const rawPath = chainAStar(waypoints, _costCache[cacheKey]);
    const path    = smoothPath(rawPath);
    const expC    = (COST_PARAMS[mode] || COST_PARAMS.AUTO).expC;
    const stats   = computeRouteStats(path, slopeMap, craterMask, illumMap, _costCache[cacheKey], experienceMap, expC);
    result[mode]  = { path, stats };

    // Debug visibility into the experience-map integration: how much of
    // this route's total A* cost came from previously-learned-bad cells.
    // Only logs when an experienceMap was actually passed in, so callers
    // that don't use learning stay silent. See buildCostMap()'s expC term
    // and decisions/2026-08-08-deneyim-haritasi-maliyet-entegrasyonu.md.
    if (experienceMap && stats) {
      console.log(
        `[LearningModel] ${mode}: totalCost=${stats.totalCost.toFixed(1)}, ` +
        `experience contribution=${stats.expCost.toFixed(1)} ` +
        `(${stats.expCostPercent.toFixed(1)}% of route cost)`
      );
    }
  }
  return result;
}

export function clearPathCache() { _costCache = {}; _illumCache = {}; _wallMap = null; }

/**
 * Canonical hazard formula (0=safe, 1=very dangerous).
 * Single source of truth — used by getHazardAtPoint, computeRouteStats
 * (avgHazard/avgTraversability/riskPercent), and the heatmap 'Hazard Score' /
 * 'Traversability' layers, so all three views of "how dangerous is this cell"
 * agree with each other and with the waypoint-acceptance thresholds in App.jsx.
 */
export function hazardScore(crater, slope) {
  return Math.min(1, crater * 1.0 + Math.max(0, slope - 0.25) * 2.0);
}

/** Check how hazardous a world position is (0=safe, 1=very dangerous) */
export function getHazardAtPoint(wx, wz, craterMask, slopeMap) {
  const { col, row } = worldToGrid(wx, wz);
  const k = row * GRID_RES + col;
  const crater = craterMask?.[k] ?? 0;
  const slope  = slopeMap?.[k]  ?? 0;
  return hazardScore(crater, slope);
}
