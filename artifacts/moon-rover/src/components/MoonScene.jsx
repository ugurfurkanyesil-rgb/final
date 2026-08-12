/**
 * MoonScene - React Three Fiber 3D scene
 * 100×100m Moon terrain, detailed rover, space debris, adjustable sun.
 * Full touchpad / mouse / scroll controls.
 */

import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import {
  generateTerrain, getTerrainHeight, generateRockPositions,
  generateDebrisPositions, TERRAIN_SIZE,
  createLunarRegolithTexture, createLunarNormalMap,
} from '../three/terrainGenerator';
import { useRoverController } from '../three/roverController';
import { ROUTE_COLORS } from '../utils/constants';

// ---- Terrain ----
let _geo = null;
// Textures created once at module level so they survive HMR re-renders
let _regolithTex = null;
let _normalMap   = null;

function Terrain({ wireframe }) {
  if (!_geo)          _geo          = generateTerrain();
  if (!_regolithTex)  _regolithTex  = createLunarRegolithTexture(512);
  if (!_normalMap)    _normalMap    = createLunarNormalMap(256);

  return (
    <mesh geometry={_geo} receiveShadow>
      {wireframe ? (
        <meshStandardMaterial key="wire" wireframe color="#44aa44" />
      ) : (
        <meshStandardMaterial
          key="proc"
          vertexColors
          color="#ffffff"
          map={_regolithTex}
          normalMap={_normalMap}
          normalScale={[0.14, 0.14]}
          roughness={0.88}
          metalness={0.04}
          envMapIntensity={0.0}
        />
      )}
    </mesh>
  );
}

// ---- Detailed Procedural Rover ----
function RoverBody({ wireframe }) {
  const wMat = <meshStandardMaterial color="#1a1a10" roughness={0.95} metalness={0.05} wireframe={wireframe} />;
  const bodyMat = <meshStandardMaterial color="#8a8a7a" roughness={0.72} metalness={0.32} wireframe={wireframe} />;
  const panelMat = <meshStandardMaterial color="#1c2e88" roughness={0.22} metalness={0.75} wireframe={wireframe} />;
  const silverMat = <meshStandardMaterial color="#b4b4a0" roughness={0.55} metalness={0.55} wireframe={wireframe} />;
  const rtgMat = <meshStandardMaterial color="#6a6a58" roughness={0.80} metalness={0.40} wireframe={wireframe} />;

  return (
    <group>
      {/* Chassis */}
      <mesh position={[0, 0.21, 0]} castShadow>{bodyMat}
        <boxGeometry args={[0.88, 0.20, 1.28]} />
      </mesh>
      {/* Electronics bay */}
      <mesh position={[0, 0.43, 0.06]} castShadow>{bodyMat}
        <boxGeometry args={[0.60, 0.17, 0.82]} />
      </mesh>
      {/* Top equipment box */}
      <mesh position={[0, 0.56, -0.05]} castShadow>
        <meshStandardMaterial color="#9e9e8c" roughness={0.65} metalness={0.35} wireframe={wireframe} />
        <boxGeometry args={[0.40, 0.12, 0.55]} />
      </mesh>
      {/* RTG rear */}
      <mesh position={[0, 0.28, -0.65]} rotation={[Math.PI/2,0,0]} castShadow>{rtgMat}
        <cylinderGeometry args={[0.11, 0.11, 0.46, 8]} />
      </mesh>
      {/* RTG fins */}
      {[0,1,2,3].map(i => (
        <mesh key={i} position={[0, 0.28, -0.65]} rotation={[Math.PI/2, i*Math.PI/4, 0]} castShadow>
          <meshStandardMaterial color="#555544" roughness={0.9} metalness={0.2} />
          <boxGeometry args={[0.22, 0.025, 0.44]} />
        </mesh>
      ))}
      {/* Solar panels */}
      <mesh position={[-0.70, 0.51, 0.06]} castShadow>{panelMat}
        <boxGeometry args={[0.48, 0.022, 0.76]} />
      </mesh>
      <mesh position={[0.70, 0.51, 0.06]} castShadow>{panelMat}
        <boxGeometry args={[0.48, 0.022, 0.76]} />
      </mesh>
      {/* Panel grid lines */}
      {[-1,1].map(side => [0,1,2].map(j => (
        <mesh key={`${side}-${j}`} position={[side*0.70, 0.525, -0.18 + j*0.18]}>
          <boxGeometry args={[0.48, 0.006, 0.006]} />
          <meshStandardMaterial color="#0a1555" />
        </mesh>
      )))}
      {/* Camera mast */}
      <mesh position={[0, 0.79, 0.35]} castShadow>{silverMat}
        <cylinderGeometry args={[0.022, 0.026, 0.42, 7]} />
      </mesh>
      {/* Camera head */}
      <mesh position={[0, 1.01, 0.35]} castShadow>
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.6} wireframe={wireframe} />
        <boxGeometry args={[0.17, 0.12, 0.10]} />
      </mesh>
      {/* Camera lens */}
      <mesh position={[0, 1.01, 0.41]}>
        <cylinderGeometry args={[0.03, 0.03, 0.02, 8]} />
        <meshStandardMaterial color="#050508" roughness={0.1} metalness={0.8} />
      </mesh>
      {/* Antenna */}
      <mesh position={[0.26, 0.70, -0.12]} castShadow>{silverMat}
        <cylinderGeometry args={[0.016, 0.016, 0.35, 5]} />
      </mesh>
      <mesh position={[0.26, 0.89, -0.12]}>
        <sphereGeometry args={[0.038, 7, 7]} />
        <meshStandardMaterial color="#ff3333" emissive="#ff1111" emissiveIntensity={0.8} />
      </mesh>
      {/* 6 wheels */}
      {[-0.51, 0.51].map((xPos, ci) =>
        [-0.54, 0.0, 0.54].map((zOff, ri) => (
          <group key={`w${ci}${ri}`} position={[xPos, 0.04, zOff]}>
            <mesh rotation={[0,0,Math.PI/2]} castShadow>
              {wMat}
              <cylinderGeometry args={[0.175, 0.175, 0.095, 12]} />
            </mesh>
            {/* Tread chevrons */}
            {Array.from({length:6},(_,k) => (
              <mesh key={k} rotation={[k*Math.PI/3,0,Math.PI/2]}>
                <torusGeometry args={[0.175, 0.011, 4, 10, Math.PI*0.55]} />
                <meshStandardMaterial color="#0e0e08" />
              </mesh>
            ))}
            {/* Suspension arm */}
            <mesh position={[xPos<0?0.15:-0.15, 0.14, 0]}>
              <boxGeometry args={[0.26, 0.035, 0.035]} />
              <meshStandardMaterial color="#6a6a5a" roughness={0.8} />
            </mesh>
          </group>
        ))
      )}
    </group>
  );
}

