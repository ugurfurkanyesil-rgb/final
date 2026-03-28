/**
 * MoonScene - React Three Fiber 3D scene
 * 100×100m Moon terrain, detailed rover, space debris, adjustable sun.
 * Full touchpad / mouse / scroll controls.
 */

import { useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';
import {
  generateTerrain, getTerrainHeight, generateRockPositions,
  generateDebrisPositions, TERRAIN_SIZE
} from '../three/terrainGenerator';
import { useRoverController } from '../three/roverController';
import { ROUTE_COLORS } from '../utils/constants';

// ---- Terrain ----
let _geo = null;
function Terrain({ wireframe }) {
  if (!_geo) _geo = generateTerrain();
  return (
    <mesh geometry={_geo} receiveShadow>
      <meshStandardMaterial
        vertexColors={!wireframe}
        color={wireframe ? '#44aa44' : '#ffffff'}
        wireframe={wireframe}
        roughness={0.97}
        metalness={0.00}
      />
    </mesh>
  );
}

// ---- STL Rover ----
const STL_URL = `${import.meta.env.BASE_URL}rover.stl`;

function RoverSTL({ wireframe }) {
  const rawGeo = useLoader(STLLoader, STL_URL);

  const geo = useMemo(() => {
    const g = rawGeo.clone();

    // 1. Bake Z-up→Y-up rotation into geometry (STL is Z-up, Three.js is Y-up)
    g.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

    // 2. Scale to fit ~1.4 units max dimension
    g.computeBoundingBox();
    const size = new THREE.Vector3();
    g.boundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = 1.4 / maxDim;
    g.scale(s, s, s);

    // 3. Bottom-align: move so Y=0 is at the lowest point (wheel contact plane)
    //    This way placing the rover at terrain_y puts wheels exactly on ground
    g.computeBoundingBox();
    g.translate(0, -g.boundingBox.min.y, 0);

    g.computeVertexNormals();
    return g;
  }, [rawGeo]);

  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial
        color="#9a9a8a"
        roughness={0.65}
        metalness={0.40}
        wireframe={wireframe}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function RoverBody({ wireframe }) {
  return (
    <Suspense fallback={null}>
      <RoverSTL wireframe={wireframe} />
    </Suspense>
  );
}

function RoverPhysics({ roverRef, setRoverState, pathRef, activeRoute, learningModel, wireframe, initPos }) {
  const { update } = useRoverController(roverRef, setRoverState, pathRef, activeRoute, learningModel);

  // Set rover's initial world position on first mount
  useEffect(() => {
    if (roverRef.current && initPos) {
      roverRef.current.position.set(initPos.x, initPos.y, initPos.z);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ clock }) => update(clock.getElapsedTime() * 1000));
  return (
    <group ref={roverRef}>
      <group scale={[5.01, 5.01, 5.01]}>
        <RoverBody wireframe={wireframe} />
      </group>
    </group>
  );
}

// ---- Rocks ----
const ROCKS = generateRockPositions(80);
function Rocks() {
  return (
    <>
      {ROCKS.map((r, i) => (
        <mesh key={i}
          position={[r.x, r.y + r.scale*0.28, r.z]}
          rotation={[r.rotX||0, r.rotY, 0.1]}
          scale={[r.scale, r.scale*0.65, r.scale*0.82]}
          castShadow receiveShadow
        >
          <dodecahedronGeometry args={[0.45, 0]} />
          <meshStandardMaterial color={`hsl(40,6%,${38 + Math.random()*12}%)`} roughness={0.94} metalness={0.03} />
        </mesh>
      ))}
    </>
  );
}

// ---- Space Debris ----
const DEBRIS = generateDebrisPositions();

function DebrisPanel({ pos, scale, rot }) {
  return (
    <group position={[pos.x, pos.y + scale*0.06, pos.z]} rotation={[0.25, rot, 0.15]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[scale*1.4, scale*0.04, scale*0.8]} />
        <meshStandardMaterial color="#3a4466" roughness={0.45} metalness={0.7} />
      </mesh>
      {/* Solar cell grid */}
      {Array.from({length:4},(_,i) => (
        <mesh key={i} position={[(-0.6+i*0.4)*scale, scale*0.03, 0]}>
          <boxGeometry args={[scale*0.32, scale*0.005, scale*0.72]} />
          <meshStandardMaterial color="#1a2255" roughness={0.3} metalness={0.8} />
        </mesh>
      ))}
      {/* Crumpled corner */}
      <mesh position={[scale*0.65, scale*0.06, scale*0.3]} rotation={[0.4, 0.3, 0.6]} castShadow>
        <boxGeometry args={[scale*0.3, scale*0.04, scale*0.25]} />
        <meshStandardMaterial color="#3a4466" roughness={0.5} metalness={0.65} />
      </mesh>
    </group>
  );
}

function DebrisTank({ pos, scale, rot }) {
  return (
    <group position={[pos.x, pos.y + scale*0.22, pos.z]} rotation={[0.3, rot, 0.2]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[scale*0.22, scale*0.22, scale*0.9, 10]} />
        <meshStandardMaterial color="#8a8070" roughness={0.6} metalness={0.55} />
      </mesh>
      <mesh position={[0, scale*0.5, 0]} castShadow>
        <sphereGeometry args={[scale*0.22, 8, 8]} />
        <meshStandardMaterial color="#7a7060" roughness={0.65} metalness={0.5} />
      </mesh>
      {/* Scorch marks */}
      <mesh position={[scale*0.15, 0, 0]} rotation={[0.1,0,0.5]}>
        <boxGeometry args={[scale*0.08, scale*0.7, scale*0.05]} />
        <meshStandardMaterial color="#2a2218" roughness={0.98} metalness={0.1} transparent opacity={0.75} />
      </mesh>
    </group>
  );
}

function DebrisHull({ pos, scale, rot }) {
  return (
    <group position={[pos.x, pos.y + scale*0.08, pos.z]} rotation={[0.15, rot, 0.1]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[scale*0.9, scale*0.18, scale*0.55]} />
        <meshStandardMaterial color="#5a5848" roughness={0.75} metalness={0.45} />
      </mesh>
      {/* Torn edge */}
      <mesh position={[scale*0.42, scale*0.05, 0]} rotation={[0,0,0.4]} castShadow>
        <boxGeometry args={[scale*0.15, scale*0.22, scale*0.5]} />
        <meshStandardMaterial color="#4a4838" roughness={0.8} metalness={0.4} />
      </mesh>
      {/* Wiring bundle */}
      <mesh position={[-scale*0.3, scale*0.12, 0]} rotation={[0.2,0,0.3]}>
        <cylinderGeometry args={[scale*0.04, scale*0.04, scale*0.6, 5]} />
        <meshStandardMaterial color="#1a3a1a" roughness={0.9} metalness={0.3} />
      </mesh>
    </group>
  );
}

function DebrisStrut({ pos, scale, rot }) {
  return (
    <group position={[pos.x, pos.y + scale*0.04, pos.z]} rotation={[0.2, rot, 0.05]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[scale*0.06, scale*0.08, scale*2.2, 7]} />
        <meshStandardMaterial color="#9a9080" roughness={0.7} metalness={0.5} />
      </mesh>
      {/* Broken joint */}
      <mesh position={[0, scale*1.05, 0]} rotation={[0.5,0.3,0.4]}>
        <boxGeometry args={[scale*0.2, scale*0.14, scale*0.18]} />
        <meshStandardMaterial color="#7a7060" roughness={0.75} metalness={0.45} />
      </mesh>
    </group>
  );
}

function SpaceDebris() {
  return (
    <>
      {DEBRIS.map((d, i) => {
        const p = d;
        if (d.type === 'panel')  return <DebrisPanel  key={i} pos={p} scale={d.scale} rot={d.rot} />;
        if (d.type === 'tank')   return <DebrisTank   key={i} pos={p} scale={d.scale} rot={d.rot} />;
        if (d.type === 'hull')   return <DebrisHull   key={i} pos={p} scale={d.scale} rot={d.rot} />;
        if (d.type === 'strut')  return <DebrisStrut  key={i} pos={p} scale={d.scale} rot={d.rot} />;
        return null;
      })}
    </>
  );
}

// ---- Route Lines ----
function RouteLine({ points, color, active }) {
  if (!points || points.length < 2) return null;
  const positions = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    positions[i*3]   = points[i][0];
    positions[i*3+1] = points[i][1] + (active ? 0.14 : 0.08);
    positions[i*3+2] = points[i][2];
  }
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={points.length} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color={color} opacity={active ? 1.0 : 0.5} transparent />
    </line>
  );
}

