/**
 * MoonScene - Main 3D scene component
 * 100×100m Moon terrain, detailed rover, adjustable sun, path lines.
 */

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { generateTerrain, getTerrainHeight, generateRockPositions, TERRAIN_SIZE } from '../three/terrainGenerator';
import { useRoverController } from '../three/roverController';

// Route colors
export const ROUTE_COLORS = {
  SAFE: '#22cc44',
  ECO:  '#44dddd',
  FAST: '#4488ff',
  AUTO: '#ffcc22',
};

// === Terrain ===
let _geo = null;
function Terrain({ wireframe }) {
  if (!_geo) _geo = generateTerrain();
  return (
    <mesh geometry={_geo} receiveShadow>
      <meshStandardMaterial
        color={wireframe ? '#44aa44' : '#b0b0a8'}
        wireframe={wireframe}
        roughness={0.96}
        metalness={0.01}
      />
    </mesh>
  );
}

// === Detailed Rover Model ===
function RoverBody({ wireframe }) {
  const mat = (color) => (
    <meshStandardMaterial color={color} roughness={0.7} metalness={0.35} wireframe={wireframe} />
  );
  return (
    <group>
      {/* Main chassis */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.9, 0.22, 1.3]} />
        {mat('#8a8a7a')}
      </mesh>
      {/* Upper electronics box */}
      <mesh position={[0, 0.45, 0.05]} castShadow>
        <boxGeometry args={[0.62, 0.18, 0.85]} />
        {mat('#9e9e8e')}
      </mesh>
      {/* RTG / power unit rear */}
      <mesh position={[0, 0.3, -0.6]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.5, 8]} />
        {mat('#777766')}
      </mesh>
      {/* Solar panel left */}
      <mesh position={[-0.72, 0.52, 0.05]} castShadow>
        <boxGeometry args={[0.5, 0.025, 0.8]} />
        <meshStandardMaterial color="#2244aa" roughness={0.25} metalness={0.7} wireframe={wireframe} />
      </mesh>
      {/* Solar panel right */}
      <mesh position={[0.72, 0.52, 0.05]} castShadow>
        <boxGeometry args={[0.5, 0.025, 0.8]} />
        <meshStandardMaterial color="#2244aa" roughness={0.25} metalness={0.7} wireframe={wireframe} />
      </mesh>
      {/* Camera mast */}
      <mesh position={[0, 0.73, 0.35]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.42, 6]} />
        {mat('#b0b09a')}
      </mesh>
      {/* Camera head */}
      <mesh position={[0, 0.96, 0.35]} castShadow>
        <boxGeometry args={[0.18, 0.13, 0.12]} />
        {mat('#222222')}
      </mesh>
      {/* Antenna */}
      <mesh position={[0.28, 0.72, -0.15]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.38, 5]} />
        {mat('#c8c8b8')}
      </mesh>
      <mesh position={[0.28, 0.92, -0.15]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff2222" emissiveIntensity={0.8} />
      </mesh>
      {/* 6 wheels — rocker-bogie style */}
      {[-0.52, 0.52].map((xPos, ci) =>
        [-0.55, 0.0, 0.55].map((zOff, ri) => (
          <group key={`${ci}-${ri}`} position={[xPos, 0.04, zOff]}>
            {/* Suspension strut */}
            <mesh position={[xPos < 0 ? 0.1 : -0.1, 0.15, 0]}>
              <boxGeometry args={[0.18, 0.04, 0.04]} />
              {mat('#7a7a6a')}
            </mesh>
            {/* Wheel */}
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.18, 0.18, 0.1, 12]} />
              {mat('#2a2a1e')}
            </mesh>
            {/* Wheel tread lines */}
            {[0,1,2,3].map(j => (
              <mesh key={j} rotation={[j * Math.PI/4, 0, Math.PI/2]}>
                <torusGeometry args={[0.18, 0.012, 4, 12, Math.PI * 0.7]} />
                {mat('#1a1a0f')}
              </mesh>
            ))}
          </group>
        ))
      )}
    </group>
  );
}

function RoverPhysics({ roverRef, setRoverState, pathRef, activeRoute, learningModel, wireframe }) {
  const { update } = useRoverController(roverRef, setRoverState, pathRef, activeRoute, learningModel);
  useFrame(({ clock }) => update(clock.getElapsedTime() * 1000));
  return (
    <group ref={roverRef}>
      <RoverBody wireframe={wireframe} />
    </group>
  );
}