function RoverPhysics({ roverRef, setRoverState, pathRef, activeRoute, learningModel, wireframe, initPos }) {
  const { update } = useRoverController(roverRef, setRoverState, pathRef, activeRoute, learningModel);

  useEffect(() => {
    if (roverRef.current && initPos) {
      roverRef.current.position.set(initPos.x, initPos.y, initPos.z);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ clock }) => update(clock.getElapsedTime() * 1000));
  return (
    <group ref={roverRef}>
      <group scale={[1.67, 1.67, 1.67]}>
        <RoverBody wireframe={wireframe} />
      </group>
    </group>
  );
}

// ---- Wheel Tracks ----
const MAX_TRACK_PAIRS = 600;
const TRACK_STEP      = 0.34;   // > TRACK_L → gap between marks = dashed look
const TRACK_W         = 0.17;
const TRACK_L         = 0.17;   // segment length (gap = TRACK_STEP - TRACK_L = 0.17 m)
const WHEEL_OFFSET    = 0.852;
const TRACK_LIFT      = 0.022;
const TRACK_LIFE_MS   = 1000;   // marks disappear 1 s after placement

const _ZERO_MTX = new THREE.Matrix4().makeScale(0, 0, 0);

function WheelTracks({ roverRef }) {
  const meshRef  = useRef();
  const headRef  = useRef(0);
  const totalRef = useRef(0);
  const lastPos  = useRef(null);
  const dummy    = useMemo(() => new THREE.Object3D(), []);
  const timesRef = useRef(new Float64Array(MAX_TRACK_PAIRS).fill(0));

  // Hide all slots on mount
  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < MAX_TRACK_PAIRS * 2; i++) {
      meshRef.current.setMatrixAt(i, _ZERO_MTX);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(() => {
    if (!roverRef.current || !meshRef.current) return;
    const now  = performance.now();
    const rpos = roverRef.current.position;
    let   dirty = false;

    // ---- Expire old marks ----
    for (let i = 0; i < totalRef.current; i++) {
      if (timesRef.current[i] > 0 && now - timesRef.current[i] > TRACK_LIFE_MS) {
        meshRef.current.setMatrixAt(i * 2,     _ZERO_MTX);
        meshRef.current.setMatrixAt(i * 2 + 1, _ZERO_MTX);
        timesRef.current[i] = 0;
        dirty = true;
      }
    }

    // ---- Place new mark ----
    if (!lastPos.current) {
      lastPos.current = rpos.clone();
    } else {
      const dx   = rpos.x - lastPos.current.x;
      const dz   = rpos.z - lastPos.current.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= TRACK_STEP) {
        const fx = dx / dist, fz = dz / dist;
        const rx = fz, rz = -fx;
        const headingY = Math.atan2(fx, fz);

        for (let side = 0; side < 2; side++) {
          const sign = side === 0 ? -1 : 1;
          const wx = rpos.x + sign * rx * WHEEL_OFFSET;
          const wz = rpos.z + sign * rz * WHEEL_OFFSET;
          const wy = getTerrainHeight(wx, wz) + TRACK_LIFT;
          dummy.scale.set(1, 1, 1);
          dummy.position.set(wx, wy, wz);
          dummy.rotation.set(-Math.PI / 2, 0, headingY);
          dummy.updateMatrix();
          meshRef.current.setMatrixAt(headRef.current * 2 + side, dummy.matrix);
        }
        timesRef.current[headRef.current] = now;
        lastPos.current.copy(rpos);
        headRef.current = (headRef.current + 1) % MAX_TRACK_PAIRS;
        if (totalRef.current < MAX_TRACK_PAIRS) totalRef.current++;
        dirty = true;
      }
    }

    if (dirty) meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, MAX_TRACK_PAIRS * 2]}
      count={MAX_TRACK_PAIRS * 2}
      frustumCulled={false}
      renderOrder={2}
    >
      <planeGeometry args={[TRACK_W, TRACK_L]} />
      <meshBasicMaterial
        color="#3a3328"
        opacity={0.62}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-4}
      />
    </instancedMesh>
  );
}

