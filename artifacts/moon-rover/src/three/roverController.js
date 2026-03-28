/**
 * Rover Controller
 * Handles keyboard input, rover physics, movement, and state updates.
 * Exports a hook that manages rover position, rotation, velocity, and path.
 */

import { useRef, useEffect, useCallback } from 'react';
import { getTerrainHeight } from './terrainGenerator';

const MAX_SPEED = 12;          // Units per second
const ACCELERATION = 8;        // Units per second squared
const DECELERATION = 6;        // Units per second squared (natural friction)
const TURN_SPEED = 1.8;        // Radians per second
const TERRAIN_SIZE = 200;
const HALF_TERRAIN = TERRAIN_SIZE / 2 - 5;

// Keys pressed state
const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

export function useRoverController(roverRef, roverState, setRoverState, pathRef) {
  const velocityRef = useRef(0);
  const lastTimeRef = useRef(null);

  // Setup keyboard listeners
  useEffect(() => {
    const onKeyDown = (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    keys.forward   = true; e.preventDefault(); break;
        case 'KeyS': case 'ArrowDown':  keys.backward  = true; e.preventDefault(); break;
        case 'KeyA': case 'ArrowLeft':  keys.left      = true; e.preventDefault(); break;
        case 'KeyD': case 'ArrowRight': keys.right     = true; e.preventDefault(); break;
      }
    };
    const onKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    keys.forward   = false; break;
        case 'KeyS': case 'ArrowDown':  keys.backward  = false; break;
        case 'KeyA': case 'ArrowLeft':  keys.left      = false; break;
        case 'KeyD': case 'ArrowRight': keys.right     = false; break;
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Physics update — called each frame from the Three.js render loop
  const update = useCallback((timestamp) => {
    if (!roverRef.current) return;

    const now = timestamp ?? performance.now();
    if (lastTimeRef.current === null) {
      lastTimeRef.current = now;
      return;
    }
    const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05); // Seconds, capped
    lastTimeRef.current = now;

    const rover = roverRef.current;
    let velocity = velocityRef.current;

    // Apply throttle / braking
    if (keys.forward) {
      velocity = Math.min(velocity + ACCELERATION * dt, MAX_SPEED);
    } else if (keys.backward) {
      velocity = Math.max(velocity - ACCELERATION * dt, -MAX_SPEED * 0.5);
    } else {
      // Natural deceleration
      if (Math.abs(velocity) < 0.1) {
        velocity = 0;
      } else {
        velocity -= Math.sign(velocity) * DECELERATION * dt;
      }
    }

    velocityRef.current = velocity;

    // Steering (only when moving)
    if (Math.abs(velocity) > 0.05) {
      const steerDir = velocity > 0 ? 1 : -1;
      if (keys.left)  rover.rotation.y += TURN_SPEED * dt * steerDir;
      if (keys.right) rover.rotation.y -= TURN_SPEED * dt * steerDir;
    }

    // Move rover forward in its facing direction
    const angle = rover.rotation.y;
    const dx = Math.sin(angle) * velocity * dt;
    const dz = Math.cos(angle) * velocity * dt;

    let newX = rover.position.x + dx;
    let newZ = rover.position.z + dz;

    // Clamp to terrain boundaries
    newX = Math.max(-HALF_TERRAIN, Math.min(HALF_TERRAIN, newX));
    newZ = Math.max(-HALF_TERRAIN, Math.min(HALF_TERRAIN, newZ));

    // Snap rover to terrain height
    const terrainY = getTerrainHeight(newX, newZ);
    rover.position.set(newX, terrainY + 0.55, newZ);

    // Record path point every 0.5 units traveled
    const pathPoints = pathRef.current;
    const last = pathPoints[pathPoints.length - 1];
    if (!last || Math.abs(newX - last[0]) + Math.abs(newZ - last[2]) > 0.5) {
      pathRef.current = [...pathPoints, [newX, terrainY + 0.55, newZ]];
      // Limit stored path length to 500 points for performance
      if (pathRef.current.length > 500) {
        pathRef.current = pathRef.current.slice(pathRef.current.length - 500);
      }
    }

    // Direction in degrees (0 = North)
    const dirDeg = ((angle * 180 / Math.PI) % 360 + 360) % 360;

    // Update state for UI (throttled to avoid excess re-renders)
    setRoverState({
      x: newX,
      y: terrainY + 0.55,
      z: newZ,
      speed: Math.abs(velocity),
      direction: dirDeg,
    });
  }, [roverRef, setRoverState, pathRef]);

  return { update };
}
