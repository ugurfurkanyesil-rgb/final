/**
 * Rover Controller
 * Keyboard + autonomous path-following physics.
 * Feeds traversal data back to the learning model.
 */

import { useRef, useEffect, useCallback } from 'react';
import { getTerrainHeight, TERRAIN_SIZE } from './terrainGenerator';

const MAX_SPEED = 6;
const ACCEL     = 5;
const DECEL     = 4;
const TURN_SPD  = 1.8;
const HALF      = TERRAIN_SIZE / 2 - 2;
const AUTO_SPD  = 4.5;
const WP_REACH  = 0.85;

const keys = { forward: false, backward: false, left: false, right: false };

export function useRoverController(roverRef, setRoverState, pathRef, activeRoute, learningModel) {
  const velRef      = useRef(0);
  const lastTRef    = useRef(null);
  const wpIdxRef    = useRef(0);
  const autoRef     = useRef(false);

  useEffect(() => {
    const dn = (e) => {
      if (['KeyW','ArrowUp'].includes(e.code))    { keys.forward  = true; autoRef.current = false; e.preventDefault(); }
      if (['KeyS','ArrowDown'].includes(e.code))  { keys.backward = true; autoRef.current = false; e.preventDefault(); }
      if (['KeyA','ArrowLeft'].includes(e.code))  { keys.left     = true; e.preventDefault(); }
      if (['KeyD','ArrowRight'].includes(e.code)) { keys.right    = true; e.preventDefault(); }
    };
    const up = (e) => {
      if (['KeyW','ArrowUp'].includes(e.code))    keys.forward  = false;
      if (['KeyS','ArrowDown'].includes(e.code))  keys.backward = false;
      if (['KeyA','ArrowLeft'].includes(e.code))  keys.left     = false;
      if (['KeyD','ArrowRight'].includes(e.code)) keys.right    = false;
    };
    window.addEventListener('keydown', dn, { passive: false });
    window.addEventListener('keyup',   up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);

  const update = useCallback((timestamp) => {
    if (!roverRef.current) return;
    const now = timestamp ?? performance.now();
    if (lastTRef.current === null) { lastTRef.current = now; return; }
    const dt = Math.min((now - lastTRef.current) / 1000, 0.05);
    lastTRef.current = now;

    const rover = roverRef.current;
    let vel = velRef.current;
    let isAuto = false;

    // --- Autonomous path following ---
    const wpIdx  = pathRef.current._waypointIdx;
    const doAuto = wpIdx !== undefined && activeRoute && pathRef.current[activeRoute]?.length > 0;

    if (doAuto) {
      isAuto = true;
      const route = pathRef.current[activeRoute];
      let idx = wpIdx;

      while (idx < route.length - 1) {
        const wp = route[idx];
        const dx = wp[0] - rover.position.x;
        const dz = wp[2] - rover.position.z;
        if (Math.sqrt(dx*dx + dz*dz) < WP_REACH) idx++;
        else break;
      }
      pathRef.current._waypointIdx = idx;

      const target = route[Math.min(idx, route.length - 1)];
      const dx = target[0] - rover.position.x;
      const dz = target[2] - rover.position.z;
      const dist = Math.sqrt(dx*dx + dz*dz);

      if (idx >= route.length - 1 && dist < WP_REACH) {
        // Destination reached
        vel = Math.max(0, vel - DECEL * dt * 3);
        if (vel < 0.05) {
          pathRef.current._waypointIdx = undefined;
          isAuto = false;
        }
      } else {
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - rover.rotation.y;
        while (diff >  Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        rover.rotation.y += diff * Math.min(1, TURN_SPD * dt * 3.2);
        const turnFactor = 1 - Math.min(0.65, Math.abs(diff) / Math.PI);
        vel += (AUTO_SPD * turnFactor - vel) * Math.min(1, ACCEL * dt);
      }
    }

    // --- Manual override ---
    if (keys.forward) {
      vel = Math.min(vel + ACCEL * dt, MAX_SPEED);
      if (isAuto) { isAuto = false; pathRef.current._waypointIdx = undefined; }
    } else if (keys.backward) {
      vel = Math.max(vel - ACCEL * dt, -MAX_SPEED * 0.5);
    } else if (!isAuto) {
      vel = Math.abs(vel) < 0.06 ? 0 : vel - Math.sign(vel) * DECEL * dt;
    }

    if (!isAuto && Math.abs(vel) > 0.04) {
      if (keys.left)  rover.rotation.y += TURN_SPD * dt * (vel > 0 ? 1 : -1);
      if (keys.right) rover.rotation.y -= TURN_SPD * dt * (vel > 0 ? 1 : -1);
    }

    velRef.current = vel;

    // --- Move + terrain snap ---
    const angle = rover.rotation.y;
    let nx = rover.position.x + Math.sin(angle) * vel * dt;
    let nz = rover.position.z + Math.cos(angle) * vel * dt;
    nx = Math.max(-HALF, Math.min(HALF, nx));
    nz = Math.max(-HALF, Math.min(HALF, nz));
    const ty = getTerrainHeight(nx, nz);
    rover.position.set(nx, ty + 0.45, nz);

    // --- Trail ---
    const trail = pathRef.current._roverTrail || [];
    const last  = trail[trail.length - 1];
    if (!last || Math.abs(nx - last[0]) + Math.abs(nz - last[2]) > 0.35) {
      trail.push([nx, ty + 0.45, nz]);
      if (trail.length > 800) trail.shift();
      pathRef.current._roverTrail = trail;
    }

    // --- Learning feedback ---
    if (learningModel && Math.abs(vel) > 0.12) {
      const dh = last ? Math.abs(ty - (last[1] - 0.45)) : 0;
      const ds = last ? Math.sqrt((nx - last[0])**2 + (nz - last[2])**2) : 1;
      const slope = ds > 0.01 ? dh / ds : 0;
      learningModel.recordTraversal(nx, nz, learningModel.computeDifficulty(Math.abs(vel), slope, 0));
    }

    setRoverState({
      x: nx, y: ty + 0.45, z: nz,
      speed:   Math.abs(vel),
      heading: rover.rotation.y,
      autoMode: isAuto,
    });
  }, [roverRef, setRoverState, pathRef, activeRoute, learningModel]);

  return { update };
}
