/**
 * RightPanel — Mission Control UI
 * Features:
 *  - Terrain-rendered 2D mini-map with zoom/pan + waypoint picking
 *  - Sun direction 360° dial
 *  - Route selector (4 modes)
 *  - Heatmap viewer
 *  - AI Learning stats
 *  - Telemetry
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { TERRAIN_SIZE, CRATERS } from '../three/terrainGenerator';
import { ROUTE_COLORS } from '../utils/constants';
import { getTerrainCanvas } from '../utils/terrainRenderer';
import { generateHeatmapCanvas } from '../utils/heatmaps';

const HALF = TERRAIN_SIZE / 2;
const PANEL_W = 210;
const MAP_SIZE = 194; // px

const HEATMAP_OPTIONS = [
  'Slope','Slope Angle','Roughness','Slip Risk','Illumination','Hazard Score','Traversability'
];

// ---- helpers ----
function worldToMapXY(wx, wz, viewX, viewY, zoom, mapSize) {
  const cx = ((wx + HALF) / TERRAIN_SIZE) * mapSize;
  const cy = ((wz + HALF) / TERRAIN_SIZE) * mapSize;
  return { x: (cx - viewX) * zoom, y: (cy - viewY) * zoom };
}

function mapXYToWorld(mx, my, viewX, viewY, zoom, mapSize) {
  const cx = mx / zoom + viewX;
  const cy = my / zoom + viewY;
  return {
    wx: (cx / mapSize) * TERRAIN_SIZE - HALF,
    wz: (cy / mapSize) * TERRAIN_SIZE - HALF,
  };
}

function clampView(vx, vy, zoom, size) {
  const span = size / zoom;
  return {
    vx: Math.max(0, Math.min(Math.max(0, size - span), vx)),
    vy: Math.max(0, Math.min(Math.max(0, size - span), vy)),
  };
}

// ---- Mini Map component ----
function MiniMap({
  startPos, endPos, roverPos, routes, activeRoute,
  pickMode, onPick,
}) {
  const canvasRef = useRef(null);
  const terrainRef = useRef(null);
  const zoomRef = useRef(1);
  const viewRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef(null);

  useEffect(() => {
    terrainRef.current = getTerrainCanvas(MAP_SIZE * 2);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const zoom = zoomRef.current;
    const vx = viewRef.current.x;
    const vy = viewRef.current.y;

    ctx.clearRect(0, 0, W, H);

    // Terrain base image
    if (terrainRef.current) {
      const srcSize = terrainRef.current.width; // MAP_SIZE * 2
      const span = (MAP_SIZE / zoom);
      ctx.drawImage(
        terrainRef.current,
        (vx / MAP_SIZE) * srcSize, (vy / MAP_SIZE) * srcSize,
        (span / MAP_SIZE) * srcSize, (span / MAP_SIZE) * srcSize,
        0, 0, W, H
      );
    }

    // Grid
    ctx.strokeStyle = 'rgba(80,130,80,0.18)';
    ctx.lineWidth = 0.5;
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const wx = -HALF + (i/steps)*TERRAIN_SIZE;
      const mp = worldToMapXY(wx, 0, vx, vy, zoom, MAP_SIZE);
      ctx.beginPath(); ctx.moveTo(mp.x, 0); ctx.lineTo(mp.x, H); ctx.stroke();
      const wz = -HALF + (i/steps)*TERRAIN_SIZE;
      const mp2 = worldToMapXY(0, wz, vx, vy, zoom, MAP_SIZE);
      ctx.beginPath(); ctx.moveTo(0, mp2.y); ctx.lineTo(W, mp2.y); ctx.stroke();
    }

    // Crater overlays
    for (const c of CRATERS) {
      const mp = worldToMapXY(c.x, c.z, vx, vy, zoom, MAP_SIZE);
      const r = (c.radius / TERRAIN_SIZE) * MAP_SIZE * zoom;
      // Danger gradient fill
      const g = ctx.createRadialGradient(mp.x, mp.y, 0, mp.x, mp.y, r);
      g.addColorStop(0, 'rgba(80,10,0,0.30)');
      g.addColorStop(0.65, 'rgba(60,20,0,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(mp.x, mp.y, r, 0, Math.PI*2);
      ctx.fillStyle = g; ctx.fill();
      // Rim ring
      ctx.beginPath(); ctx.arc(mp.x, mp.y, r * 1.05, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(210,200,175,0.40)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.beginPath(); ctx.arc(mp.x, mp.y, r * 1.12, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(255,250,220,0.10)'; ctx.lineWidth = 1.6; ctx.stroke();
    }

    // Routes
    if (routes) {
      for (const [mode, pts] of Object.entries(routes)) {
        if (!pts || pts.length < 2) continue;
        const isActive = mode === activeRoute;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const mp = worldToMapXY(pts[i][0], pts[i][2], vx, vy, zoom, MAP_SIZE);
          i === 0 ? ctx.moveTo(mp.x, mp.y) : ctx.lineTo(mp.x, mp.y);
        }
        ctx.strokeStyle = ROUTE_COLORS[mode];
        ctx.lineWidth = isActive ? 2.4 : 1.0;
        ctx.globalAlpha = isActive ? 1.0 : 0.38;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }
    }

    // Waypoints
    const drawMarker = (pos, color, label) => {
      const mp = worldToMapXY(pos.x, pos.z, vx, vy, zoom, MAP_SIZE);
      // Glow
      const g = ctx.createRadialGradient(mp.x, mp.y, 0, mp.x, mp.y, 9);
      g.addColorStop(0, color + 'aa'); g.addColorStop(1, color + '00');
      ctx.beginPath(); ctx.arc(mp.x, mp.y, 9, 0, Math.PI*2);
      ctx.fillStyle = g; ctx.fill();
      // Dot
      ctx.beginPath(); ctx.arc(mp.x, mp.y, 4.5, 0, Math.PI*2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 0.8; ctx.stroke();
      // Label
      ctx.fillStyle = '#fff'; ctx.font = 'bold 7px monospace';
      ctx.fillText(label, mp.x - 3, mp.y + 2.5);
    };
    if (startPos) drawMarker(startPos, '#22ff66', 'S');
    if (endPos)   drawMarker(endPos,   '#ff4422', 'E');

    // Rover arrow
    if (roverPos) {
      const mp = worldToMapXY(roverPos.x, roverPos.z, vx, vy, zoom, MAP_SIZE);
      ctx.save();
      ctx.translate(mp.x, mp.y);
      ctx.rotate(roverPos.heading || 0);
      ctx.beginPath();
      ctx.moveTo(0, -5.5); ctx.lineTo(3.8, 5); ctx.lineTo(0, 3); ctx.lineTo(-3.8, 5);
      ctx.closePath();
      ctx.fillStyle = '#FFD700'; ctx.fill();
      ctx.strokeStyle = '#806000'; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.restore();
    }

    // Pick mode overlay
    if (pickMode) {
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fillRect(0, H-18, W, 18);
      ctx.fillStyle = pickMode === 'start' ? '#22ff66' : '#ff4422';
      ctx.font = '7.5px monospace';
      ctx.fillText(` CLICK → SET ${pickMode.toUpperCase()}`, 4, H-6);
    }

    // Zoom badge
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W-30, 3, 27, 13);
    ctx.fillStyle = '#88cc88'; ctx.font = '7px monospace';
    ctx.fillText(`${zoom.toFixed(1)}x`, W-26, 12.5);
  }, [routes, activeRoute, startPos, endPos, roverPos, pickMode]);

  useEffect(() => { draw(); }, [draw]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.35 : -0.35;
    const newZ = Math.max(1, Math.min(8, zoomRef.current + delta));
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (MAP_SIZE / rect.width);
    const my = (e.clientY - rect.top)  * (MAP_SIZE / rect.height);
    const wx0 = mx / zoomRef.current + viewRef.current.x;
    const wy0 = my / zoomRef.current + viewRef.current.y;
    zoomRef.current = newZ;
    const { vx, vy } = clampView(wx0 - mx/newZ, wy0 - my/newZ, newZ, MAP_SIZE);
    viewRef.current = { x: vx, y: vy };
    draw();
  }, [draw]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const onMouseDown = useCallback((e) => {
    if (pickMode) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y };
  }, [pickMode]);

  const onMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = MAP_SIZE / rect.width;
    const scaleY = MAP_SIZE / rect.height;
    const dx = (e.clientX - dragRef.current.sx) * scaleX / zoomRef.current;
    const dy = (e.clientY - dragRef.current.sy) * scaleY / zoomRef.current;
    const { vx, vy } = clampView(dragRef.current.vx - dx, dragRef.current.vy - dy, zoomRef.current, MAP_SIZE);
    viewRef.current = { x: vx, y: vy };
    draw();
  }, [draw]);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  const onClick = useCallback((e) => {
    if (!pickMode || dragRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (MAP_SIZE / rect.width);
    const my = (e.clientY - rect.top)  * (MAP_SIZE / rect.height);
    const { wx, wz } = mapXYToWorld(mx, my, viewRef.current.x, viewRef.current.y, zoomRef.current, MAP_SIZE);
    onPick({ x: Math.max(-HALF+2, Math.min(HALF-2, wx)), z: Math.max(-HALF+2, Math.min(HALF-2, wz)) });
  }, [pickMode, onPick]);

  return (
    <canvas
      ref={canvasRef}
      width={MAP_SIZE} height={MAP_SIZE}
      style={{
        width: MAP_SIZE, height: MAP_SIZE, display: 'block',
        cursor: pickMode ? 'crosshair' : 'grab',
        border: '1px solid rgba(80,130,60,0.4)',
        borderRadius: 3, imageRendering: 'pixelated',
      }}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    />
  );
}

// ---- Sun Dial ----
function SunDial({ angle, onChange }) {
  const SIZE = 70;
  const cx = SIZE/2, cy = SIZE/2, r = 26;
  const rad = (angle * Math.PI) / 180;
  const sx = cx + Math.sin(rad) * r;
  const sy = cy - Math.cos(rad) * r;
  const dragging = useRef(false);

  const getAngle = (e, rect) => {
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top  - cy;
    return ((Math.atan2(x, -y) * 180 / Math.PI) + 360) % 360;
  };

  return (
    <svg width={SIZE} height={SIZE} style={{ cursor: 'crosshair', flexShrink: 0 }}
      onMouseDown={e => {
        dragging.current = true;
        onChange(Math.round(getAngle(e, e.currentTarget.getBoundingClientRect())));
      }}
      onMouseMove={e => {
        if (!dragging.current) return;
        onChange(Math.round(getAngle(e, e.currentTarget.getBoundingClientRect())));
      }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(80,120,60,0.5)" strokeWidth={1.2}/>
      {[0,45,90,135,180,225,270,315].map(a => {
        const ar = a * Math.PI / 180;
        return <line key={a}
          x1={cx+Math.sin(ar)*(r-4)} y1={cy-Math.cos(ar)*(r-4)}
          x2={cx+Math.sin(ar)*(r+1)} y2={cy-Math.cos(ar)*(r+1)}
          stroke="rgba(100,160,80,0.5)" strokeWidth={a%90===0?1.4:0.6}
        />;
      })}
      <text x={cx} y={cy-r-3} textAnchor="middle" fontSize={6} fill="rgba(120,180,100,0.7)" fontFamily="monospace">N</text>
      <line x1={cx} y1={cy} x2={sx} y2={sy} stroke="#FFD700" strokeWidth={1.5} opacity={0.85}/>
      <circle cx={sx} cy={sy} r={5.2} fill="#FFD700" opacity={0.92}/>
      <circle cx={sx} cy={sy} r={8.5} fill="none" stroke="#FFD700" strokeWidth={0.5} opacity={0.3}/>
      <circle cx={cx} cy={cy} r={2.5} fill="rgba(120,180,100,0.65)"/>
    </svg>
  );
}

// ---- Heatmap section ----
const HM_COLORS = {
  'Slope':         '#aaddaa', 'Slope Angle':'#88ccff', 'Roughness':     '#ffcc88',
  'Slip Risk':     '#ff8844', 'Illumination':'#ffffaa', 'Hazard Score':  '#ff6655',
  'Traversability':'#44ffaa',
};

function HeatmapViewer({ slopeMap, craterMask, hMap, sunAngle }) {
  const canvasRef = useRef(null);
  const [selected, setSelected] = useState('Hazard Score');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    generateHeatmapCanvas(canvasRef.current, selected, slopeMap, craterMask, hMap, sunAngle);
  }, [selected, slopeMap, craterMask, hMap, sunAngle]);

  return (
    <div style={{ marginBottom: 8 }}>
      <Label>Parameter Heatmap</Label>
      <div style={{ position: 'relative', marginBottom: 5, marginTop: 4 }}>
        <div onClick={() => setOpen(o => !o)} style={{
          background: 'rgba(20,40,20,0.7)', border: '1px solid rgba(60,100,60,0.5)',
          borderRadius: 3, padding: '3px 7px', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 9, color: HM_COLORS[selected]||'#aaaaaa', fontFamily: 'monospace',
        }}>
          {selected}
          <span style={{color:'#558855', marginLeft:6}}>▼</span>
        </div>
        {open && (
          <div style={{
            position:'absolute',top:'100%',left:0,right:0,zIndex:100,
            background:'rgba(8,20,8,0.97)',border:'1px solid rgba(60,100,60,0.5)',
            borderRadius:3,overflow:'hidden',
          }}>
            {HEATMAP_OPTIONS.map(opt => (
              <div key={opt} onClick={() => { setSelected(opt); setOpen(false); }}
                style={{
                  padding:'4px 7px',fontSize:9,cursor:'pointer',fontFamily:'monospace',
                  color: HM_COLORS[opt]||'#aaaaaa',
                  background: opt===selected ? 'rgba(40,80,40,0.5)' : 'transparent',
                }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(30,60,30,0.6)'}
                onMouseLeave={e=>e.currentTarget.style.background=opt===selected?'rgba(40,80,40,0.5)':'transparent'}
              >{opt}</div>
            ))}
          </div>
        )}
      </div>
      <canvas ref={canvasRef} width={MAP_SIZE} height={MAP_SIZE}
        style={{width:MAP_SIZE,height:MAP_SIZE,display:'block',borderRadius:3,
          border:'1px solid rgba(80,120,60,0.35)'}} />
      <div style={{display:'flex',justifyContent:'space-between',fontSize:7,color:'#668866',marginTop:2}}>
        <span>LOW</span>
        <span style={{color:HM_COLORS[selected]}}>{selected.toUpperCase()}</span>
        <span>HIGH</span>
      </div>
    </div>
  );
}

// ---- Main Export ----
export default function RightPanel({
  roverState, pathRef,
  routes, activeRoute, setActiveRoute,
  startPos, setStartPos,
  endPos, setEndPos,
  onPlanPath,
  sunAngleDeg, setSunAngleDeg,
  cameraMode, setCameraMode,
  wireframe, setWireframe,
  onStartRover, onStopRover, isRoving,
  slopeMap, craterMask, hMap,
  learningModel, routeLog,
}) {
  const [pickMode, setPickMode] = useState(null);

  const handlePick = useCallback((pos) => {
    if (pickMode === 'start')   { setStartPos(pos); setPickMode(null); }
    else if (pickMode === 'end'){ setEndPos(pos);   setPickMode(null); }
  }, [pickMode, setStartPos, setEndPos]);

  const { x=0, z=0, speed=0, heading=0 } = roverState || {};
  const trail = pathRef?.current?._roverTrail?.length || 0;
  const lm = learningModel?.getStats?.() || { traversals:0, cellsKnown:0, maxHazard:0 };

  return (
    <div style={{
      position:'fixed',right:0,top:0,bottom:0,width:PANEL_W,
      background:'rgba(5,12,5,0.95)',
      borderLeft:'1px solid rgba(40,80,40,0.5)',
      display:'flex',flexDirection:'column',overflowY:'auto',
      zIndex:10, backdropFilter:'blur(5px)',
    }}>
      {/* Header */}
      <div style={{padding:'8px 10px 6px',borderBottom:'1px solid rgba(40,80,40,0.4)',background:'rgba(0,16,0,0.65)'}}>
        <div style={{color:'#44ff55',fontSize:10,fontWeight:'bold',letterSpacing:2}}>MOON ROVER SIM</div>
        <div style={{color:'#2a5c2a',fontSize:7,letterSpacing:1}}>MISSION CONTROL TERMINAL</div>
      </div>

      <div style={{flex:1,padding:'7px 8px',display:'flex',flexDirection:'column',gap:9}}>

        {/* Terrain */}
        <Section label="Terrain Mode">
          <div style={{display:'flex',gap:4}}>
            <Btn active={!wireframe} onClick={()=>setWireframe(false)}>PROCEDURAL</Btn>
            <Btn active={wireframe}  onClick={()=>setWireframe(true)}>WIRE</Btn>
          </div>
        </Section>

        {/* Mini-map */}
        <Section label="Topographic Map">
          <div style={{fontSize:7,color:'#4a7a4a',marginBottom:4}}>
            Scroll to zoom · Drag to pan · Click in pick mode
          </div>
          <MiniMap
            startPos={startPos} endPos={endPos}
            roverPos={{x,z,heading}}
            routes={routes} activeRoute={activeRoute}
            pickMode={pickMode}
            onPick={handlePick}
          />
          <div style={{fontSize:7,color:'#557755',marginTop:3,display:'flex',gap:4,justifyContent:'space-between'}}>
            <span style={{color:startPos?'#22ff66':'#3a5a3a'}}>
              S: {startPos ? `${startPos.x.toFixed(0)},${startPos.z.toFixed(0)}` : '--'}
            </span>
            <span style={{color:endPos?'#ff4422':'#5a3a3a'}}>
              E: {endPos ? `${endPos.x.toFixed(0)},${endPos.z.toFixed(0)}` : '--'}
            </span>
          </div>
        </Section>

        {/* Waypoints */}
        <Section label="Waypoints">
          <div style={{display:'flex',gap:3,marginBottom:4}}>
            <Btn active={pickMode==='start'} color="#22ff66"
              onClick={()=>setPickMode(p=>p==='start'?null:'start')}>
              {pickMode==='start'?'● PICKING…':'PICK START'}
            </Btn>
            <Btn active={pickMode==='end'} color="#ff4422"
              onClick={()=>setPickMode(p=>p==='end'?null:'end')}>
              {pickMode==='end'?'● PICKING…':'PICK END'}
            </Btn>
          </div>
          <div style={{display:'flex',gap:3}}>
            <Btn onClick={()=>{setStartPos(null);setEndPos(null);setPickMode(null);}}>CLEAR</Btn>
            <Btn onClick={()=>{const t=startPos;setStartPos(endPos);setEndPos(t);}}>SWAP</Btn>
            <Btn disabled={!startPos||!endPos} onClick={onPlanPath}
              style={{flex:1,background:'rgba(0,70,0,0.55)',borderColor:'rgba(0,180,0,0.5)',
                color:'#55ff55',fontWeight:'bold'}}>
              PLAN PATH
            </Btn>
          </div>
        </Section>

        {/* Sun */}
        <Section label="Sun Direction">
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <SunDial angle={sunAngleDeg} onChange={setSunAngleDeg}/>
            <div style={{flex:1}}>
              <div style={{color:'#FFD700',fontSize:13,fontWeight:'bold',marginBottom:4}}>{sunAngleDeg}°</div>
              <input type="range" min={0} max={359} value={sunAngleDeg}
                onChange={e=>setSunAngleDeg(Number(e.target.value))}
                style={{width:'100%'}}/>
              <div style={{color:'#554433',fontSize:7,marginTop:2}}>
                {['N','NE','E','SE','S','SW','W','NW','N'][Math.round(sunAngleDeg/45)%8]} DIRECTION
              </div>
            </div>
          </div>
        </Section>

        {/* Routes */}
        <Section label="Select Route">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginBottom:5}}>
            {Object.entries(ROUTE_COLORS).map(([mode,color])=>(
              <div key={mode} onClick={()=>setActiveRoute(mode)} style={{
                padding:'5px 4px',textAlign:'center',cursor:'pointer',borderRadius:3,
                fontSize:9,fontWeight:'bold',
                border:`1px solid ${activeRoute===mode?color:'rgba(50,80,50,0.35)'}`,
                color: activeRoute===mode ? color : '#557755',
                background: activeRoute===mode ? 'rgba(0,0,0,0.45)' : 'rgba(8,16,8,0.35)',
                boxShadow: activeRoute===mode ? `0 0 8px ${color}44` : 'none',
                transition:'all 0.13s',
              }}>
                <span style={{display:'inline-block',width:6,height:6,borderRadius:'50%',
                  background:color,marginRight:4,verticalAlign:'middle'}}/>
                {mode}
              </div>
            ))}
          </div>
          <Btn onClick={isRoving?onStopRover:onStartRover}
            disabled={!routes||!routes[activeRoute]}
            style={{
              width:'100%',padding:'7px 0',
              background:isRoving?'rgba(70,0,0,0.6)':'rgba(0,70,0,0.6)',
              border:`1px solid ${isRoving?'rgba(180,40,40,0.6)':'rgba(40,180,40,0.6)'}`,
              color:isRoving?'#ff5533':'#44ff88',
              fontSize:10,fontWeight:'bold',letterSpacing:1,
            }}>
            {isRoving ? '■  STOP ROVER' : '▶  START ROVER'}
          </Btn>
        </Section>

        {/* Camera */}
        <Section label="Camera">
          <div style={{display:'flex',gap:4}}>
            <Btn active={cameraMode==='free'}   onClick={()=>setCameraMode('free')}>FREE</Btn>
            <Btn active={cameraMode==='follow'} onClick={()=>setCameraMode('follow')}>FOLLOW</Btn>
          </div>
        </Section>

        {/* Heatmap */}
        <HeatmapViewer slopeMap={slopeMap} craterMask={craterMask} hMap={hMap} sunAngle={sunAngleDeg}/>

        {/* AI */}
        <Section label="AI Learning">
          <div style={{fontSize:8,color:'#669966',lineHeight:1.9,fontFamily:'monospace'}}>
            <div>Traversals:  <span style={{color:'#99ff99'}}>{lm.traversals}</span></div>
            <div>Cells known: <span style={{color:'#99ff99'}}>{lm.cellsKnown}</span></div>
            <div>Max hazard:  <span style={{color:lm.maxHazard>0.7?'#ff6644':'#99ff99'}}>{(lm.maxHazard||0).toFixed(3)}</span></div>
          </div>
        </Section>

        {/* Telemetry */}
        <Section label="Telemetry">
          <div style={{fontFamily:'monospace',fontSize:8,color:'#669966',lineHeight:1.9}}>
            <div>X: <Val>{x.toFixed(1)}</Val>  Z: <Val>{z.toFixed(1)}</Val></div>
            <div>Speed: <Val>{(speed*3.6).toFixed(1)}</Val> km/h</div>
            <div>Heading: <Val>{((heading*180/Math.PI+360)%360).toFixed(0)}°</Val></div>
            <div>Trail pts: <Val>{trail}</Val></div>
          </div>
        </Section>

        {/* Log */}
        <Section label="Route Log">
          <div style={{fontSize:7,color:'#4a7a4a',maxHeight:72,overflowY:'auto'}}>
            {routeLog?.length
              ? routeLog.slice(-12).map((l,i)=>(
                  <div key={i} style={{color:l.startsWith('[ERR]')?'#ff6644':'#668866',marginBottom:1}}>{l}</div>
                ))
              : <div style={{color:'#2a4a2a'}}>▶ Press PLAN PATH to begin.</div>
            }
          </div>
        </Section>

      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <Label>{label}</Label>
      <div style={{marginTop:4}}>{children}</div>
      <div style={{height:1,background:'rgba(40,80,40,0.2)',marginTop:8}}/>
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{color:'#4a7a4a',fontSize:7,textTransform:'uppercase',letterSpacing:1.2}}>
      {children}
    </div>
  );
}

function Val({ children }) {
  return <span style={{color:'#99ff99'}}>{children}</span>;
}

function Btn({ children, active, onClick, disabled, color, style={} }) {
  return (
    <button onClick={disabled?undefined:onClick} style={{
      flex:1, padding:'4px 6px', fontSize:8, fontWeight:'bold',
      cursor: disabled?'default':'pointer', borderRadius:3,
      border:`1px solid ${active?(color||'rgba(70,180,70,0.7)'):'rgba(40,70,40,0.4)'}`,
      background: active?'rgba(0,55,0,0.5)':'rgba(8,16,8,0.4)',
      color: active?(color||'#77ff77'):'#4a7a4a',
      opacity: disabled?0.4:1, transition:'all 0.12s',
      fontFamily:'monospace', letterSpacing:0.5,
      ...style,
    }}>
      {children}
    </button>
  );
}