// ---- Dust Particles ----
const MAX_DUST       = 280;
const DUST_LIFE_MS   = 1400;  // each particle lives ~1.4 s
const DUST_SPAWN_D   = 0.22;  // spawn every 22 cm of rover travel

function DustParticles({ roverRef }) {
  const meshRef   = useRef();
  const dummy     = useMemo(() => new THREE.Object3D(), []);
  const lastPos   = useRef(null);
  const headRef   = useRef(0);

  // Per-particle buffers (TypedArrays for speed)
  const pActive = useRef(new Uint8Array(MAX_DUST));
  const pBirth  = useRef(new Float64Array(MAX_DUST));
  const pX      = useRef(new Float32Array(MAX_DUST));
  const pY      = useRef(new Float32Array(MAX_DUST));
  const pZ      = useRef(new Float32Array(MAX_DUST));
  const pVX     = useRef(new Float32Array(MAX_DUST));
  const pVY     = useRef(new Float32Array(MAX_DUST));
  const pVZ     = useRef(new Float32Array(MAX_DUST));
  const pS0     = useRef(new Float32Array(MAX_DUST)); // initial scale

  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < MAX_DUST; i++) meshRef.current.setMatrixAt(i, _ZERO_MTX);
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    const now  = performance.now();
    let   dirty = false;

    // Animate + expire existing particles
    for (let i = 0; i < MAX_DUST; i++) {
      if (!pActive.current[i]) continue;
      const age = now - pBirth.current[i];
      if (age > DUST_LIFE_MS) {
        pActive.current[i] = 0;
        meshRef.current.setMatrixAt(i, _ZERO_MTX);
        dirty = true;
        continue;
      }
      const t = age / DUST_LIFE_MS;           // 0 → 1
      const sc = pS0.current[i] * (1 - t);   // linear shrink → vanish
      pX.current[i] += pVX.current[i] * dt;
      pY.current[i] += pVY.current[i] * dt;
      pZ.current[i] += pVZ.current[i] * dt;
      pVY.current[i] *= 0.96;                // decelerate rise
      dummy.scale.set(sc, sc, sc);
      dummy.position.set(pX.current[i], pY.current[i], pZ.current[i]);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      dirty = true;
    }

    // Spawn new puffs when rover moves
    if (roverRef.current) {
      const rpos = roverRef.current.position;
      if (!lastPos.current) {
        lastPos.current = rpos.clone();
      } else {
        const dx   = rpos.x - lastPos.current.x;
        const dz   = rpos.z - lastPos.current.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist >= DUST_SPAWN_D) {
          const fx = dx / dist, fz = dz / dist;
          const count = 4 + Math.floor(Math.random() * 3); // 4–6 particles
          for (let k = 0; k < count; k++) {
            const i = headRef.current;
            headRef.current = (headRef.current + 1) % MAX_DUST;
            // spawn at ground level behind rover, slight spread
            pX.current[i] = rpos.x - fx * 0.55 + (Math.random() - 0.5) * 0.7;
            pY.current[i] = getTerrainHeight(rpos.x, rpos.z) + 0.05 + Math.random() * 0.1;
            pZ.current[i] = rpos.z - fz * 0.55 + (Math.random() - 0.5) * 0.7;
            pVX.current[i] = (Math.random() - 0.5) * 0.6;
            pVY.current[i] = 0.18 + Math.random() * 0.45; // upward drift
            pVZ.current[i] = (Math.random() - 0.5) * 0.6;
            pS0.current[i] = 0.07 + Math.random() * 0.11;
            pBirth.current[i] = now;
            pActive.current[i] = 1;
          }
          lastPos.current.copy(rpos);
          dirty = true;
        }
      }
    }

    if (dirty) meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, MAX_DUST]}
      count={MAX_DUST}
      frustumCulled={false}
      renderOrder={4}
    >
      <sphereGeometry args={[1, 5, 4]} />
      <meshBasicMaterial
        color="#c8c0b0"
        opacity={0.38}
        transparent
        depthWrite={false}
      />
    </instancedMesh>
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

