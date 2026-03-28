/**
 * Rover Controller
 * Handles keyboard input, physics, autonomous path following,
 * and feeds traversal data to the learning model.
 */

import { useRef, useEffect, useCallback } from 'react';
import { getTerrainHeight, TERRAIN_SIZE } from './terrainGenerator';

const MAX_SPEED = 6;
const ACCEL = 5;
const DECEL = 4;
const TURN_SPEED = 1.6;
const HALF = TERRAIN_SIZE / 2 - 2;
const AUTO_SPEED = 4.5;
const WAYPOINT_REACH_DIST = 0.8;

const keys = { forward: false, backward: false, left: false, right: false };

export function useRoverController(roverRef, setRoverState, pathRef, activeRoute, learningModel) {
  const velocityRef = useRef(0);
  const lastTimeRef = useRef(null);
  const waypointIdxRef = useRef(0);
  const autoModeRef = useRef(false);

  // Sync auto mode
  autoModeRef.current = activeRoute !== null && pathRef.current[activeRoute]?.length > 0;

  useEffect(() => {
    const onKeyDown = (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    keys.forward  = true; e.preventDefault(); break;
        case 'KeyS': case 'ArrowDown':  keys.backward = true; e.preventDefault(); break;
        case 'KeyA': case 'ArrowLeft':  keys.left     = true; e.preventDefault(); break;
        case 'KeyD': case 'ArrowRight': keys.right    = true; e.preventDefault(); break;
      }
    };
    const onKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    keys.forward  = false; break;
        case 'KeyS': case 'ArrowDown':  keys.backward = false; break;
        case 'KeyA': case 'ArrowLeft':  keys.left     = false; break;
        case 'KeyD': case 'ArrowRight': keys.right    = false; break;
      }
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, []);

  const resetWaypoint = useCallback(() => {
    waypointIdxRef.current = 0;
  }, []);

  const update = useCallback((timestamp) => {
    if (!roverRef.current) return;
    const now = timestamp ?? performance.now();
    if (lastTimeRef.current === null) { lastTimeRef.current = now; return; }
    const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
    lastTimeRef.current = now;

    const rover = roverRef.current;
    let velocity = velocityRef.current;
    let isAuto = false;

    // --- Autonomous path following ---
    if (autoModeRef.current && activeRoute) {
      const routePath = pathRef.current[activeRoute];
      if (routePath && routePath.length > 0) {
        isAuto = true;
        let wpIdx = waypointIdxRef.current;
        // Advance to next waypoint if close enough
        while (wpIdx < routePath.length - 1) {
          const wp = routePath[wpIdx];
          const dx = wp[0] - rover.position.x;
          const dz = wp[2] - rover.position.z;
          if (Math.sqrt(dx*dx + dz*dz) < WAYPOINT_REACH_DIST) {
            wpIdx++;
          } else break;
        }
        waypointIdxRef.current = wpIdx;

        const target = routePath[Math.min(wpIdx, routePath.length - 1)];
        const dx = target[0] - rover.position.x;
        const dz = target[2] - rover.position.z;
        const distToTarget = Math.sqrt(dx*dx + dz*dz);

        if (wpIdx >= routePath.length - 1 && distToTarget < WAYPOINT_REACH_DIST) {
          // Reached destination
          velocity = Math.max(0, velocity - DECEL * dt);
        } else {
          // Steer toward waypoint
          const targetAngle = Math.atan2(dx, dz);
          let angleDiff = targetAngle - rover.rotation.y;
          // Normalize to [-PI, PI]
          while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
          while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

          rover.rotation.y += angleDiff * Math.min(1, TURN_SPEED * dt * 3);
          // Slow for sharp turns
          const turnFactor = 1 - Math.min(0.7, Math.abs(angleDiff) / Math.PI);
          const targetSpeed = AUTO_SPEED * turnFactor;
          velocity += (targetSpeed - velocity) * Math.min(1, ACCEL * dt);
        }
      }
    }

    // --- Manual controls (override auto if key pressed) ---
    if (!isAuto || keys.forward || keys.backward) {
      if (keys.forward) {
        velocity = Math.min(velocity + ACCEL * dt, MAX_SPEED);
      } else if (keys.backward) {
        velocity = Math.max(velocity - ACCEL * dt, -MAX_SPEED * 0.5);
      } else if (!isAuto) {
        velocity = Math.abs(velocity) < 0.08 ? 0 : velocity - Math.sign(velocity) * DECEL * dt;
      }
    }

    if (!isAuto && Math.abs(velocity) > 0.05) {
      const steerDir = velocity > 0 ? 1 : -1;
      if (keys.left)  rover.rotation.y += TURN_SPEED * dt * steerDir;
      if (keys.right) rover.rotation.y -= TURN_SPEED * dt * steerDir;
    }

    velocityRef.current = velocity;

    // Move
    const angle = rover.rotation.y;
    let newX = rover.position.x + Math.sin(angle) * velocity * dt;
    let newZ = rover.position.z + Math.cos(angle) * velocity * dt;
    newX = Math.max(-HALF, Math.min(HALF, newX));
    newZ = Math.max(-HALF, Math.min(HALF, newZ));

    const terrainY = getTerrainHeight(newX, newZ);
    rover.position.set(newX, terrainY + 0.45, newZ);

    // Path recording
    const pts = pathRef.current._roverTrail || [];
    const last = pts[pts.length - 1];
    if (!last || Math.abs(newX - last[0]) + Math.abs(newZ - last[2]) > 0.4) {
      pts.push([newX, terrainY + 0.45, newZ]);
      if (pts.length > 600) pts.shift();
      pathRef.current._roverTrail = pts;
    }

    // Learning model feedback
    if (learningModel && Math.abs(velocity) > 0.1) {
      // Approximate slope at current position
      const dh = Math.abs(terrainY - (last ? last[1] - 0.45 : terrainY));
      const ds = last ? Math.sqrt((newX - last[0])**2 + (newZ - last[2])**2) : 1;
      const slope = ds > 0 ? dh / ds : 0;
      const difficulty = learningModel.computeDifficulty(Math.abs(velocity), slope, 0);
      learningModel.recordTraversal(newX, newZ, difficulty);
    }

    const dirDeg = ((angle * 180 / Math.PI) % 360 + 360) % 360;
    setRoverState({
      x: newX, y: terrainY + 0.45, z: newZ,
      speed: Math.abs(velocity),
      direction: dirDeg,
      autoMode: isAuto,
    });
  }, [roverRef, setRoverState, pathRef, activeRoute, learningModel]);

  return { update, resetWaypoint };
}
