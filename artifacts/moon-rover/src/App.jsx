/**
 * Moon Rover Simulation - App
 * Multi-waypoint planning, illumination-aware routing, toast notifications.
 */

import { useState, useRef, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import RightPanel from './components/RightPanel';
import { planAllRoutes, clearPathCache, getHazardAtPoint } from './utils/pathfinder';
import { getTerrainHeight, buildHeightMap, buildSlopeMap, buildCraterMask, CRATERS } from './three/terrainGenerator';
import { LearningModel } from './utils/learningModel';
import { DUST_STATES, DUST_HAZARD_CONFIG, DEFAULT_HOME, createDustHazard } from './utils/dustHazardModel';
import { evaluateDustInterference } from './utils/sensorInterferenceEvaluator';
import { buildReturnToHomePath } from './utils/returnToHomeController';

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
  const [roverState, setRoverState] = useState({ x:-25, y:0, z:-20, speed:0, heading:0, autoMode:false });
  // waypoints: ordered array of {x, z} — first = start, last = end, middle = intermediate
  const [waypoints, setWaypoints]   = useState([]);
  const [routes, setRoutes]         = useState(null); // { SAFE:{path,stats}, ECO:{path,stats}, ... }
  const [activeRoute, setActiveRoute] = useState('AUTO');
  const [sunAngleDeg, setSunAngleDeg] = useState(45);
  const [wireframe, setWireframe]   = useState(false);
  const [cameraMode, setCameraMode] = useState('follow');
  const [routeLog, setRouteLog]     = useState([`[${ts()}] Ready. Add waypoints and press PLAN PATH.`]);
  const [isRoving, setIsRoving]     = useState(false);
  const [resetKey, setResetKey]     = useState(0);
  const [toasts, setToasts]         = useState([]);

  // ---- Dust Hazard State Machine ----
  // 'normal' | 'dust_placement_mode' | 'dust_present' | 'dust_interference_detected' | 'signal_lost' | 'stopped' | 'return_to_home'
  const [dustMode, setDustMode]     = useState(DUST_STATES.NORMAL);
  const [dustHazard, setDustHazard] = useState(null); // null | { x, z, radius }
  const [cameraSignalLost, setCameraSignalLost] = useState(false);
  const [cameraSignalQuality, setCameraSignalQuality] = useState(1);
  const homeWaypointRef    = useRef({ ...DEFAULT_HOME }); // updated by first waypoint if present
  const prevActiveRouteRef = useRef(null); // restored after return trip
  const interferenceLatchedRef = useRef(false);
  const interferenceTicksRef = useRef(0);

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

    // Hard crater check — direct distance test against every crater (full bowl + rim)
    const inCrater = CRATERS.some(c => {
      const d = Math.sqrt((pos.x - c.x) ** 2 + (pos.z - c.z) ** 2);
      return d < c.radius * 1.05;
    });
    if (inCrater) {
      showToast(
        '⛔ WAYPOINT REDDEDİLDİ — Krater içinde! Rover hiçbir zaman krater bölgelerine giremez. Düz zemin seçin.',
        'error', 7000
      );
      return;
    }

    const hazard = getHazardAtPoint(pos.x, pos.z, cm2, sm2);
    if (hazard > 0.45) {
      showToast(
        `⛔ WAYPOINT REDDEDİLDİ — Tehlikeli bölge (tehlike: ${(hazard*100).toFixed(0)}%). Daha güvenli arazi seçin.`,
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
        homeWaypointRef.current = pos; // pin home
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
    const inCrater = CRATERS.some(c => {
      const d = Math.sqrt((pos.x - c.x) ** 2 + (pos.z - c.z) ** 2);
      return d < c.radius * 1.05;
    });
    if (inCrater) {
      showToast('⛔ BAŞLANGIÇ NOKTASİ REDDEDİLDİ — Krater içinde! Düz zemin seçin.', 'error', 7000);
      return;
    }
    const hazard = getHazardAtPoint(pos.x, pos.z, cm2, sm2);
    if (hazard > 0.45) {
      showToast('⛔ BAŞLANGIÇ NOKTASİ REDDEDİLDİ — Tehlikeli bölge. Daha güvenli arazi seçin.', 'error', 6000);
      return;
    }
    const y = getTerrainHeight(pos.x, pos.z);
    setRoverState(s => ({ ...s, x: pos.x, y: y+0.45, z: pos.z }));
    setResetKey(k => k + 1);
    homeWaypointRef.current = pos; // update home when start is overridden
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
    pathRef.current._waypointIdx = undefined;
    clearPathCache();
    homeWaypointRef.current = { ...DEFAULT_HOME };
    setDustHazard(null);
    setDustMode(DUST_STATES.NORMAL);
    setCameraSignalLost(false);
    setCameraSignalQuality(1);
    interferenceLatchedRef.current = false;
    setIsRoving(false);
    if (prevActiveRouteRef.current) {
      setActiveRoute(prevActiveRouteRef.current);
      prevActiveRouteRef.current = null;
    }
    addLog('All waypoints cleared.');
  }, [addLog, setActiveRoute]);

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
      // Use _teleportTo so the controller snaps the rover to route start on next frame
      // (NO setResetKey — remounting destroys roverRef and resets position to [0,0,0])
      pathRef.current._roverTrail  = [[first[0], first[1], first[2]]];
      pathRef.current._waypointIdx = 0;
      pathRef.current._teleportTo  = { x: first[0], y: first[1], z: first[2] };
      setIsRoving(true);
      if (dustHazard) setDustMode(DUST_STATES.PRESENT);
      addLog(`Rover started on ${activeRoute} (${route.length} pts).`);
    }
  }, [activeRoute, routes, addLog, dustHazard]);

  const handleStopRover = useCallback(() => {
    pathRef.current._waypointIdx = undefined;
    setRoverState(s => ({ ...s, autoMode: false }));
    setIsRoving(false);
    if (dustHazard) setDustMode(DUST_STATES.STOPPED);
    addLog('Rover stopped.');
  }, [addLog, dustHazard]);

  useEffect(() => {
    if (roverState.autoMode === false && isRoving) setIsRoving(false);
  }, [roverState.autoMode]);

  // ---- Dust Hazard: delayed Return To Home ----
  const handleReturnToHome = useCallback(() => {
    if (dustMode === DUST_STATES.PLACEMENT) {
      setDustMode(dustHazard ? DUST_STATES.PRESENT : DUST_STATES.NORMAL);
      addLog('Dust placement cancelled.');
      return;
    }
    setDustMode(DUST_STATES.PLACEMENT);
    addLog('Dust placement mode active: click map to place dust hazard.');
  }, [dustMode, dustHazard, addLog]);

  const handleDustPlaced = useCallback((pos) => {
    const hazard = createDustHazard(pos.x, pos.z, DUST_HAZARD_CONFIG);
    setDustHazard(hazard);
    setDustMode(DUST_STATES.PRESENT);
    setCameraSignalLost(false);
    setCameraSignalQuality(1);
    interferenceLatchedRef.current = false;
    interferenceTicksRef.current = 0;
    showToast('ℹ Dust hazard placed. Rover remains active; interference monitoring enabled.', 'info', 5000);
    addLog(`Dust hazard placed at (${pos.x.toFixed(0)}, ${pos.z.toFixed(0)}). Monitoring active.`);
  }, [showToast, addLog]);

  const startReturnToHome = useCallback((triggerReason) => {
    if (interferenceLatchedRef.current) return;
    interferenceLatchedRef.current = true;

    setDustMode(DUST_STATES.INTERFERENCE);
    showToast('⚠ DUST INTERFERENCE DETECTED — optical sensor instability.', 'warning', 6000);
    addLog(`Dust interference detected (${triggerReason}).`);

    // Stage 1: signal alarm + hard stop
    setTimeout(() => {
      setDustMode(DUST_STATES.SIGNAL_LOST);
      setCameraSignalLost(true);
      setCameraSignalQuality(0.06);
      interferenceTicksRef.current = 0;
      pathRef.current._waypointIdx = undefined;
      setRoverState(s => ({ ...s, autoMode: false }));
      setIsRoving(false);

      setDustMode(DUST_STATES.STOPPED);

      // Stage 2: plan and launch return route
      const home = homeWaypointRef.current || { ...DEFAULT_HOME };
      const roverPos = { x: roverState.x, z: roverState.z };
      try {
        const maps = getMaps();
        const returnPath = buildReturnToHomePath(roverPos, home, maps, sunAngleDeg);
        if (!returnPath || returnPath.length < 2) {
          throw new Error('No valid return path available');
        }

        pathRef.current.HOME_RETURN = returnPath;
        prevActiveRouteRef.current = activeRoute;
        setRoutes(prev => ({ ...(prev || {}), HOME_RETURN: { path: returnPath, stats: null } }));
        setActiveRoute('HOME_RETURN');
        pathRef.current._roverTrail = [[roverState.x, roverState.y, roverState.z]];
        pathRef.current._waypointIdx = 0;
        pathRef.current._teleportTo = null;
        setIsRoving(true);
        setDustMode(DUST_STATES.RETURN_HOME);
        addLog(`Return To Home started (${returnPath.length} pts).`);
      } catch (err) {
        addLog(`[ERR] Return To Home planning failed: ${err.message}`);
        showToast('Return To Home path unavailable. Rover remains in safe STOPPED state.', 'error', 7000);
      }
    }, 260);
  }, [addLog, showToast, roverState.x, roverState.y, roverState.z, getMaps, sunAngleDeg, activeRoute]);

  // Continuous hazard monitoring: evaluated every navigation update via roverState changes.
  useEffect(() => {
    if (!dustHazard || !dustHazard.active) return;

    const activePath =
      routes?.[activeRoute]?.path
      || (activeRoute === 'HOME_RETURN' ? pathRef.current.HOME_RETURN : null)
      || null;

    const evalResult = evaluateDustInterference(
      roverState,
      dustHazard,
      activePath,
      DUST_HAZARD_CONFIG
    );

    if (evalResult.interferenceDetected) {
      interferenceTicksRef.current = Math.min(100, interferenceTicksRef.current + 1);
    } else {
      interferenceTicksRef.current = Math.max(0, interferenceTicksRef.current - 2);
    }

    // Start showing camera distortion later (close to signal-loss confirmation), not immediately.
    if (!cameraSignalLost) {
      const triggerTicks = DUST_HAZARD_CONFIG.triggerPersistenceTicks || 6;
      const degradeStartTicks = Math.max(1, triggerTicks - 2);
      if (interferenceTicksRef.current >= degradeStartTicks) {
        setCameraSignalQuality(evalResult.signalQuality);
      } else {
        setCameraSignalQuality(1);
      }
    }

    const sustainedInterference =
      interferenceTicksRef.current >= (DUST_HAZARD_CONFIG.triggerPersistenceTicks || 6);

    if (
      sustainedInterference
      && dustMode !== DUST_STATES.PLACEMENT
      && dustMode !== DUST_STATES.RETURN_HOME
      && dustMode !== DUST_STATES.SIGNAL_LOST
      && dustMode !== DUST_STATES.STOPPED
    ) {
      startReturnToHome(evalResult.reason);
    }
  }, [
    dustHazard,
    routes,
    activeRoute,
    roverState,
    dustMode,
    cameraSignalLost,
    startReturnToHome,
  ]);

  const handleClearDustHazard = useCallback(() => {
    setDustHazard(null);
    setDustMode(DUST_STATES.NORMAL);
    setCameraSignalLost(false);
    setCameraSignalQuality(1);
    interferenceLatchedRef.current = false;
    interferenceTicksRef.current = 0;
    setRoutes(prev => {
      if (!prev) return prev;
      // eslint-disable-next-line no-unused-vars
      const { HOME_RETURN: _unused, ...rest } = prev;
      return Object.keys(rest).length ? rest : null;
    });
    if (prevActiveRouteRef.current && activeRoute === 'HOME_RETURN') {
      setActiveRoute(prevActiveRouteRef.current);
    }
    prevActiveRouteRef.current = null;
    addLog('Dust hazard cleared and monitoring reset.');
  }, [addLog, setActiveRoute, activeRoute]);

  useEffect(() => {
    if (dustMode === DUST_STATES.RETURN_HOME && !isRoving) {
      setDustMode(DUST_STATES.STOPPED);
      setCameraSignalLost(false);
      setCameraSignalQuality(1);
      interferenceLatchedRef.current = false;
      showToast('✓ Rover returned home after dust interference event.', 'info', 5500);
      addLog('Rover reached home waypoint. Return sequence completed.');
      if (prevActiveRouteRef.current) {
        setActiveRoute(prevActiveRouteRef.current);
      }
      prevActiveRouteRef.current = null;
    }
  }, [dustMode, isRoving, showToast, addLog, setActiveRoute]);

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
            dustHazard={dustHazard}
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
        dustMode={dustMode}
        dustHazard={dustHazard}
        cameraSignalLost={cameraSignalLost}
        cameraSignalQuality={cameraSignalQuality}
        onReturnToHome={handleReturnToHome}
        onDustPlaced={handleDustPlaced}
        onClearDustHazard={handleClearDustHazard}
      />
    </div>
  );
}
