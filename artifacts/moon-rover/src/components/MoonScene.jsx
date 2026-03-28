/**
 * MoonScene Component
 * The main Three.js / React Three Fiber 3D scene.
 * Contains terrain, rover, rocks, stars, lighting, path line, and camera logic.
 */

import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { generateTerrain, addTerrainColors, generateRockPositions, getTerrainHeight } from '../three/terrainGenerator';
import { useRoverController } from '../three/roverController';

const TERRAIN_SIZE = 200;

// === Terrain Mesh ===
function Terrain({ wireframe }) {
  const meshRef = useRef();
  const geoRef = useRef(null);

  if (!geoRef.current) {
    const geo = generateTerrain(TERRAIN_SIZE, 128);
    addTerrainColors(geo);
    geoRef.current = geo;
  }

  return (
    <mesh ref={meshRef} geometry={geoRef.current} receiveShadow>
      <meshStandardMaterial
        vertexColors
        wireframe={wireframe}
        roughness={0.95}
        metalness={0.02}
        color={wireframe ? '#44aa44' : '#ffffff'}
      />
    </mesh>
  );
}

// === Rock (procedural box/sphere hybrid) ===
function Rock({ position, scale, rotY }) {
  // Use dodecahedron for organic rock shape
  return (
    <mesh
      position={position}
      rotation={[Math.random() * 0.5, rotY, Math.random() * 0.3]}
      scale={[scale, scale * 0.7, scale * 0.85]}
      castShadow
      receiveShadow
    >
      <dodecahedronGeometry args={[0.7, 0]} />
      <meshStandardMaterial color="#696969" roughness={0.9} metalness={0.05} />
    </mesh>
  );
}

// === Rocks group ===
const ROCKS = generateRockPositions(45, TERRAIN_SIZE);
function Rocks({ wireframe }) {
  return (
    <>
      {ROCKS.map((r, i) => (
        <Rock
          key={i}
          position={[r.x, r.y + r.scale * 0.35, r.z]}
          scale={r.scale}
          rotY={r.rotY}
        />
      ))}
    </>
  );
}

// === Rover Body (geometric placeholder rover) ===
function RoverMesh({ wireframe }) {
  return (
    <group>
      {/* Main body */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[1.2, 0.35, 1.6]} />
        <meshStandardMaterial color="#8a8a7a" roughness={0.7} metalness={0.3} wireframe={wireframe} />
      </mesh>

      {/* Cabin/sensor dome */}
      <mesh position={[0, 0.6, 0.1]} castShadow>
        <boxGeometry args={[0.8, 0.28, 0.9]} />
        <meshStandardMaterial color="#9a9a8a" roughness={0.6} metalness={0.4} wireframe={wireframe} />
      </mesh>

      {/* Solar panel left */}
      <mesh position={[-0.85, 0.55, 0]} castShadow>
        <boxGeometry args={[0.6, 0.04, 1.0]} />
        <meshStandardMaterial color="#3355aa" roughness={0.3} metalness={0.6} wireframe={wireframe} />
      </mesh>

      {/* Solar panel right */}
      <mesh position={[0.85, 0.55, 0]} castShadow>
        <boxGeometry args={[0.6, 0.04, 1.0]} />
        <meshStandardMaterial color="#3355aa" roughness={0.3} metalness={0.6} wireframe={wireframe} />
      </mesh>

      {/* Antenna mast */}
      <mesh position={[0, 0.85, -0.2]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 6]} />
        <meshStandardMaterial color="#ccccbb" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.08, -0.2]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>

      {/* Wheels — 6 wheel rover */}
      {[[-0.6, 0], [0.6, 0]].map(([xSign, _], col) =>
        [-0.65, 0, 0.65].map((zOffset, row) => (
          <mesh
            key={`${col}-${row}`}
            position={[xSign * 0.72, -0.08, zOffset]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.22, 0.22, 0.14, 10]} />
            <meshStandardMaterial color="#333322" roughness={0.95} wireframe={wireframe} />
          </mesh>
        ))
      )}
    </group>
  );
}

// === Path Tracker ===
function PathLine({ points }) {
  if (!points || points.length < 2) return null;

  // Build a Float32Array from path points [x,y,z, x,y,z, ...]
  const positions = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    positions[i * 3]     = points[i][0];
    positions[i * 3 + 1] = points[i][1];
    positions[i * 3 + 2] = points[i][2];
  }

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={points.length}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#4ecdc4" opacity={0.7} transparent />
    </line>
  );
}

// === Camera Controller ===
function CameraController({ roverRef, cameraMode, orbitRef }) {
  const { camera } = useThree();
  const offset = useRef(new THREE.Vector3(0, 5, -8));
  const targetRef = useRef(new THREE.Vector3());

  useFrame(() => {
    if (cameraMode === 'follow' && roverRef.current) {
      const rover = roverRef.current;
      // Follow camera: offset behind rover
      const angle = rover.rotation.y;
      const camX = rover.position.x - Math.sin(angle) * 8;
      const camZ = rover.position.z - Math.cos(angle) * 8;
      const camY = rover.position.y + 4;

      camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.08);
      targetRef.current.lerp(rover.position, 0.15);
      camera.lookAt(targetRef.current);

      if (orbitRef.current) orbitRef.current.target.copy(targetRef.current);
    }
  });

  return null;
}

// === Rover Physics Frame ===
function RoverPhysics({ roverRef, roverState, setRoverState, pathRef, wireframe }) {
  const { update } = useRoverController(roverRef, roverState, setRoverState, pathRef);

  useFrame(({ clock }) => {
    update(clock.getElapsedTime() * 1000);
  });

  return (
    <group ref={roverRef}>
      <RoverMesh wireframe={wireframe} />
    </group>
  );
}

// === Main Scene Component ===
export default function MoonScene({ roverState, setRoverState, pathRef, cameraMode, wireframe }) {
  const roverRef = useRef();
  const orbitRef = useRef();

  // Initialize rover at terrain height
  const initialY = getTerrainHeight(0, 0) + 0.55;

  return (
    <Canvas
      shadows
      camera={{ position: [0, 8, -12], fov: 55, near: 0.1, far: 1000 }}
      style={{ background: '#000008' }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFShadowMap;
      }}
    >
      {/* Space stars */}
      <Stars radius={400} depth={80} count={6000} factor={5} saturation={0} fade />

      {/* Sun-like directional light */}
      <directionalLight
        position={[60, 80, 40]}
        intensity={2.2}
        color="#fff5e4"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={300}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
      />

      {/* Subtle fill light — Earthshine */}
      <ambientLight intensity={0.08} color="#b0c8ff" />
      <directionalLight position={[-30, 20, -60]} intensity={0.15} color="#c8d8ff" />

      {/* Terrain */}
      <Terrain wireframe={wireframe} />

      {/* Rocks */}
      <Rocks wireframe={wireframe} />

      {/* Rover */}
      <RoverPhysics
        roverRef={roverRef}
        roverState={roverState}
        setRoverState={setRoverState}
        pathRef={pathRef}
        wireframe={wireframe}
      />

      {/* Path tracking line — uses roverState as render trigger */}
      <PathLine points={pathRef.current} />

      {/* Camera logic */}
      <CameraController roverRef={roverRef} cameraMode={cameraMode} orbitRef={orbitRef} />

      {/* Orbit controls — active in free camera mode */}
      <OrbitControls
        ref={orbitRef}
        enabled={cameraMode === 'free'}
        maxPolarAngle={Math.PI / 2.1}
        enablePan
        enableZoom
        enableRotate
      />
    </Canvas>
  );
}
