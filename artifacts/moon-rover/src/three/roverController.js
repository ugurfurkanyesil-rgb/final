/**
 * Rover Controller
 * Keyboard + autonomous path-following physics.
 * Hard crater/debris collision guard — rover NEVER enters a crater.
 */

import { useRef, useEffect, useCallback } from 'react';
import { getTerrainHeight, TERRAIN_SIZE, CRATERS } from './terrainGenerator';

const MAX_SPEED    = 8;
const ACCEL        = 6;
const DECEL        = 5;
const TURN_SPD     = 2.2;
const HALF         = TERRAIN_SIZE / 2 - 2;
const AUTO_SPD     = 6.0;
const WP_REACH     = 2.0;   // Generous reach radius so rover never stalls on waypoints
const ROVER_SCALE  = 5.01;
const ROVER_Y_OFF  = 0.135 * ROVER_SCALE + 0.05; // wheel bottom (0.04-0.175)*scale + small clearance

// ---- Hard crater guard ----
// Returns true if a world position is inside a crater bowl (impassable).
function insideCrater(wx, wz) {
  for (const c of CRATERS) {
    const d = Math.sqrt((wx - c.x) ** 2 + (wz - c.z) ** 2);
    // Treat the inner bowl (t < 0.9) as absolute no-go
    if (d < c.radius * 0.9) return true;
  }
  return false;
}

const keys = { forward: false, backward: false, left: false, right: false };

