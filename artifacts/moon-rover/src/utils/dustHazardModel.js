/**
 * Dust hazard state + configuration model.
 */

export const DUST_STATES = {
  NORMAL: 'normal',
  PLACEMENT: 'dust_placement_mode',
  PRESENT: 'dust_present',
  INTERFERENCE: 'dust_interference_detected',
  SIGNAL_LOST: 'signal_lost',
  STOPPED: 'stopped',
  RETURN_HOME: 'return_to_home',
};

export const DUST_HAZARD_CONFIG = {
  visibleRadius: 8,
  interferenceRadiusScale: 1.35,
  criticalRadiusScale: 1.0,
  pathInfluenceScale: 1.05,
  pathArmedDistanceScale: 1.45,
  sensorConeDeg: 60,
  sensorRangeScale: 1.35,
  triggerPersistenceTicks: 6,
};

export const DEFAULT_HOME = { x: -25, z: -20 };

export function createDustHazard(x, z, config = DUST_HAZARD_CONFIG) {
  return {
    x,
    z,
    radius: config.visibleRadius,
    interferenceRadius: config.visibleRadius * config.interferenceRadiusScale,
    criticalRadius: config.visibleRadius * config.criticalRadiusScale,
    opacity: 0.5,
    intensity: 1,
    active: true,
    createdAt: Date.now(),
  };
}
