/**
 * Continuous dust interference evaluation.
 */

import { pointToSegmentDist } from './dustHazard';

function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

function getMinPathDistanceToHazard(hazard, path) {
  if (!path || path.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, , az] = path[i];
    const [bx, , bz] = path[i + 1];
    min = Math.min(min, pointToSegmentDist(hazard.x, hazard.z, ax, az, bx, bz));
  }
  return min;
}

function isHazardInForwardCone(roverState, hazard, coneDeg) {
  const dx = hazard.x - roverState.x;
  const dz = hazard.z - roverState.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1e-6) return true;

  const fx = Math.sin(roverState.heading || 0);
  const fz = Math.cos(roverState.heading || 0);
  const nx = dx / d;
  const nz = dz / d;
  const dot = fx * nx + fz * nz;
  return dot >= Math.cos((coneDeg * Math.PI) / 180);
}

/**
 * @param {{x:number,z:number,heading:number,speed:number}} roverState
 * @param {{x:number,z:number,radius:number,interferenceRadius:number,criticalRadius:number}} hazard
 * @param {Array<[number,number,number]> | null} activePath
 * @param {{sensorConeDeg:number,sensorRangeScale:number,pathInfluenceScale:number,pathArmedDistanceScale:number}} config
 */
export function evaluateDustInterference(roverState, hazard, activePath, config) {
  if (!hazard || !hazard.active) {
    return {
      interferenceDetected: false,
      reason: 'none',
      signalQuality: 1,
      distanceToHazard: Infinity,
      hazardToPathDistance: Infinity,
      inSensorCone: false,
    };
  }

  const distanceToHazard = dist2D(roverState.x, roverState.z, hazard.x, hazard.z);
  const hazardToPathDistance = getMinPathDistanceToHazard(hazard, activePath);
  const inSensorCone = isHazardInForwardCone(roverState, hazard, config.sensorConeDeg);
  const moving = (roverState.speed || 0) > 0.2;

  const insideCritical = distanceToHazard <= hazard.criticalRadius;
  const sensorAffected =
    moving
    && inSensorCone
    && distanceToHazard <= (hazard.interferenceRadius * config.sensorRangeScale);
  const nearPathAndClose =
    moving
    && hazardToPathDistance <= hazard.interferenceRadius * config.pathInfluenceScale
    && distanceToHazard <= hazard.interferenceRadius * config.pathArmedDistanceScale;

  const interferenceDetected = insideCritical || sensorAffected || nearPathAndClose;
  let reason = 'none';
  if (insideCritical) reason = 'critical_radius';
  else if (sensorAffected) reason = 'sensor_cone';
  else if (nearPathAndClose) reason = 'path_proximity';

  // Signal quality from 1 (clean) to 0 (lost)
  const nearFactor = Math.max(0, 1 - distanceToHazard / (hazard.interferenceRadius * 1.8));
  const pathFactor = Number.isFinite(hazardToPathDistance)
    ? Math.max(0, 1 - hazardToPathDistance / (hazard.interferenceRadius * 1.2))
    : 0;
  const coneFactor = inSensorCone ? 0.18 : 0;
  const degradation = Math.min(1, nearFactor * 0.62 + pathFactor * 0.22 + coneFactor);
  const signalQuality = Math.max(0, Math.min(1, 1 - degradation));

  return {
    interferenceDetected,
    reason,
    signalQuality,
    distanceToHazard,
    hazardToPathDistance,
    inSensorCone,
  };
}
