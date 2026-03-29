/**
 * Dust Hazard Utilities
 * Route-vs-hazard intersection check using exact point-to-segment distance.
 * No external dependencies — pure math.
 */

/**
 * Minimum distance from point (px, pz) to the finite line segment (ax,az)→(bx,bz).
 * @param {number} px
 * @param {number} pz
 * @param {number} ax
 * @param {number} az
 * @param {number} bx
 * @param {number} bz
 * @returns {number}
 */
export function pointToSegmentDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) {
    // Degenerate segment — distance to the single point
    return Math.sqrt((px - ax) ** 2 + (pz - az) ** 2);
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  const closestX = ax + t * dx;
  const closestZ = az + t * dz;
  return Math.sqrt((px - closestX) ** 2 + (pz - closestZ) ** 2);
}

/**
 * Returns true if any segment of routePath passes within hazard.radius of the hazard centre.
 *
 * @param {Array<[number, number, number]>} routePath  Array of world-space [x, y, z] points
 * @param {{ x: number, z: number, radius: number }}  hazard
 * @returns {boolean}
 */
export function checkRouteIntersectsHazard(routePath, hazard) {
  if (!routePath || routePath.length < 2 || !hazard) return false;
  const { x: hx, z: hz, radius } = hazard;
  for (let i = 0; i < routePath.length - 1; i++) {
    const [ax, , az] = routePath[i];
    const [bx, , bz] = routePath[i + 1];
    if (pointToSegmentDist(hx, hz, ax, az, bx, bz) < radius) return true;
  }
  return false;
}