function TrailLine({ points }) {
  if (!points || points.length < 2) return null;
  const positions = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    positions[i*3]   = points[i][0];
    positions[i*3+1] = points[i][1] + 0.06;
    positions[i*3+2] = points[i][2];
  }
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={points.length} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color="#ffffff" opacity={0.35} transparent />
    </line>
  );
}

// ---- Waypoint markers (numbered) ----
const WP_COLORS = ['#22ff55','#ffcc22','#44ddff','#ff88ff','#ff4422','#aaffaa'];

function WaypointMarker({ pos, idx, total }) {
  if (!pos) return null;
  const y = getTerrainHeight(pos.x, pos.z);
  const isStart = idx === 0;
  const isEnd   = idx === total - 1;
  const color = isStart ? '#22ff55' : isEnd ? '#ff4422' : WP_COLORS[idx % WP_COLORS.length];
  const h = isStart ? 1.4 : isEnd ? 1.4 : 1.0;
  return (
    <group position={[pos.x, y, pos.z]}>
      <mesh>
        <cylinderGeometry args={[0, 0.30, h, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.30, 0.30, 0.07, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

// ---- Camera ----
function CameraController({ roverRef, cameraMode, orbitRef }) {
  useFrame(({ camera }) => {
    if (cameraMode === 'follow' && roverRef.current) {
      const rover = roverRef.current;
      const angle = rover.rotation.y;
      camera.position.lerp(
        new THREE.Vector3(
          rover.position.x - Math.sin(angle) * 14,
          rover.position.y + 13,
          rover.position.z - Math.cos(angle) * 14
        ),
        0.055
      );
      const target = rover.position.clone();
      camera.lookAt(target);
      if (orbitRef.current) orbitRef.current.target.lerp(target, 0.07);
    }
  });
  return null;
}

// ---- Main export ----
export default function MoonScene({
  roverState, setRoverState, pathRef,
  routes, activeRoute,
  waypoints,
  cameraMode, wireframe, sunAngleDeg,
  learningModel,
}) {
  const roverRef = useRef();
  const orbitRef = useRef();

  const sunRad = (sunAngleDeg * Math.PI) / 180;
  const sunX = Math.sin(sunRad) * 75;
  const sunZ = -Math.cos(sunRad) * 75;
  const sunY = 68;

  const trail = pathRef.current._roverTrail || [];

  return (
    <Canvas
      shadows
      camera={{ position: [0, 30, -24], fov: 46, near: 0.1, far: 800 }}
      style={{ background: '#000008' }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <Stars radius={280} depth={55} count={4500} factor={3.5} saturation={0} fade />

      {/* Sun */}
      <directionalLight
        position={[sunX, sunY, sunZ]}
        intensity={1.9}
        color="#fffaf2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={220}
        shadow-camera-left={-65}
        shadow-camera-right={65}
        shadow-camera-top={65}
        shadow-camera-bottom={-65}
      />
      {/* Earthshine fill */}
      <ambientLight intensity={0.065} color="#b8caff" />
      <directionalLight position={[-35, 12, -55]} intensity={0.10} color="#b0c0ff" />

      <Terrain wireframe={wireframe} />
      <Rocks />
      <SpaceDebris />

      {/* Routes */}
      {routes && Object.entries(routes).map(([mode, pts]) => (
        <RouteLine key={mode} points={pts} color={ROUTE_COLORS[mode]} active={mode === activeRoute} />
      ))}

      {/* Numbered waypoint markers */}
      {waypoints && waypoints.map((wp, i) => (
        <WaypointMarker key={i} pos={wp} idx={i} total={waypoints.length} />
      ))}

      <RoverPhysics
        roverRef={roverRef}
        setRoverState={setRoverState}
        pathRef={pathRef}
        activeRoute={activeRoute}
        learningModel={learningModel}
        wireframe={wireframe}
        initPos={roverState}
      />

      <CameraController roverRef={roverRef} cameraMode={cameraMode} orbitRef={orbitRef} />

      {/* Map-like controls: LEFT=PAN, RIGHT=ROTATE, SCROLL=ZOOM, TOUCH=PAN+PINCH */}
      <OrbitControls
        ref={orbitRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        enableDamping={true}
        dampingFactor={0.07}
        maxPolarAngle={Math.PI / 2.02}
        minDistance={4}
        maxDistance={130}
        zoomSpeed={1.4}
        panSpeed={0.9}
        rotateSpeed={0.55}
        mouseButtons={{
          LEFT:   THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT:  THREE.MOUSE.ROTATE,
        }}
        touches={{
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_ROTATE,
        }}
      />
    </Canvas>
  );
}
