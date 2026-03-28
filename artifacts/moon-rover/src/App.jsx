/**
 * Moon Rover Simulation — Main App
 * Orchestrates the 3D scene, HUD, and state management.
 */

import { useState, useRef, useCallback } from 'react';
import { lazy, Suspense } from 'react';
import HUD from './components/HUD';
import { getTerrainHeight } from './three/terrainGenerator';

// Lazy load the heavy 3D scene to improve initial load time
const MoonScene = lazy(() => import('./components/MoonScene'));

const INITIAL_STATE = {
  x: 0,
  y: getTerrainHeight(0, 0) + 0.55,
  z: 0,
  speed: 0,
  direction: 0,
};

export default function App() {
  const [roverState, setRoverState] = useState(INITIAL_STATE);
  const [cameraMode, setCameraMode] = useState('follow'); // 'follow' | 'free'
  const [wireframe, setWireframe] = useState(false);
  const [resetKey, setResetKey] = useState(0); // Forces scene remount on reset

  // Path stored in a ref to avoid re-renders on every point
  const pathRef = useRef([[0, INITIAL_STATE.y, 0]]);

  const handleReset = useCallback(() => {
    pathRef.current = [[0, getTerrainHeight(0, 0) + 0.55, 0]];
    setRoverState(INITIAL_STATE);
    setResetKey(k => k + 1); // Remount scene to reset rover position
  }, []);

  const handleToggleCamera = useCallback(() => {
    setCameraMode(m => m === 'follow' ? 'free' : 'follow');
  }, []);

  const handleToggleWireframe = useCallback(() => {
    setWireframe(w => !w);
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      position: 'relative',
      background: '#000008',
      fontFamily: 'monospace',
    }}>
      {/* 3D Scene — fills full viewport */}
      <Suspense fallback={
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#4ecdc4', fontSize: 16, fontFamily: 'monospace',
          letterSpacing: '0.15em',
        }}>
          LOADING MOON SURFACE...
        </div>
      }>
        <MoonScene
          key={resetKey}
          roverState={roverState}
          setRoverState={setRoverState}
          pathRef={pathRef}
          cameraMode={cameraMode}
          wireframe={wireframe}
        />
      </Suspense>

      {/* HUD overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        <HUD
          roverState={roverState}
          pathPoints={pathRef.current}
          cameraMode={cameraMode}
          wireframe={wireframe}
          onReset={handleReset}
          onToggleCamera={handleToggleCamera}
          onToggleWireframe={handleToggleWireframe}
        />
      </div>

      {/* Title badge */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        color: 'rgba(180,220,180,0.85)',
        fontFamily: 'monospace',
        fontSize: 13,
        letterSpacing: '0.2em',
        pointerEvents: 'none',
        textShadow: '0 0 8px rgba(80,200,80,0.5)',
        zIndex: 10,
      }}>
        LUNAR ROVER SIM
        <div style={{ fontSize: 9, color: 'rgba(120,180,120,0.6)', letterSpacing: '0.1em', marginTop: 2 }}>
          SURFACE OPERATIONS MODULE v1.0
        </div>
      </div>

      {/* Camera mode badge */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(8,18,8,0.75)',
        border: '1px solid rgba(60,120,60,0.4)',
        borderRadius: 4,
        padding: '4px 12px',
        fontSize: 9,
        color: 'rgba(100,200,100,0.7)',
        fontFamily: 'monospace',
        letterSpacing: '0.1em',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        CAMERA: {cameraMode.toUpperCase()} · W/A/S/D TO DRIVE · C to toggle orbit
      </div>
    </div>
  );
}
