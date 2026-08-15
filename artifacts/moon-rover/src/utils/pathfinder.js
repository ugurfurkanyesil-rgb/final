/**
 * Pathfinder - A* with crater walls, debris avoidance, illumination-aware costs.
 * Craters are IMPASSABLE walls — rover path can never enter them.
 * Debris is NOT a wall: each zone contributes a distance-attenuated additive
 * cost term to the cost map (see getDebrisField/COST_PARAMS.debrisC), so a
 * route may cross a debris zone when the detour around it is worse, and how
 * strongly it avoids one is a per-mode choice (SAFE detours, FAST cuts through)
 * instead of a hard geometric rule identical in every mode.
 */

import { TERRAIN_SIZE, GRID_RES, getTerrainHeight, CRATERS } from '../three/terrainGenerator.js';

const HALF = TERRAIN_SIZE / 2;

// How far (in grid cells) to search for the nearest open cell when a route
// endpoint lands inside a wall. Must cover the largest crater's wall radius,
// or the search comes back empty, the endpoint stays a wall cell, and A* can
// never reach it (walls are never enterable) — guaranteeing a fallback.
// Craters are now the ONLY wall source, so this is exactly the crater bound it
// always claimed to be. Previously debris zones were walls too and this same
// expression covered them only by accident (the largest crater radius, 17 m,
// happens to dwarf the largest debris radius, 3.5 m); a debris zone larger
// than the biggest crater would have silently broken the guarantee.
const CELL_SIZE = TERRAIN_SIZE / (GRID_RES - 1);
const MAX_WALL_RADIUS_CELLS = Math.ceil((Math.max(...CRATERS.map(c => c.radius)) * 1.05) / CELL_SIZE) + 2;

// Debris avoidance zones (x, z, radius) — centres match
// generateDebrisPositions() in terrainGenerator.js.
// `r` is NOT the debris mesh's physical footprint: the meshes (MoonScene.jsx
// DebrisPanel/Tank/Hull/Strut) span ~0.6–1.8 m, i.e. a half-extent of
// ~0.3–0.9 m, so these radii are 3–8x the physical body. They are hand-tuned
// *avoidance buffers* (keep-out standoff around a wreck), which is why they
// drive a graded cost field rather than a solid collision volume — out at r
// there is nothing physical for the rover to hit.
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

// ---- Impassable map (craters only) ----
// Built once and reused. Cells with value 1 are completely blocked.
// Craters are the ONLY wall source. Debris used to be blocked here too, with
// exactly the crater treatment, which contradicted this file's own header and
// made a 2–3.5 m hand-tuned standoff as absolute as a 17 m crater bowl. It is
// now a cost term instead — see getDebrisField() / COST_PARAMS.debrisC.
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
    }
  }
  return _wallMap;
}

// ---- Debris avoidance field (soft, 0..1) ----
// Per cell: the strongest overlapping zone's penetration depth.
//   pen   = max(0, 1 - d/r)   → 1 at a zone centre, 0 at/outside its edge
//   field = max over zones of pen
// Geometry is unchanged from when debris were walls (same centres, same r), so
// a zone's *extent* of influence is identical; only its edge went from a cliff
// (cost 1e9 at d<r, base cost at d>=r) to a ramp.
//
// Attenuation is LINEAR, not squared like the slope-excess/experience terms.
// pen² was tried first and measurably cannot express "stay out of this zone":
// pen² has zero gradient at d=r, so grazing the boundary from the inside is
// free to first order and a route always prefers hugging the rim to detouring
// around it. Measured on the SAFE mode / (-38,14)→(-26,14) route, closest
// approach to the (-32,14) r=3.5 zone as debrisC → ∞:
//   pen²  debrisC 3400→0.86r, 5000→0.86r, 10000→0.94r, 100000→0.99r  (never clears)
//   pen   debrisC 3000→0.94r, 4500→1.00r, 5000→1.01r                 (clears at 4500)
// Linear also keeps a mode's cheap-to-tune working range roughly one order of
// magnitude wide instead of collapsing everything into a bifurcation.
// Same lazy-build/reset lifecycle as _wallMap (see clearPathCache).
//
// debrisPenetration() is the single definition of the field; getDebrisField()
// is just its GRID_RES² sampling for the cost map, and smoothPath() calls it
// directly at continuous world coordinates (where cell sampling is too coarse
// to see the drift it has to prevent). One formula, two sampling rates.
function debrisPenetration(wx, wz) {
  let maxPen = 0;
  for (const dz of DEBRIS_ZONES) {
    const d = Math.sqrt((wx - dz.x) ** 2 + (wz - dz.z) ** 2);
    const pen = 1 - d / dz.r;
    if (pen > maxPen) maxPen = pen;
  }
  return maxPen > 0 ? maxPen : 0;
}