// === Rocks ===
const ROCKS = generateRockPositions(50);
function Rocks() {
  return (
    <>
      {ROCKS.map((r, i) => (
        <mesh key={i} position={[r.x, r.y + r.scale * 0.3, r.z]}
          rotation={[0.2, r.rotY, 0.1]}
          scale={[r.scale, r.scale * 0.65, r.scale * 0.85]}
          castShadow receiveShadow>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color="#6a6a5a" roughness={0.92} metalness={0.04} />
        </mesh>
      ))}
    </>
  );
}

// === Path Lines ===
function RouteLine({ points, color, active }) {
  if (!points || points.length < 2) return null;
  const positions = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    positions[i*3]   = points[i][0];
    positions[i*3+1] = points[i][1] + (active ? 0.12 : 0.06);
    positions[i*3+2] = points[i][2];
  }
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={points.length} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color={color} opacity={active ? 1.0 : 0.55} transparent />
    </line>
  );
}

function TrailLine({ points }) {
  if (!points || points.length < 2) return null;
  const positions = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    positions[i*3]   = points[i][0];
    positions[i*3+1] = points[i][1] + 0.05;
    positions[i*3+2] = points[i][2];
  }
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={points.length} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color="#ffffff" opacity={0.4} transparent />
    </line>
  );
}

// === Waypoint markers ===
function WaypointMarker({ pos, color }) {
  if (!pos) return null;
  const y = getTerrainHeight(pos.x, pos.z) + 0.3;
  return (
    <group position={[pos.x, y, pos.z]}>
      <mesh>
        <cylinderGeometry args={[0.3, 0, 0.9, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

// === Camera ===
function CameraController({ roverRef, cameraMode, orbitRef, sunAngle }) {
  useFrame(({ camera }) => {
    if (cameraMode === 'follow' && roverRef.current) {
      const rover = roverRef.current;
      // Bird's eye follow — elevated, tilted view
      const angle = rover.rotation.y;
      const camX = rover.position.x - Math.sin(angle) * 12;
      const camZ = rover.position.z - Math.cos(angle) * 12;
      camera.position.lerp(new THREE.Vector3(camX, 14, camZ), 0.06);
      const target = rover.position.clone();
      camera.lookAt(target);
      if (orbitRef.current) orbitRef.current.target.lerp(target, 0.08);
    }
  });
  return null;
}

// === Main Scene ===
export default function MoonScene({
  roverState, setRoverState, pathRef,
  routes, activeRoute,
  startPos, endPos,
  cameraMode, wireframe, sunAngleDeg,
  learningModel,
}) {
  const roverRef = useRef();
  const orbitRef = useRef();

  // Sun direction from angle
  const sunRad = (sunAngleDeg * Math.PI) / 180;
  const sunX = Math.sin(sunRad) * 80;
  const sunZ = -Math.cos(sunRad) * 80;
  const sunY = 70;

  const trail = pathRef.current._roverTrail || [];

  return (
    <Canvas
      shadows
      camera={{ position: [0, 28, -22], fov: 48, near: 0.1, far: 800 }}
      style={{ background: '#000008' }}
      gl={{ antialias: true }}
    >
      <Stars radius={300} depth={60} count={5000} factor={4} saturation={0} fade />

      {/* Sun directional light */}
      <directionalLight
        position={[sunX, sunY, sunZ]}
        intensity={2.0}
        color="#fffaf0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={250}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
      />
      {/* Earthshine fill */}
      <ambientLight intensity={0.07} color="#c0d0ff" />
      <directionalLight position={[-40, 15, -50]} intensity={0.12} color="#b8caff" />

      <Terrain wireframe={wireframe} />
      <Rocks />

      {/* Route lines */}
      {routes && Object.entries(routes).map(([mode, pts]) => (
        <RouteLine key={mode} points={pts} color={ROUTE_COLORS[mode]} active={mode === activeRoute} />
      ))}

      {/* Rover trail */}
      <TrailLine points={trail} />

      {/* Waypoint markers */}
      {startPos && <WaypointMarker pos={startPos} color="#22ff44" />}
      {endPos   && <WaypointMarker pos={endPos}   color="#ff4422" />}

      {/* Rover */}
      <RoverPhysics
        roverRef={roverRef}
        setRoverState={setRoverState}
        pathRef={pathRef}
        activeRoute={activeRoute}
        learningModel={learningModel}
        wireframe={wireframe}
      />

      <CameraController roverRef={roverRef} cameraMode={cameraMode} orbitRef={orbitRef} sunAngle={sunAngleDeg} />
      <OrbitControls
        ref={orbitRef}
        enabled={cameraMode === 'free'}
        maxPolarAngle={Math.PI / 2.05}
        enablePan enableZoom enableRotate
      />
    </Canvas>
  );
}
