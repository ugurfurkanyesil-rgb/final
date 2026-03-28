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

function ts() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

const DEFAULT_START = { x: -38, z: -38 };
const DEFAULT_END   = { x:  38, z:  38 };

export default function App() {
  const [roverState, setRoverState] = useState({
    x: DEFAULT_START.x, y: 0, z: DEFAULT_START.z,
    speed: 0, heading: 0, autoMode: false,
  });
  const [startPos, setStartPos] = useState(DEFAULT_START);
  const [endPos, setEndPos]     = useState(DEFAULT_END);
  const [routes, setRoutes]     = useState(null);
  const [activeRoute, setActiveRoute] = useState('AUTO');
  const [sunAngleDeg, setSunAngleDeg] = useState(45);
  const [wireframe, setWireframe] = useState(false);
  const [cameraMode, setCameraMode] = useState('follow');
  const [routeLog, setRouteLog] = useState([`[${ts()}] Ready. Pick start/end or use defaults.`]);
  const [isRoving, setIsRoving] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const pathRef = useRef({ _roverTrail: [] });
  const learningModel = useMemo(() => new LearningModel(), []);

  // Precomputed terrain maps (lazy — only built once)
  const mapsRef = useRef(null);
  const getMaps = useCallback(() => {
    if (!mapsRef.current) {
      const hm = buildHeightMap();
      const sm = buildSlopeMap(hm);
      const cm = buildCraterMask();
      mapsRef.current = { hm, sm, cm };
    }
    return mapsRef.current;
  }, []);

  const addLog = useCallback((msg) => {
    setRouteLog(prev => [...prev, `[${ts()}] ${msg}`].slice(-30));
  }, []);

  const handlePlanPath = useCallback(() => {
    const s = startPos || DEFAULT_START;
    const e = endPos   || DEFAULT_END;
    addLog('Planning 4 routes...');
    setRoutes(null);

    setTimeout(() => {
      try {
        const { sm, cm } = getMaps();
        const planned = planAllRoutes(s, e, sm, cm);
        setRoutes(planned);
        // Sync into pathRef
        pathRef.current = {
          ...pathRef.current,
          SAFE: planned.SAFE,
          ECO:  planned.ECO,
          FAST: planned.FAST,
          AUTO: planned.AUTO,
        };
        for (const [mode, pts] of Object.entries(planned)) {
          addLog(`${mode}: ${pts.length} waypoints`);
        }
        addLog('Select a route and press START ROVER.');
      } catch (err) {
        addLog(`[ERR] ${err.message}`);
      }
    }, 30);
  }, [startPos, endPos, getMaps, addLog]);

  const handleStartRover = useCallback(() => {
    if (!activeRoute || !routes?.[activeRoute]) return;
    const route = routes[activeRoute];
    if (route.length > 0) {
      const first = route[0];
      pathRef.current._roverTrail = [[first[0], first[1], first[2]]];
      pathRef.current._waypointIdx = 0;
      setRoverState(s => ({ ...s, x: first[0], y: first[1], z: first[2], autoMode: true }));
      setResetKey(k => k + 1);
      setIsRoving(true);
      addLog(`Rover started on ${activeRoute} route (${route.length} pts).`);
    }
  }, [activeRoute, routes, addLog]);

  const handleStopRover = useCallback(() => {
    pathRef.current._waypointIdx = undefined;
    setRoverState(s => ({ ...s, autoMode: false }));
    setIsRoving(false);
    addLog('Rover stopped.');
  }, [addLog]);

  // Update isRoving from rover state
  useEffect(() => {
    if (roverState.autoMode === false && isRoving) {
      setIsRoving(false);
    }
  }, [roverState.autoMode]);

  const { hm, sm, cm } = useMemo(() => {
    const maps = getMaps();
    return { hm: maps.hm, sm: maps.sm, cm: maps.cm };
  }, [getMaps]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#000008' }}>
      {/* 3D Scene */}
      <div style={{ position: 'absolute', inset: 0, right: 210 }}>
        <Suspense fallback={
          <div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',
            color:'#44ff88',fontSize:13,fontFamily:'monospace',letterSpacing:'0.18em' }}>
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

      {/* HUD title */}
      <div style={{
        position:'absolute',top:10,left:12,
        color:'rgba(120,200,120,0.8)',fontFamily:'monospace',fontSize:11,
        letterSpacing:'0.2em',zIndex:15,pointerEvents:'none',
        textShadow:'0 0 8px rgba(40,180,40,0.4)',
      }}>
        MOON ROVER SIMULATOR
        <div style={{fontSize:8,color:'rgba(80,140,80,0.6)',marginTop:2}}>
          DRAG · ROTATE · SCROLL TO ZOOM
        </div>
      </div>

      {/* Right panel */}
      <RightPanel
        roverState={roverState}
        pathRef={pathRef}
        routes={routes}
        activeRoute={activeRoute}
        setActiveRoute={setActiveRoute}
        startPos={startPos}   setStartPos={setStartPos}
        endPos={endPos}       setEndPos={setEndPos}
        onPlanPath={handlePlanPath}
        sunAngleDeg={sunAngleDeg}  setSunAngleDeg={setSunAngleDeg}
        cameraMode={cameraMode}    setCameraMode={setCameraMode}
        wireframe={wireframe}      setWireframe={setWireframe}
        onStartRover={handleStartRover}
        onStopRover={handleStopRover}
        isRoving={isRoving}
        slopeMap={sm}
        craterMask={cm}
        hMap={hm}
        learningModel={learningModel}
        routeLog={routeLog}
      />
    </div>
  );
}