let _debrisField = null;
function getDebrisField() {
  if (_debrisField) return _debrisField;
  _debrisField = new Float32Array(GRID_RES * GRID_RES);
  for (let row = 0; row < GRID_RES; row++) {
    for (let col = 0; col < GRID_RES; col++) {
      _debrisField[row * GRID_RES + col] = debrisPenetration(
        -HALF + (col / (GRID_RES - 1)) * TERRAIN_SIZE,
        -HALF + (row / (GRID_RES - 1)) * TERRAIN_SIZE,
      );
    }
  }
  return _debrisField;
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
//
// debrisC deliberately does NOT copy expC's ~4.7:1 SAFE:FAST ratio. expC
// scales against slopeC — the same map — so a fixed ratio is the whole story
// there. debrisC instead competes against the *base cell cost of the terrain
// at a specific debris zone*, and that base cost is wildly non-uniform: it
// varies ~45x between the ten zones and ~6x between modes at the same zone.
// Break-even (the coefficient at which cutting a zone along a diameter costs
// exactly what walking around its edge costs) for the linear field:
//   through: 2r·b + debrisC·∫(1-|s|/r) ds = 2r·b + debrisC·r
//   around:  2r·b + b·(π-2)r                (chord 2r → semicircle πr)
//   ⇒ debrisC* = (π-2)·b ≈ 1.142·b
// so break-even is 10 for FAST at the (-4,30) zone and 532 for SAFE at the
// (-32,14) zone. No single ratio can be right everywhere; the values below are
// therefore set from *measured route behaviour*, not from a ratio:
//   SAFE 5000 — clears every zone entirely (closest approach >= r on all
//               probe routes; measured threshold is 4500). This reproduces
//               the pre-migration wall behaviour: SAFE routes are unchanged.
//   ECO   150 — skirts: stays out of a zone's core, accepts the fringe.
//   AUTO   80 — same, weaker (closest approach 0.47r vs ECO's 0.55r at the
//               (-32,14) zone).
//   FAST    5 — below break-even everywhere it matters; cuts straight through
//               (closest approach 0.01r at (-4,30), 0.20r at (-32,14)).
// Ordering SAFE > ECO > AUTO > FAST matches every other coefficient in this
// table. The spread is ~1000:1 rather than expC's 4.7:1 because SAFE's target
// is qualitatively different (full clearance ≈ a wall) — see the measurement
// table in the debris-cost-migration work notes.
const COST_PARAMS = {
  SAFE: { slopeC: 900, slopeThr: 0.12, illumC: 120, expC: 700, debrisC: 5000 },
  ECO:  { slopeC: 650, slopeThr: 0.18, illumC: 80,  expC: 450, debrisC: 150 },
  FAST: { slopeC: 200, slopeThr: 0.28, illumC: 20,  expC: 150, debrisC: 5 },
  AUTO: { slopeC: 550, slopeThr: 0.18, illumC: 100, expC: 400, debrisC: 80 },
};

function buildCostMap(mode, slopeMap, craterMask, illumMap, experienceMap) {
  const p = COST_PARAMS[mode] || COST_PARAMS.AUTO;
  const wall = getWallMap();
  const debrisField = getDebrisField();
  const cost = new Float32Array(GRID_RES * GRID_RES);

  for (let i = 0; i < GRID_RES * GRID_RES; i++) {
    // Walls are completely impassable — assign near-infinite cost
    if (wall[i]) { cost[i] = 1e9; continue; }

    const slope  = slopeMap  ? slopeMap[i]  : 0;
    const crater = craterMask? craterMask[i] : 0;
    const illum  = illumMap  ? illumMap[i]   : 0.5;
    const exp    = experienceMap ? experienceMap[i] : 0;
    const df     = debrisField[i];

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
    // Debris avoidance — additive, like the experience term, never replacing
    // the terrain cost. `df` is the penetration depth 0..1 (getDebrisField),
    // so this is the whole term. It is exactly zero outside every zone, which
    // means every cell untouched by debris keeps a byte-identical cost to
    // before debris became a cost term (verified: 0 differing cells out of
    // 64001 zero-field cells, in all four modes).
    if (df > 0) c += df * p.debrisC;
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
// so the emergency path — like the real A* path — never crosses a crater
// wall; that is the one guarantee this file makes, and it holds here too.
// It ignores the cost map entirely, and therefore also ignores debris: an
// emergency escape route may run straight through a debris zone. That is
// acceptable precisely because debris is a preference, not a hard constraint
// (unlike before, when debris were walls and this BFS did avoid them).
// If the goal itself is unreachable from the start (disjoint pocket), walks
// to the closest reachable open cell instead of lying about having found a
// route. Ignores costMap/mode, same as before, since this is a last-resort
// escape path, not a mode-optimized one.
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

// This runs AFTER A*, on the raw cell path, and it does not consult the cost
// map — so anything the cost map expresses can be smoothed away. Both guards
// below exist for that reason.
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
      // Don't smooth deeper into a debris zone. A [1,2,1]/4 kernel pulls a
      // detour arc toward its chord, so where A* routed around a zone the
      // smoother would shave the corner back into it — invisible to the wall
      // guard above, since debris stopped being a wall. Measured before this
      // guard existed: on 960 route/mode cases whose straight line crosses a
      // zone, smoothing increased peak penetration in 7.2% of them, by up to
      // 0.04·r; with it, 0%.
      // Evaluated at the exact world position, not via getDebrisField()'s
      // grid: the drift being guarded against is ~0.1 m, well under one
      // 0.39 m cell, so a cell lookup returns the same value for the old and
      // new point and the guard would never fire (verified — a cell-sampled
      // version of this check left all 69 regressions in place).
      if (debrisPenetration(px, pz) > debrisPenetration(pts[i][0], pts[i][2])) { out.push(pts[i]); continue; }
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
//
// debrisCost is the same idea for the debris term: read from the very same
// getDebrisField() array buildCostMap() summed into costMap and multiplied by
// the same per-mode debrisC, so it is a true breakdown of totalCost rather
// than a re-derived approximation. Pass debrisC to enable it.
function computeRouteStats(path, slopeMap, craterMask, illumMap, costMap, experienceMap, expC, debrisC) {
  if (!path || path.length < 2) return null;
  const debrisField = getDebrisField();
  let dist=0, sumHazard=0, sumSlip=0, sumSlope=0, sumIllum=0, totalCost=0, expCost=0, debrisCost=0, n=0;
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
    const df = debrisField[k];
    if (df > 0 && debrisC) debrisCost += df * debrisC;
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
    debrisCost:        debrisCost,
    debrisCostPercent: totalCost > 0 ? (debrisCost / totalCost) * 100 : 0,
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
    const params  = COST_PARAMS[mode] || COST_PARAMS.AUTO;
    const stats   = computeRouteStats(path, slopeMap, craterMask, illumMap, _costCache[cacheKey], experienceMap, params.expC, params.debrisC);
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

export function clearPathCache() { _costCache = {}; _illumCache = {}; _wallMap = null; _debrisField = null; }

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
