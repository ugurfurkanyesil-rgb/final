/**
 * Moon Rover Simulation - App
 * Orchestrates scene, right panel, path planning, and AI learning.
 */

import { useState, useRef, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import RightPanel from './components/RightPanel';
import { planAllRoutes, clearPathCache } from './utils/pathfinder';
import { getTerrainHeight, buildHeightMap, buildSlopeMap, buildCraterMask } from './three/terrainGenerator';
import { LearningModel } from './utils/learningModel';

const MoonScene = lazy(() => import('./components/MoonScene'));

function getTimestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export default function App() {
  const [roverState, setRoverState] = useState({ x: -40, y: 0, z: -40, speed: 0, direction: 0, autoMode: false });
  const [startPos, setStartPos]   = useState(null);
  const [endPos, setEndPos]       = useState(null);
  const [pickMode, setPickMode]   = useState(null);
  const [routes, setRoutes]       = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [sunAngleDeg, setSunAngleDeg] = useState(45);
  const [heatmapType, setHeatmapType] = useState('Hazard Score');
  const [wireframe, setWireframe] = useState(false);
  const [cameraMode] = useState('follow');
  const [routeLog, setRouteLog]   = useState([]);
  const [resetKey, setResetKey]   = useState(0);

  // Path ref: stores planned routes AND rover trail
  const pathRef = useRef({ _roverTrail: [[-40, getTerrainHeight(-40, -40) + 0.45, -40]] });

  // Learning model — persists across renders
  const learningModel = useMemo(() => new LearningModel(), []);

  // Precomputed maps for path planning (lazy)
  const mapsRef = useRef(null);
  const getMaps = useCallback(() => {
    if (!mapsRef.current) {
      const hm = buildHeightMap();
      const sm = buildSlopeMap(hm);
      const cm = buildCraterMask(1.0);
      mapsRef.current = { hm, sm, cm };
    }
    return mapsRef.current;
  }, []);

  const addLog = useCallback((msg) => {
    setRouteLog(prev => [`[${getTimestamp()}] ${msg}`, ...prev].slice(0, 20));
  }, []);

  const handlePickStart = useCallback((pos) => {
    setStartPos(pos);
    setRoutes(null);
    setActiveRoute(null);
    addLog(`Start set: (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`);
    setPickMode(null);
  }, [addLog]);

  const handlePickEnd = useCallback((pos) => {
    setEndPos(pos);
    setRoutes(null);
    setActiveRoute(null);
    addLog(`End set: (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`);
    setPickMode(null);
  }, [addLog]);

  const handlePlanPath = useCallback(() => {
    const s = startPos || { x: -40, z: -40 };
    const e = endPos   || { x:  40, z:  40 };
    addLog('Planning 4 routes...');

    // Use timeout to not block render
    setTimeout(() => {
      const { sm, cm } = getMaps();
      const planned = planAllRoutes(s, e, sm, cm);
      setRoutes(planned);
      pathRef.current = { ...pathRef.current, ...planned };
      addLog(`SAFE: ${planned.SAFE.length} pts`);
      addLog(`ECO: ${planned.ECO.length} pts`);
      addLog(`FAST: ${planned.FAST.length} pts`);
      addLog(`AUTO: ${planned.AUTO.length} pts`);
      addLog('Select a route and press START.');
    }, 30);
  }, [startPos, endPos, getMaps, addLog]);

  const handleSelectRoute = useCallback((mode) => {
    setActiveRoute(mode);
    if (routes?.[mode]) {
      // Reset rover waypoint tracking
      pathRef.current._waypointIdx = 0;
    }
    addLog(`Route selected: ${mode}`);
  }, [routes, addLog]);

  const handleStartRover = useCallback(() => {
    if (!activeRoute || !routes) return;
    // Teleport rover to start of route
    const route = routes[activeRoute];
    if (route && route.length > 0) {
      const first = route[0];
      pathRef.current._roverTrail = [[first[0], first[1], first[2]]];
      setRoverState(s => ({ ...s, x: first[0], y: first[1], z: first[2] }));
      setResetKey(k => k + 1);
    }
    addLog(`Rover started on ${activeRoute} route.`);
  }, [activeRoute, routes, addLog]);

  const handleClear = useCallback(() => {
    setStartPos(null);
    setEndPos(null);
    setRoutes(null);
    setActiveRoute(null);
    setPickMode(null);
    pathRef.current = { _roverTrail: pathRef.current._roverTrail || [] };
    clearPathCache();
    addLog('Path cleared.');
  }, [addLog]);

  const handleSwapPoints = useCallback(() => {
    setStartPos(endPos);
    setEndPos(startPos);
    setRoutes(null);
    setActiveRoute(null);
    addLog('Start/End swapped.');
  }, [startPos, endPos, addLog]);

  // Initial default positions
  useEffect(() => {
    setStartPos({ x: -35, z: -35 });
    setEndPos({ x: 35, z: 35 });
    addLog('Ready. Pick start/end or use defaults.');
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#000008' }}>
      {/* 3D Scene — fills viewport minus right panel */}
      <div style={{ position: 'absolute', inset: 0, right: 170 }}>
        <Suspense fallback={
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
            color:'#4ecdc4', fontSize:14, fontFamily:'monospace', letterSpacing:'0.15em' }}>
            LOADING LUNAR SURFACE...
          </div>
        }>
          <MoonScene
            key={resetKey}
            roverState={roverState}
            setRoverState={setRoverState}
            pathRef={pathRef}
            routes={routes}
            activeRoute={activeRoute}
            startPos={startPos}
            endPos={endPos}
            cameraMode={cameraMode}
            wireframe={wireframe}
            sunAngleDeg={sunAngleDeg}
            learningModel={learningModel}
          />
        </Suspense>
      </div>

      {/* Title bar */}
      <div style={{
        position: 'absolute', top: 10, left: 12,
        color: 'rgba(160,220,160,0.85)', fontFamily: 'monospace', fontSize: 11,
        letterSpacing: '0.2em', zIndex: 15, pointerEvents: 'none',
        textShadow: '0 0 8px rgba(60,200,60,0.5)',
      }}>
        MOON ROVER SIMULATOR
        <div style={{ fontSize: 8, color: 'rgba(100,160,100,0.6)', marginTop: 2 }}>
          DRAG · ROTATE · SCROLL TO ZOOM
        </div>
      </div>

      {/* Right panel */}
      <RightPanel
        roverState={roverState}
        routes={routes}
        activeRoute={activeRoute}
        onSelectRoute={handleSelectRoute}
        startPos={startPos}
        endPos={endPos}
        onPickStart={handlePickStart}
        onPickEnd={handlePickEnd}
        onPlanPath={handlePlanPath}
        onStartRover={handleStartRover}
        onClear={handleClear}
        onSwapPoints={handleSwapPoints}
        pickMode={pickMode}
        setPickMode={setPickMode}
        sunAngleDeg={sunAngleDeg}
        onSunAngleChange={setSunAngleDeg}
        heatmapType={heatmapType}
        onHeatmapChange={setHeatmapType}
        learningModel={learningModel}
        wireframe={wireframe}
        onToggleWireframe={() => setWireframe(w => !w)}
        routeLog={routeLog}
      />
    </div>
  );
}