// ---- Natural Dust Cloud Hazard ----
// Puff offsets are fixed fractions of hazard radius — no Math.random at render time
// so the shape is stable across re-renders.
const DUST_PUFF_OFFSETS = [
  { rx:  0.00, ry: 0.20, rz:  0.00, rs: 0.70, o: 0.18 }, // dense centre
  { rx:  0.30, ry: 0.30, rz:  0.20, rs: 0.50, o: 0.15 },
  { rx: -0.28, ry: 0.25, rz:  0.30, rs: 0.45, o: 0.14 },
  { rx:  0.22, ry: 0.42, rz: -0.28, rs: 0.42, o: 0.13 },
  { rx: -0.32, ry: 0.35, rz: -0.22, rs: 0.48, o: 0.14 },
  { rx:  0.08, ry: 0.55, rz:  0.12, rs: 0.38, o: 0.11 },
  { rx: -0.18, ry: 0.12, rz: -0.10, rs: 0.55, o: 0.16 },
  { rx:  0.24, ry: 0.18, rz: -0.18, rs: 0.40, o: 0.10 },
  { rx: -0.12, ry: 0.48, rz:  0.28, rs: 0.35, o: 0.09 },
  { rx:  0.00, ry: 0.08, rz:  0.00, rs: 0.85, o: 0.08 }, // wide low base
];

function DustCloudHazard({ hazard }) {
  const { x, z, radius } = hazard;
  const y = getTerrainHeight(x, z);
  return (
    <group position={[x, y, z]}>
      {DUST_PUFF_OFFSETS.map((p, i) => (
        <mesh key={i} position={[p.rx * radius, p.ry * radius, p.rz * radius]}>
          <sphereGeometry args={[p.rs * radius, 9, 7]} />
          <meshBasicMaterial
            color="#b8b8b8"
            transparent
            opacity={p.o}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---- Route Lines ----
function RouteLine({ points, color, active }) {
  if (!points || points.length < 2) return null;

  const tubeRadius = active ? 0.18 : 0.09;   // 1.5× thicker than old 0.12/0.06
  const lift       = active ? 0.14 : 0.08;

  const curve = useMemo(() => {
    const vecs = points.map(p => new THREE.Vector3(p[0], p[1] + lift, p[2]));
    return new THREE.CatmullRomCurve3(vecs);
  }, [points, lift]);

  const geo = useMemo(() =>
    new THREE.TubeGeometry(curve, Math.min(points.length * 2, 800), tubeRadius, 6, false),
    [curve, tubeRadius]
  );

  return (
    <mesh geometry={geo}>
      <meshBasicMaterial color={color} opacity={active ? 1.0 : 0.55} transparent />
    </mesh>
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
  dustHazard,
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
        <RouteLine key={mode} points={pts} color={ROUTE_COLORS[mode] ?? '#ff8800'} active={mode === activeRoute} />
      ))}

      {/* Dust cloud hazard — rendered in world space, anchored to terrain */}
      {dustHazard && <DustCloudHazard hazard={dustHazard} />}

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
      <WheelTracks roverRef={roverRef} />
      <DustParticles roverRef={roverRef} />

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
