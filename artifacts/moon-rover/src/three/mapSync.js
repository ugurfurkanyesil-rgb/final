/**
 * Map Sync Utilities
 * Converts 3D world coordinates to 2D mini-map pixel coordinates
 * and provides helpers for drawing the map.
 */

const TERRAIN_SIZE = 200;

/**
 * Normalize a world (x, z) coordinate to 0..1 range.
 * @param {number} worldX
 * @param {number} worldZ
 * @returns {{u: number, v: number}}
 */
export function worldToMapUV(worldX, worldZ) {
  const u = (worldX + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
  const v = (worldZ + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
  return {
    u: Math.max(0, Math.min(1, u)),
    v: Math.max(0, Math.min(1, v)),
  };
}

/**
 * Convert normalized UV to canvas pixel coordinates.
 * @param {number} u
 * @param {number} v
 * @param {number} mapWidth
 * @param {number} mapHeight
 * @returns {{px: number, py: number}}
 */
export function uvToPixel(u, v, mapWidth, mapHeight) {
  return {
    px: u * mapWidth,
    py: v * mapHeight,
  };
}

/**
 * Direct world → pixel conversion.
 * @param {number} worldX
 * @param {number} worldZ
 * @param {number} mapWidth
 * @param {number} mapHeight
 * @returns {{px: number, py: number}}
 */
export function worldToMapPixel(worldX, worldZ, mapWidth, mapHeight) {
  const { u, v } = worldToMapUV(worldX, worldZ);
  return uvToPixel(u, v, mapWidth, mapHeight);
}

/**
 * Converts a map pixel click back to a world coordinate.
 * @param {number} px
 * @param {number} py
 * @param {number} mapWidth
 * @param {number} mapHeight
 * @returns {{worldX: number, worldZ: number}}
 */
export function mapPixelToWorld(px, py, mapWidth, mapHeight) {
  const u = px / mapWidth;
  const v = py / mapHeight;
  return {
    worldX: u * TERRAIN_SIZE - TERRAIN_SIZE / 2,
    worldZ: v * TERRAIN_SIZE - TERRAIN_SIZE / 2,
  };
}
