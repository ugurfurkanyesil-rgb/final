/**
 * Moon Rover Simulation - App
 * Multi-waypoint planning, illumination-aware routing, toast notifications.
 */

import { useState, useRef, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import RightPanel from './components/RightPanel';
import { planAllRoutes, clearPathCache, getHazardAtPoint } from './utils/pathfinder';
import { getTerrainHeight, buildHeightMap, buildSlopeMap, buildCraterMask } from './three/terrainGenerator';
import { LearningModel } from './utils/learningModel';

const MoonScene = lazy(() => import('./components/MoonScene'));

function ts() { return new Date().toLocaleTimeString('en-US', { hour12: false }); }

// ---- Toast System ----
let _toastId = 0;

function ToastContainer({ toasts, onDismiss }) {
  return (
    <div style={{
      position:'fixed', top:14, left:'50%', transform:'translateX(-50%)',
      zIndex:9999, display:'flex', flexDirection:'column', gap:6,
      alignItems:'center', pointerEvents:'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding:'8px 18px', borderRadius:5, fontFamily:'monospace', fontSize:10,
          fontWeight:'bold', letterSpacing:0.5, pointerEvents:'all',
          cursor:'pointer', maxWidth:380, textAlign:'center',
          animation:'slideDown 0.25s ease',
          ...(t.type === 'warning' ? {
            background:'rgba(80,40,0,0.95)', border:'1px solid #ff8800',
            color:'#ffcc44', boxShadow:'0 0 12px rgba(255,120,0,0.4)',
          } : t.type === 'error' ? {
            background:'rgba(60,0,0,0.95)', border:'1px solid #ff3333',
            color:'#ff7766', boxShadow:'0 0 12px rgba(255,40,40,0.4)',
          } : {
            background:'rgba(0,40,0,0.95)', border:'1px solid #44ff66',
            color:'#88ffaa', boxShadow:'0 0 12px rgba(40,180,60,0.3)',
          }),
        }} onClick={() => onDismiss(t.id)}>
          {t.type === 'warning' ? '⚠ ' : t.type === 'error' ? '✖ ' : '✓ '}
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [roverState, setRoverState] = useState({ x:-38, y:0, z:-38, speed:0, heading:0, autoMode:false });
  // waypoints: ordered array of {x, z} — first = start, last = end, middle = intermediate
  const [waypoints, setWaypoints]   = useState([{ x:-38, z:-38 }, { x:38, z:38 }]);
  const [routes, setRoutes]         = useState(null); // { SAFE:{path,stats}, ECO:{path,stats}, ... }
  const [activeRoute, setActiveRoute] = useState('AUTO');
  const [sunAngleDeg, setSunAngleDeg] = useState(45);
  const [wireframe, setWireframe]   = useState(false);
  const [cameraMode, setCameraMode] = useState('follow');
  const [routeLog, setRouteLog]     = useState([`[${ts()}] Ready. Add waypoints and press PLAN PATH.`]);
  const [isRoving, setIsRoving]     = useState(false);
  const [resetKey, setResetKey]     = useState(0);
  const [toasts, setToasts]         = useState([]);

  const pathRef      = useRef({ _roverTrail: [] });
  const learningModel = useMemo(() => new LearningModel(), []);

  // ---- Terrain maps (built once) ----
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

  const { hm, sm, cm } = useMemo(() => {
    const m = getMaps(); return { hm: m.hm, sm: m.sm, cm: m.cm };
  }, [getMaps]);

  // ---- Toast helpers ----
  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ---- Logging ----
  const addLog = useCallback((msg) => {
    setRouteLog(prev => [...prev, `[${ts()}] ${msg}`].slice(-30));
  }, []);

  // ---- Waypoint management ----
  const addWaypoint = useCallback((pos) => {
    const { sm: sm2, cm: cm2 } = getMaps();
    const hazard = getHazardAtPoint(pos.x, pos.z, cm2, sm2);

    // Hard crater check — reject immediately if inside crater bowl
    const { col, row } = (() => {
      const GRID_RES = 256, HALF2 = 50;
      const c = Math.round(((pos.x + HALF2) / 100) * (GRID_RES - 1));
      const r = Math.round(((pos.z + HALF2) / 100) * (GRID_RES - 1));
      return { col: Math.max(0, Math.min(GRID_RES-1, c)), row: Math.max(0, Math.min(GRID_RES-1, r)) };
    })();
    const craterVal = cm2 ? cm2[row * 256 + col] : 0;

    if (craterVal > 0.75) {
      showToast(
        '⛔ WAYPOINT REJECTED — Inside a crater! Rover can never enter crater zones. Choose flat terrain.',
        'error', 7000
      );
      return;
    }
    if (hazard > 0.45) {
      showToast(
        `NO PATH FOUND — Waypoint in hazardous zone (danger: ${(hazard*100).toFixed(0)}%). Choose safer terrain.`,
        'error', 6000
      );
      return;
    }
    if (hazard > 0.25) {
      showToast(`⚠ Waypoint near hazard zone (danger: ${(hazard*100).toFixed(0)}%). Path will detour around obstacles.`, 'warning');
    }

    setWaypoints(prev => {
      const next = [...prev, pos];
      // Teleport rover to first waypoint
      if (prev.length === 0) {
        const y = getTerrainHeight(pos.x, pos.z);
        setRoverState(s => ({ ...s, x: pos.x, y: y + 0.45, z: pos.z }));
        setResetKey(k => k + 1);
        addLog(`Start set: (${pos.x.toFixed(0)}, ${pos.z.toFixed(0)}) — rover teleported.`);
      } else {
        addLog(`Waypoint ${next.length} added: (${pos.x.toFixed(0)}, ${pos.z.toFixed(0)})`);
      }
      return next;
    });
    setRoutes(null);
  }, [getMaps, showToast, addLog]);

  // Override first waypoint → always teleport rover
  const setStartWaypoint = useCallback((pos) => {
    const { sm: sm2, cm: cm2 } = getMaps();
    const col = Math.max(0, Math.min(255, Math.round(((pos.x + 50) / 100) * 255)));
    const row = Math.max(0, Math.min(255, Math.round(((pos.z + 50) / 100) * 255)));
    const craterVal = cm2 ? cm2[row * 256 + col] : 0;
    if (craterVal > 0.75) {
      showToast('⛔ WAYPOINT REJECTED — Inside a crater! Rover never enters crater zones. Choose flat terrain.', 'error', 7000);
      return;
    }
    const hazard = getHazardAtPoint(pos.x, pos.z, cm2, sm2);
    if (hazard > 0.45) {
      showToast('NO PATH FOUND — Start point in hazardous zone. Choose flat terrain.', 'error', 6000);
      return;
    }
    const y = getTerrainHeight(pos.x, pos.z);
    setRoverState(s => ({ ...s, x: pos.x, y: y+0.45, z: pos.z }));
    setResetKey(k => k + 1);
    setWaypoints(prev => {
      const next = [...prev]; next[0] = pos; return next;
    });
    setRoutes(null);
    addLog(`Start moved to (${pos.x.toFixed(0)}, ${pos.z.toFixed(0)}) — rover teleported.`);
  }, [getMaps, showToast, addLog]);

  const removeLastWaypoint = useCallback(() => {
    setWaypoints(prev => prev.length > 0 ? prev.slice(0, -1) : prev);
    setRoutes(null);
  }, []);

  const clearWaypoints = useCallback(() => {
    setWaypoints([]);
    setRoutes(null);
    pathRef.current = { _roverTrail: pathRef.current._roverTrail || [] };
    clearPathCache();
    addLog('All waypoints cleared.');
  }, [addLog]);

  // ---- Path planning ----
  const handlePlanPath = useCallback(() => {
    if (waypoints.length < 2) {
      showToast('Need at least 2 waypoints to plan a route.', 'warning');
      return;
    }
    addLog(`Planning 4 routes through ${waypoints.length} waypoints...`);
    setRoutes(null);

    setTimeout(() => {
      try {
        const { sm: sm2, cm: cm2, hm: hm2 } = getMaps();
        const planned = planAllRoutes(waypoints, sm2, cm2, hm2, sunAngleDeg);
        setRoutes(planned);
        pathRef.current = {
          ...pathRef.current,
          SAFE: planned.SAFE.path,
          ECO:  planned.ECO.path,
          FAST: planned.FAST.path,
          AUTO: planned.AUTO.path,
        };
        for (const [mode, r] of Object.entries(planned)) {
          const s = r.stats;
          addLog(`${mode}: ${r.path.length} pts, ${s?.distance.toFixed(1)}m, risk ${s?.riskPercent.toFixed(0)}%`);
        }
        addLog('Select route and press START ROVER.');
      } catch (err) {
        addLog(`[ERR] ${err.message}`);
        showToast(`Path planning failed: ${err.message}`, 'error');
      }
    }, 30);
  }, [waypoints, getMaps, sunAngleDeg, showToast, addLog]);

  // ---- Rover control ----
  const handleStartRover = useCallback(() => {
    if (!activeRoute || !routes?.[activeRoute]) return;
    const route = routes[activeRoute].path;
    if (route?.length > 0) {
      const first = route[0];
      pathRef.current._roverTrail  = [[first[0], first[1], first[2]]];
      pathRef.current._waypointIdx = 0;
      setRoverState(s => ({ ...s, x: first[0], y: first[1], z: first[2], autoMode: true }));
      setResetKey(k => k + 1);
      setIsRoving(true);
      addLog(`Rover started on ${activeRoute} (${route.length} pts).`);
    }
  }, [activeRoute, routes, addLog]);

  const handleStopRover = useCallback(() => {
    pathRef.current._waypointIdx = undefined;
    setRoverState(s => ({ ...s, autoMode: false }));
    setIsRoving(false);
    addLog('Rover stopped.');
  }, [addLog]);

  useEffect(() => {
    if (roverState.autoMode === false && isRoving) setIsRoving(false);
  }, [roverState.autoMode]);

  // Re-plan when sun angle changes significantly (10° threshold)
  const lastSunRef = useRef(sunAngleDeg);
  useEffect(() => {
    if (routes && Math.abs(sunAngleDeg - lastSunRef.current) >= 10) {
      lastSunRef.current = sunAngleDeg;
      clearPathCache();
    }
  }, [sunAngleDeg, routes]);

  // Extract just paths for MoonScene (which draws lines)
  const routePaths = useMemo(() => {
    if (!routes) return null;
    return Object.fromEntries(Object.entries(routes).map(([m, r]) => [m, r.path]));
  }, [routes]);

  const startPos = waypoints[0] || null;
  const endPos   = waypoints[waypoints.length - 1] || null;

  return (
    <div style={{ width:'100vw', height:'100vh', overflow:'hidden', position:'relative', background:'#000008' }}>
      <style>{`
        @keyframes slideDown { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* 3D Scene */}
      <div style={{ position:'absolute', inset:0, right:218 }}>
        <Suspense fallback={
          <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',
            color:'#44ff88',fontSize:13,fontFamily:'monospace',letterSpacing:'0.18em'}}>
            LOADING LUNAR SURFACE...
          </div>
        }>
          <MoonScene
            key={resetKey}
            roverState={roverState}
            setRoverState={setRoverState}
            pathRef={pathRef}
            routes={routePaths}
            activeRoute={activeRoute}
            waypoints={waypoints}
            cameraMode={cameraMode}
            wireframe={wireframe}
            sunAngleDeg={sunAngleDeg}
            learningModel={learningModel}
          />
        </Suspense>
      </div>

      {/* HUD */}
      <div style={{
        position:'absolute', top:10, left:12,
        color:'rgba(110,190,110,0.8)', fontFamily:'monospace', fontSize:11,
        letterSpacing:'0.2em', zIndex:15, pointerEvents:'none',
        textShadow:'0 0 8px rgba(40,180,40,0.4)',
      }}>
        MOON ROVER SIMULATOR
        <div style={{fontSize:8,color:'rgba(70,130,70,0.6)',marginTop:2}}>
          LEFT DRAG=PAN · RIGHT DRAG=ROTATE · SCROLL=ZOOM
        </div>
      </div>

      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Right Panel */}
      <RightPanel
        roverState={roverState}
        pathRef={pathRef}
        routes={routes}
        activeRoute={activeRoute}
        setActiveRoute={setActiveRoute}
        waypoints={waypoints}
        onAddWaypoint={addWaypoint}
        onSetStartWaypoint={setStartWaypoint}
        onRemoveLastWaypoint={removeLastWaypoint}
        onClearWaypoints={clearWaypoints}
        onPlanPath={handlePlanPath}
        sunAngleDeg={sunAngleDeg}   setSunAngleDeg={setSunAngleDeg}
        cameraMode={cameraMode}     setCameraMode={setCameraMode}
        wireframe={wireframe}       setWireframe={setWireframe}
        onStartRover={handleStartRover}
        onStopRover={handleStopRover}
        isRoving={isRoving}
        slopeMap={sm}
        craterMask={cm}
        hMap={hm}
        learningModel={learningModel}
        routeLog={routeLog}
        showToast={showToast}
      />
    </div>
  );
}