export function useRoverController(roverRef, setRoverState, pathRef, activeRoute, learningModel) {
  const velRef      = useRef(0);
  const lastTRef    = useRef(null);
  const wpIdxRef    = useRef(0);
  const stuckRef    = useRef({ t: 0, x: 0, z: 0 });

  useEffect(() => {
    const dn = (e) => {
      if (['KeyW','ArrowUp'].includes(e.code))    { keys.forward  = true; e.preventDefault(); }
      if (['KeyS','ArrowDown'].includes(e.code))  { keys.backward = true; e.preventDefault(); }
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
    if (lastTRef.current === null) { lastTRef.current = now; }
    const dt  = Math.min((now - lastTRef.current) / 1000, 0.05);
    lastTRef.current = now;

    const rover = roverRef.current;

    // ---- Teleport to start of route (set once by handleStartRover) ----
    const tp = pathRef.current._teleportTo;
    if (tp) {
      rover.position.set(tp.x, tp.y, tp.z);
      velRef.current = 0;
      pathRef.current._teleportTo = null;
      stuckRef.current = { t: 0, x: tp.x, z: tp.z };
    }

    let vel     = velRef.current;
    let isAuto  = false;

    // ---- Autonomous path following ----
    const wpIdx  = pathRef.current._waypointIdx;
    const route  = activeRoute && pathRef.current[activeRoute];
    const doAuto = wpIdx !== undefined && route?.length > 0;

    if (doAuto) {
      isAuto = true;

      // Advance waypoint index past all already-reached points
      let idx = wpIdx;
      while (idx < route.length - 1) {
        const wp = route[idx];
        const dx = wp[0] - rover.position.x;
        const dz = wp[2] - rover.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < WP_REACH) idx++;
        else break;
      }

      // Lookahead: skip ahead several more points to stay smooth & avoid getting stuck on corners
      const LOOKAHEAD = 4;
      const targetIdx = Math.min(idx + LOOKAHEAD, route.length - 1);
      pathRef.current._waypointIdx = idx;

      const target = route[targetIdx];
      const dx = target[0] - rover.position.x;
      const dz = target[2] - rover.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const finalDist = (() => {
        const fp = route[route.length - 1];
        const fdx = fp[0] - rover.position.x;
        const fdz = fp[2] - rover.position.z;
        return Math.sqrt(fdx * fdx + fdz * fdz);
      })();

      if (idx >= route.length - 1 && finalDist < WP_REACH * 1.2) {
        // Reached final destination — slow down
        vel = Math.max(0, vel - DECEL * dt * 4);
        if (vel < 0.08) {
          pathRef.current._waypointIdx = undefined;
          isAuto = false;
        }
      } else {
        // Steer toward target point
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - rover.rotation.y;
        while (diff >  Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        rover.rotation.y += diff * Math.min(1, TURN_SPD * dt * 3.5);

        // Speed: reduce only for sharp turns (>90°), never stall completely
        const turnFactor = Math.max(0.40, 1 - Math.min(0.60, Math.abs(diff) / Math.PI));
        const targetVel  = AUTO_SPD * turnFactor;
        vel += (targetVel - vel) * Math.min(1, ACCEL * dt);
        vel  = Math.max(0.8, vel); // Floor: never stall while path is active

        // Stall detection: if rover hasn't moved in 1.5s, skip 8 waypoints forward
        const sx = stuckRef.current.x, sz = stuckRef.current.z;
        if (Math.abs(rover.position.x - sx) + Math.abs(rover.position.z - sz) < 0.05) {
          stuckRef.current.t += dt;
          if (stuckRef.current.t > 1.5) {
            pathRef.current._waypointIdx = Math.min(idx + 8, route.length - 1);
            stuckRef.current.t = 0;
          }
        } else {
          stuckRef.current = { t: 0, x: rover.position.x, z: rover.position.z };
        }
      }
    }

    // ---- Manual override ----
    if (keys.forward) {
      vel = Math.min(vel + ACCEL * dt, MAX_SPEED);
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

    // ---- Move ----
    const angle = rover.rotation.y;
    let nx = rover.position.x + Math.sin(angle) * vel * dt;
    let nz = rover.position.z + Math.cos(angle) * vel * dt;

    // ---- Hard crater collision guard ----
    // If next position is inside a crater bowl, reject the move and push back
    if (insideCrater(nx, nz)) {
      // Slide along perpendicular — try X-only, then Z-only
      const tryX = rover.position.x + Math.sin(angle) * vel * dt;
      const tryZ = rover.position.z;
      if (!insideCrater(tryX, tryZ)) {
        nx = tryX; nz = tryZ;
      } else {
        const tryX2 = rover.position.x;
        const tryZ2 = rover.position.z + Math.cos(angle) * vel * dt;
        if (!insideCrater(tryX2, tryZ2)) {
          nx = tryX2; nz = tryZ2;
        } else {
          // Fully blocked — stay put, brake hard
          nx = rover.position.x;
          nz = rover.position.z;
          velRef.current = 0;
          // Skip forward in path to avoid permanent stall
          if (doAuto && pathRef.current._waypointIdx !== undefined) {
            const cur = pathRef.current._waypointIdx;
            pathRef.current._waypointIdx = Math.min(cur + 10, route.length - 1);
          }
        }
      }
    }

    nx = Math.max(-HALF, Math.min(HALF, nx));
    nz = Math.max(-HALF, Math.min(HALF, nz));
    const ty = getTerrainHeight(nx, nz);
    rover.position.set(nx, ty + ROVER_Y_OFF, nz);

    // ---- Trail ----
    const trail = pathRef.current._roverTrail || [];
    const last  = trail[trail.length - 1];
    if (!last || Math.abs(nx - last[0]) + Math.abs(nz - last[2]) > 0.5) {
      trail.push([nx, ty + ROVER_Y_OFF, nz]);
      if (trail.length > 1000) trail.shift();
      pathRef.current._roverTrail = trail;
    }

    // ---- Learning feedback ----
    if (learningModel && Math.abs(vel) > 0.2) {
      const dh = last ? Math.abs(ty - (last[1] - ROVER_Y_OFF)) : 0;
      const ds = last ? Math.sqrt((nx - last[0]) ** 2 + (nz - last[2]) ** 2) : 1;
      const slope = ds > 0.01 ? dh / ds : 0;
      learningModel.recordTraversal(nx, nz, learningModel.computeDifficulty(Math.abs(vel), slope, 0));
    }

    setRoverState({
      x: nx, y: ty + ROVER_Y_OFF, z: nz,
      speed:   Math.abs(vel),
      heading: rover.rotation.y,
      autoMode: isAuto,
    });
  }, [roverRef, setRoverState, pathRef, activeRoute, learningModel]);

  return { update };
}
