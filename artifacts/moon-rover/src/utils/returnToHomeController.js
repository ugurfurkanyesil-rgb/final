/**
 * Return-to-home controller helpers.
 */

import { planAllRoutes } from './pathfinder';

/**
 * @param {{x:number,z:number}} roverPos
 * @param {{x:number,z:number}} home
 * @param {{hm: Float32Array, sm: Float32Array, cm: Float32Array}} maps
 * @param {number} sunAngleDeg
 */
export function buildReturnToHomePath(roverPos, home, maps, sunAngleDeg) {
  const planned = planAllRoutes([roverPos, home], maps.sm, maps.cm, maps.hm, sunAngleDeg);
  return planned?.SAFE?.path || planned?.AUTO?.path || null;
}
