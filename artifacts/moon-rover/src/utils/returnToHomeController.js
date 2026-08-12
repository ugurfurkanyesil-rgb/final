/**
 * Return-to-home controller helpers.
 */

import { planAllRoutes } from './pathfinder';

/**
 * @param {{x:number,z:number}} roverPos
 * @param {{x:number,z:number}} home
 * @param {{hm: Float32Array, sm: Float32Array, cm: Float32Array}} maps
 * @param {number} sunAngleDeg
 * @param {Float32Array|null} [experienceMap] - from LearningModel.getExperienceMap()
 */
export function buildReturnToHomePath(roverPos, home, maps, sunAngleDeg, experienceMap = null) {
  const planned = planAllRoutes([roverPos, home], maps.sm, maps.cm, maps.hm, sunAngleDeg, experienceMap);
  return planned?.SAFE?.path || planned?.AUTO?.path || null;
}
