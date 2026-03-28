/**
 * RightPanel — Mission Control
 * • Multi-waypoint management
 * • Route analysis (Risk%, Cost, descriptions)
 * • Illumination-aware sun dial
 * • 2D mini-map with zoom/pan/waypoints
 * • Heatmap viewer, AI Learning, Telemetry
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { TERRAIN_SIZE, CRATERS } from '../three/terrainGenerator';
import { ROUTE_COLORS } from '../utils/constants';
import { getTerrainCanvas } from '../utils/terrainRenderer';
import { generateHeatmapCanvas } from '../utils/heatmaps';

const HALF = TERRAIN_SIZE / 2;
const PW   = 218;  // panel width
const MAP_S = 200; // mini-map px

const HEATMAP_OPTIONS = ['Slope','Slope Angle','Roughness','Slip Risk','Illumination','Hazard Score','Traversability'];
const HM_COLORS = {
  'Slope':'#aaddaa','Slope Angle':'#88ccff','Roughness':'#ffcc88',
  'Slip Risk':'#ff8844','Illumination':'#ffffaa','Hazard Score':'#ff6655','Traversability':'#44ffaa',
};
const WP_COLORS_2D = ['#22ff55','#ffcc22','#44ddff','#ff88ff','#ffaa33','#aaffaa'];

// ---- World ↔ Map coordinate helpers ----
function w2m(wx, wz, vx, vy, zoom) {
  return { x: ((wx+HALF)/TERRAIN_SIZE*MAP_S - vx)*zoom, y: ((wz+HALF)/TERRAIN_SIZE*MAP_S - vy)*zoom };
}
function m2w(mx, my, vx, vy, zoom) {
  const cx=mx/zoom+vx, cy=my/zoom+vy;
  return { wx:(cx/MAP_S)*TERRAIN_SIZE-HALF, wz:(cy/MAP_S)*TERRAIN_SIZE-HALF };
}
function clamp(vx,vy,zoom) {
  const span=MAP_S/zoom;
  return { vx:Math.max(0,Math.min(Math.max(0,MAP_S-span),vx)), vy:Math.max(0,Math.min(Math.max(0,MAP_S-span),vy)) };
}

// ---- Mini-map ----
function MiniMap({ waypoints, roverPos, routes, activeRoute, pickMode, onPick }) {
  const canvasRef   = useRef(null);
  const terrainRef  = useRef(null);
  const zoomRef     = useRef(1);
  const viewRef     = useRef({ x:0, y:0 });
  const dragRef     = useRef(null);

  useEffect(() => { terrainRef.current = getTerrainCanvas(MAP_S*2); }, []);

  const draw = useCallback(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    const W=cv.width, H=cv.height;
    const zoom=zoomRef.current, {x:vx,y:vy}=viewRef.current;

    ctx.clearRect(0,0,W,H);

    // Terrain base
    if (terrainRef.current) {
      const src=terrainRef.current, ss=src.width;
      const span=MAP_S/zoom;
      ctx.drawImage(src, vx/MAP_S*ss, vy/MAP_S*ss, span/MAP_S*ss, span/MAP_S*ss, 0,0,W,H);
    }

    // Craters
    for (const c of CRATERS) {
      const {x:cx,y:cy}=w2m(c.x,c.z,vx,vy,zoom);
      const r=(c.radius/TERRAIN_SIZE)*MAP_S*zoom;
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
      g.addColorStop(0,'rgba(90,10,0,0.32)'); g.addColorStop(0.7,'rgba(60,20,0,0.10)'); g.addColorStop(1,'transparent');
      ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
      ctx.beginPath();ctx.arc(cx,cy,r*1.05,0,Math.PI*2);ctx.strokeStyle='rgba(210,200,175,0.38)';ctx.lineWidth=0.8;ctx.stroke();
    }

    // Routes
    if (routes) {
      for (const [mode,pts] of Object.entries(routes)) {
        if (!pts||pts.length<2) continue;
        const active=mode===activeRoute;
        ctx.beginPath();
        for (let i=0;i<pts.length;i++) {
          const {x,y}=w2m(pts[i][0],pts[i][2],vx,vy,zoom);
          i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        }
        ctx.strokeStyle=ROUTE_COLORS[mode]; ctx.lineWidth=active?2.4:0.9;
        ctx.globalAlpha=active?1:0.35; ctx.stroke(); ctx.globalAlpha=1;
      }
    }

    // Waypoints
    if (waypoints) {
      const total=waypoints.length;
      waypoints.forEach((wp,i) => {
        const {x,y}=w2m(wp.x,wp.z,vx,vy,zoom);
        const isStart=i===0, isEnd=i===total-1;
        const color=isStart?'#22ff55':isEnd?'#ff4422':WP_COLORS_2D[i%WP_COLORS_2D.length];
        const g=ctx.createRadialGradient(x,y,0,x,y,10);
        g.addColorStop(0,color+'99'); g.addColorStop(1,color+'00');
        ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
        ctx.beginPath();ctx.arc(x,y,4.5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
        ctx.strokeStyle='#000';ctx.lineWidth=0.7;ctx.stroke();
        ctx.fillStyle='#fff';ctx.font='bold 6.5px monospace';
        const label=isStart?'S':isEnd?'E':`${i}`;
        ctx.fillText(label,x-(label.length>1?4:2.5),y+2.5);
      });
    }

    // Rover arrow
    if (roverPos) {
      const {x,y}=w2m(roverPos.x,roverPos.z,vx,vy,zoom);
      ctx.save(); ctx.translate(x,y); ctx.rotate(roverPos.heading||0);
      ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,5.5);ctx.lineTo(0,3.5);ctx.lineTo(-4,5.5);ctx.closePath();
      ctx.fillStyle='#FFD700';ctx.fill();ctx.strokeStyle='#806000';ctx.lineWidth=0.7;ctx.stroke();
      ctx.restore();
    }

    // Pick hint
    if (pickMode) {
      ctx.fillStyle='rgba(0,0,0,0.40)';ctx.fillRect(0,H-18,W,18);
      ctx.fillStyle='#88ffcc';ctx.font='7.5px monospace';
      ctx.fillText(` CLICK → ADD WAYPOINT ${waypoints?.length||0}+1`,4,H-6);
    }

    // Zoom badge
    ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(W-32,3,29,13);
    ctx.fillStyle='#88cc88';ctx.font='7px monospace';ctx.fillText(`${zoom.toFixed(1)}x`,W-28,12.5);
  }, [routes, activeRoute, waypoints, roverPos, pickMode]);

  useEffect(() => { draw(); }, [draw]);

  const onWheel = useCallback(e => {
    e.preventDefault();
    const dz=e.deltaY<0?0.4:-0.4;
    const nz=Math.max(1,Math.min(8,zoomRef.current+dz));
    const rect=canvasRef.current.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(MAP_S/rect.width);
    const my=(e.clientY-rect.top)*(MAP_S/rect.height);
    const wx0=mx/zoomRef.current+viewRef.current.x;
    const wy0=my/zoomRef.current+viewRef.current.y;
    zoomRef.current=nz;
    const {vx,vy}=clamp(wx0-mx/nz,wy0-my/nz,nz);
    viewRef.current={x:vx,y:vy}; draw();
  }, [draw]);

  useEffect(() => {
    const c=canvasRef.current; if(!c) return;
    c.addEventListener('wheel',onWheel,{passive:false});
    return () => c.removeEventListener('wheel',onWheel);
  }, [onWheel]);

  const onMouseDown = useCallback(e => {
    if (pickMode) return;
    dragRef.current={sx:e.clientX,sy:e.clientY,vx:viewRef.current.x,vy:viewRef.current.y};
  }, [pickMode]);

  const onMouseMove = useCallback(e => {
    if (!dragRef.current) return;
    const rect=canvasRef.current.getBoundingClientRect();
    const sx=MAP_S/rect.width, sy=MAP_S/rect.height;
    const dx=(e.clientX-dragRef.current.sx)*sx/zoomRef.current;
    const dy=(e.clientY-dragRef.current.sy)*sy/zoomRef.current;
    const {vx,vy}=clamp(dragRef.current.vx-dx,dragRef.current.vy-dy,zoomRef.current);
    viewRef.current={x:vx,y:vy}; draw();
  }, [draw]);

  const onMouseUp = useCallback(() => { dragRef.current=null; }, []);

  const onClick = useCallback(e => {
    if (!pickMode||dragRef.current) return;
    const rect=canvasRef.current.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(MAP_S/rect.width);
    const my=(e.clientY-rect.top)*(MAP_S/rect.height);
    const {wx,wz}=m2w(mx,my,viewRef.current.x,viewRef.current.y,zoomRef.current);
    onPick({ x:Math.max(-HALF+2,Math.min(HALF-2,wx)), z:Math.max(-HALF+2,Math.min(HALF-2,wz)) });
  }, [pickMode,onPick]);

  return (
    <canvas ref={canvasRef} width={MAP_S} height={MAP_S}
      style={{ width:MAP_S,height:MAP_S,display:'block',
        cursor:pickMode?'crosshair':'grab',
        border:'1px solid rgba(80,130,60,0.4)', borderRadius:3 }}
      onClick={onClick} onMouseDown={onMouseDown} onMouseMove={onMouseMove}
      onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
    />
  );
}

// ---- Sun Dial ----
function SunDial({ angle, onChange }) {
  const S=72,cx=36,cy=36,r=26;
  const rad=angle*Math.PI/180;
  const sx=cx+Math.sin(rad)*r, sy=cy-Math.cos(rad)*r;
  const dragging=useRef(false);
  const getA=(e,rect)=>(( Math.atan2(e.clientX-rect.left-cx,-(e.clientY-rect.top-cy))*180/Math.PI)+360)%360;
  return (
    <svg width={S} height={S} style={{cursor:'crosshair',flexShrink:0}}
      onMouseDown={e=>{dragging.current=true;onChange(Math.round(getA(e,e.currentTarget.getBoundingClientRect())))}}
      onMouseMove={e=>{if(!dragging.current)return;onChange(Math.round(getA(e,e.currentTarget.getBoundingClientRect())))}}
      onMouseUp={()=>{dragging.current=false}} onMouseLeave={()=>{dragging.current=false}}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(80,120,60,0.5)" strokeWidth={1.2}/>
      {[0,45,90,135,180,225,270,315].map(a=>{
        const ar=a*Math.PI/180;
        return <line key={a}
          x1={cx+Math.sin(ar)*(r-4)} y1={cy-Math.cos(ar)*(r-4)}
          x2={cx+Math.sin(ar)*(r+1)} y2={cy-Math.cos(ar)*(r+1)}
          stroke="rgba(100,160,80,0.5)" strokeWidth={a%90===0?1.4:0.6}/>;
      })}
      {['N','E','S','W'].map((l,i)=>{
        const ar=i*Math.PI/2;
        return <text key={l} x={cx+Math.sin(ar)*(r+7)} y={cy-Math.cos(ar)*(r+7)+2.5}
          textAnchor="middle" fontSize={6} fill="rgba(120,180,100,0.65)" fontFamily="monospace">{l}</text>;
      })}
      <line x1={cx} y1={cy} x2={sx} y2={sy} stroke="#FFD700" strokeWidth={1.5} opacity={0.9}/>
      <circle cx={sx} cy={sy} r={5.5} fill="#FFD700" opacity={0.95}/>
      <circle cx={sx} cy={sy} r={9} fill="none" stroke="#FFD700" strokeWidth={0.5} opacity={0.3}/>
      <circle cx={cx} cy={cy} r={2.5} fill="rgba(120,180,100,0.65)"/>
    </svg>
  );
}

// ---- Route Analysis ----
const ROUTE_DESC = {
  SAFE: s => `Low-risk path. Avoids craters + shadows. Avg hazard=${(s.avgHazard||0).toFixed(3)}, slip=${(s.avgSlip||0).toFixed(3)}, slope=${(s.avgSlopeAngle||0).toFixed(1)}°.`,
  ECO:  s => `Energy-efficient. Prefers sunlit + flat terrain. Illum=${(s.avgIllumination||0).toFixed(3)}, traversability=${(s.avgTraversability||0).toFixed(3)}.`,
  FAST: s => `Speed-optimized. Shortest distance=${(s.distance||0).toFixed(1)}m, total cost=${(s.totalCost||0).toFixed(1)}.`,
  AUTO: s => `Balanced route. Hazard=${(s.avgHazard||0).toFixed(3)}, illum=${(s.avgIllumination||0).toFixed(3)}, dist=${(s.distance||0).toFixed(1)}m.`,
};

function RouteAnalysis({ routes, activeRoute, onSelect }) {
  if (!routes) return (
    <div style={{fontSize:8,color:'#3a5a3a',textAlign:'center',padding:'8px 0'}}>
      Plan a path to see route analysis.
    </div>
  );
  return (
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      {Object.entries(ROUTE_COLORS).map(([mode,color]) => {
        const r=routes[mode];
        const s=r?.stats;
        const active=mode===activeRoute;
        return (
          <div key={mode} onClick={()=>onSelect(mode)} style={{
            border:`1px solid ${active?color:'rgba(40,70,40,0.35)'}`,
            borderRadius:4, padding:'5px 7px', cursor:'pointer',
            background:active?'rgba(0,0,0,0.5)':'rgba(5,12,5,0.4)',
            boxShadow:active?`0 0 8px ${color}33`:'none',
            transition:'all 0.12s',
          }}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
              <div style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:color,boxShadow:`0 0 4px ${color}`}}/>
                <span style={{color,fontSize:9,fontWeight:'bold',letterSpacing:0.5}}>{mode}</span>
              </div>
              {s && <span style={{color:'rgba(150,200,150,0.7)',fontSize:8}}>{s.distance.toFixed(1)}m</span>}
            </div>
            {s && (
              <>
                <div style={{color:'rgba(160,200,160,0.7)',fontSize:7.5,marginBottom:2}}>
                  Risk: <span style={{color:'#ffcc44'}}>{s.riskPercent.toFixed(1)}%</span>
                  {'  '}Cost: <span style={{color:'#88ccff'}}>{s.totalCost.toFixed(1)}</span>
                </div>
                <div style={{color:'rgba(100,150,100,0.75)',fontSize:7,lineHeight:1.5}}>
                  {ROUTE_DESC[mode]?.(s)}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Heatmap ----
function HeatmapViewer({ slopeMap, craterMask, hMap, sunAngle }) {
  const ref=useRef(null);
  const [sel,setSel]=useState('Hazard Score');
  const [open,setOpen]=useState(false);
  useEffect(()=>{ if(ref.current) generateHeatmapCanvas(ref.current,sel,slopeMap,craterMask,hMap,sunAngle); },
    [sel,slopeMap,craterMask,hMap,sunAngle]);
  return (
    <div>
      <Label>Parameter Heatmap</Label>
      <div style={{position:'relative',marginTop:4,marginBottom:5}}>
        <div onClick={()=>setOpen(o=>!o)} style={{
          background:'rgba(18,36,18,0.7)',border:'1px solid rgba(60,100,60,0.5)',
          borderRadius:3,padding:'3px 7px',cursor:'pointer',fontFamily:'monospace',
          display:'flex',justifyContent:'space-between',fontSize:9,color:HM_COLORS[sel]||'#aaa',
        }}>
          {sel}<span style={{color:'#558855'}}>▼</span>
        </div>
        {open&&(
          <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:200,
            background:'rgba(6,16,6,0.97)',border:'1px solid rgba(60,100,60,0.5)',borderRadius:3,overflow:'hidden'}}>
            {HEATMAP_OPTIONS.map(o=>(
              <div key={o} onClick={()=>{setSel(o);setOpen(false);}}
                style={{padding:'4px 7px',fontSize:9,cursor:'pointer',fontFamily:'monospace',
                  color:HM_COLORS[o]||'#aaa',background:o===sel?'rgba(40,80,40,0.5)':'transparent'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(30,60,30,0.6)'}
                onMouseLeave={e=>e.currentTarget.style.background=o===sel?'rgba(40,80,40,0.5)':'transparent'}
              >{o}</div>
            ))}
          </div>
        )}
      </div>
      <canvas ref={ref} width={MAP_S} height={MAP_S}
        style={{width:MAP_S,height:MAP_S,display:'block',borderRadius:3,border:'1px solid rgba(80,120,60,0.3)'}}/>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:7,color:'#558855',marginTop:2}}>
        <span>LOW</span><span style={{color:HM_COLORS[sel]}}>{sel.toUpperCase()}</span><span>HIGH</span>
      </div>
    </div>
  );
}

// ---- Main Export ----
export default function RightPanel({
  roverState, pathRef,
  routes, activeRoute, setActiveRoute,
  waypoints, onAddWaypoint, onSetStartWaypoint, onRemoveLastWaypoint, onClearWaypoints,
  onPlanPath,
  sunAngleDeg, setSunAngleDeg,
  cameraMode, setCameraMode,
  wireframe, setWireframe,
  onStartRover, onStopRover, isRoving,
  slopeMap, craterMask, hMap,
  learningModel, routeLog,
}) {
  const [pickMode, setPickMode] = useState(false);

  const handlePick = useCallback(pos => {
    if (waypoints.length === 0) {
      onSetStartWaypoint(pos);
    } else {
      onAddWaypoint(pos);
    }
    setPickMode(false);
  }, [waypoints.length, onSetStartWaypoint, onAddWaypoint]);

  const { x=0, z=0, speed=0, heading=0 } = roverState || {};
  const trail = pathRef?.current?._roverTrail?.length || 0;
  const lm = learningModel?.getStats?.() || { traversals:0, cellsKnown:0, maxHazard:0 };

  // Extract just paths for the mini-map
  const routePaths = routes
    ? Object.fromEntries(Object.entries(routes).map(([m,r])=>[m, r?.path || r]))
    : null;

  const startPos = waypoints[0] || null;
  const endPos   = waypoints[waypoints.length-1] || null;

  return (
    <div style={{
      position:'fixed',right:0,top:0,bottom:0,width:PW,
      background:'rgba(4,10,4,0.96)',
      borderLeft:'1px solid rgba(35,70,35,0.5)',
      display:'flex',flexDirection:'column',overflowY:'auto',
      zIndex:10,backdropFilter:'blur(5px)',
    }}>
      {/* Header */}
      <div style={{padding:'7px 10px 5px',borderBottom:'1px solid rgba(35,70,35,0.4)',
        background:'rgba(0,14,0,0.7)',flexShrink:0}}>
        <div style={{color:'#3dff55',fontSize:10,fontWeight:'bold',letterSpacing:2}}>MOON ROVER SIM</div>
        <div style={{color:'#245524',fontSize:7,letterSpacing:1}}>MISSION CONTROL TERMINAL</div>
      </div>

      <div style={{flex:1,padding:'6px 8px',display:'flex',flexDirection:'column',gap:8,overflowY:'auto'}}>

        {/* Terrain */}
        <Sect label="Terrain Mode">
          <Row>
            <Btn active={!wireframe} onClick={()=>setWireframe(false)}>PROCEDURAL</Btn>
            <Btn active={wireframe}  onClick={()=>setWireframe(true)}>WIRE</Btn>
          </Row>
        </Sect>

        {/* Mini-map */}
        <Sect label="Topographic Map">
          <div style={{fontSize:7,color:'#3a663a',marginBottom:4}}>
            Scroll=zoom · Drag=pan · Pick mode=click map
          </div>
          <MiniMap
            waypoints={waypoints}
            roverPos={{x,z,heading}}
            routes={routePaths}
            activeRoute={activeRoute}
            pickMode={pickMode}
            onPick={handlePick}
          />
          <div style={{fontSize:7,color:'#3a5a3a',marginTop:3,display:'flex',gap:4,justifyContent:'space-between'}}>
            <span style={{color:startPos?'#22ff66':'#2a4a2a'}}>
              S: {startPos?`${startPos.x.toFixed(0)},${startPos.z.toFixed(0)}`:'--'}
            </span>
            <span style={{color:endPos&&waypoints.length>1?'#ff4422':'#4a2a2a'}}>
              E: {endPos&&waypoints.length>1?`${endPos.x.toFixed(0)},${endPos.z.toFixed(0)}`:'--'}
            </span>
          </div>
        </Sect>

        {/* Waypoints */}
        <Sect label={`Waypoints (${waypoints.length})`}>
          {/* Waypoint list */}
          {waypoints.length > 0 && (
            <div style={{marginBottom:5,maxHeight:58,overflowY:'auto',fontSize:8,fontFamily:'monospace',
              background:'rgba(0,12,0,0.4)',borderRadius:3,padding:'3px 5px'}}>
              {waypoints.map((wp,i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:4,marginBottom:1}}>
                  <div style={{width:5,height:5,borderRadius:'50%',flexShrink:0,
                    background:i===0?'#22ff55':i===waypoints.length-1?'#ff4422':WP_COLORS_2D[i%WP_COLORS_2D.length]}}/>
                  <span style={{color:'#779977'}}>{i===0?'S':i===waypoints.length-1?'E':i}:</span>
                  <span style={{color:'#aaffaa'}}>{wp.x.toFixed(0)},{wp.z.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
          <Row style={{marginBottom:4}}>
            <Btn active={pickMode} color="#44ffaa"
              onClick={()=>setPickMode(m=>!m)}>
              {pickMode?'● ADDING…':'+ ADD WP'}
            </Btn>
            <Btn onClick={onRemoveLastWaypoint} disabled={waypoints.length===0}>
              ← REMOVE
            </Btn>
          </Row>
          <Row>
            <Btn onClick={onClearWaypoints} disabled={waypoints.length===0}>CLEAR ALL</Btn>
            <Btn disabled={waypoints.length<2} onClick={onPlanPath}
              style={{flex:1.5,background:'rgba(0,65,0,0.55)',borderColor:'rgba(0,180,0,0.5)',
                color:'#44ff88',fontWeight:'bold'}}>
              PLAN PATH
            </Btn>
          </Row>
        </Sect>

        {/* Sun */}
        <Sect label="Sun Direction">
          <div style={{display:'flex',gap:7,alignItems:'center'}}>
            <SunDial angle={sunAngleDeg} onChange={setSunAngleDeg}/>
            <div style={{flex:1}}>
              <div style={{color:'#FFD700',fontSize:14,fontWeight:'bold',marginBottom:3}}>{sunAngleDeg}°</div>
              <input type="range" min={0} max={359} value={sunAngleDeg}
                onChange={e=>setSunAngleDeg(Number(e.target.value))} style={{width:'100%'}}/>
              <div style={{color:'#554433',fontSize:7,marginTop:2}}>
                {['N','NE','E','SE','S','SW','W','NW','N'][Math.round(sunAngleDeg/45)%8]} — PATH FAVORS LIT ZONES
              </div>
            </div>
          </div>
        </Sect>

        {/* Route selector + start */}
        <Sect label="Select Route">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:3,marginBottom:5}}>
            {Object.entries(ROUTE_COLORS).map(([mode,color])=>(
              <div key={mode} onClick={()=>setActiveRoute(mode)} style={{
                padding:'5px 3px',textAlign:'center',cursor:'pointer',borderRadius:3,
                fontSize:9,fontWeight:'bold',
                border:`1px solid ${activeRoute===mode?color:'rgba(40,70,40,0.35)'}`,
                color:activeRoute===mode?color:'#446644',
                background:activeRoute===mode?'rgba(0,0,0,0.5)':'rgba(6,12,6,0.35)',
                boxShadow:activeRoute===mode?`0 0 7px ${color}44`:'none',
                transition:'all 0.12s',
              }}>
                <span style={{display:'inline-block',width:5,height:5,borderRadius:'50%',background:color,
                  marginRight:3,verticalAlign:'middle'}}/>
                {mode}
              </div>
            ))}
          </div>
          <Btn onClick={isRoving?onStopRover:onStartRover}
            disabled={!routes||!routes[activeRoute]}
            style={{width:'100%',padding:'7px 0',
              background:isRoving?'rgba(65,0,0,0.6)':'rgba(0,65,0,0.6)',
              border:`1px solid ${isRoving?'rgba(180,40,40,0.6)':'rgba(40,180,40,0.6)'}`,
              color:isRoving?'#ff5533':'#44ff88',fontSize:10,fontWeight:'bold',letterSpacing:1}}>
            {isRoving?'■  STOP ROVER':'▶  START ROVER'}
          </Btn>
        </Sect>

        {/* Route Analysis */}
        <Sect label="Route Analysis">
          <RouteAnalysis routes={routes} activeRoute={activeRoute} onSelect={setActiveRoute}/>
        </Sect>

        {/* Camera */}
        <Sect label="Camera">
          <Row>
            <Btn active={cameraMode==='free'}   onClick={()=>setCameraMode('free')}>FREE</Btn>
            <Btn active={cameraMode==='follow'} onClick={()=>setCameraMode('follow')}>FOLLOW</Btn>
          </Row>
        </Sect>

        {/* Heatmap */}
        <HeatmapViewer slopeMap={slopeMap} craterMask={craterMask} hMap={hMap} sunAngle={sunAngleDeg}/>

        {/* AI */}
        <Sect label="AI Learning">
          <div style={{fontSize:8,color:'#557755',lineHeight:1.9,fontFamily:'monospace'}}>
            <div>Traversals:  <V>{lm.traversals}</V></div>
            <div>Cells known: <V>{lm.cellsKnown}</V></div>
            <div>Max hazard:  <V c={lm.maxHazard>0.7?'#ff6644':'#99ff99'}>{(lm.maxHazard||0).toFixed(3)}</V></div>
          </div>
        </Sect>

        {/* Telemetry */}
        <Sect label="Telemetry">
          <div style={{fontFamily:'monospace',fontSize:8,color:'#557755',lineHeight:1.9}}>
            <div>X: <V>{x.toFixed(1)}</V>  Z: <V>{z.toFixed(1)}</V></div>
            <div>Speed: <V>{(speed*3.6).toFixed(1)}</V> km/h</div>
            <div>Heading: <V>{((heading*180/Math.PI+360)%360).toFixed(0)}°</V></div>
            <div>Trail pts: <V>{trail}</V></div>
          </div>
        </Sect>

        {/* Log */}
        <Sect label="Route Log">
          <div style={{fontSize:7,color:'#3a5a3a',maxHeight:68,overflowY:'auto',fontFamily:'monospace'}}>
            {routeLog?.length
              ?routeLog.slice(-14).map((l,i)=>(
                <div key={i} style={{color:l.includes('[ERR]')?'#ff6644':'#557755',marginBottom:1}}>{l}</div>
              ))
              :<div style={{color:'#253a25'}}>▶ Add waypoints and press PLAN PATH.</div>
            }
          </div>
        </Sect>

      </div>
    </div>
  );
}

// ---- Micro components ----
function Sect({ label, children }) {
  return (
    <div>
      <Label>{label}</Label>
      <div style={{marginTop:4}}>{children}</div>
      <div style={{height:1,background:'rgba(30,70,30,0.2)',marginTop:8}}/>
    </div>
  );
}
function Label({ children }) {
  return <div style={{color:'#3a663a',fontSize:7,textTransform:'uppercase',letterSpacing:1.2}}>{children}</div>;
}
function Row({ children, style={} }) {
  return <div style={{display:'flex',gap:3,...style}}>{children}</div>;
}
function V({ children, c }) {
  return <span style={{color:c||'#99ff99'}}>{children}</span>;
}
function Btn({ children, active, onClick, disabled, color, style={} }) {
  return (
    <button onClick={disabled?undefined:onClick} style={{
      flex:1,padding:'4px 4px',fontSize:8,fontWeight:'bold',
      cursor:disabled?'default':'pointer',borderRadius:3,
      border:`1px solid ${active?(color||'rgba(60,180,60,0.7)'):'rgba(35,70,35,0.4)'}`,
      background:active?'rgba(0,50,0,0.5)':'rgba(6,14,6,0.4)',
      color:active?(color||'#77ff77'):'#447744',
      opacity:disabled?0.4:1,transition:'all 0.12s',
      fontFamily:'monospace',letterSpacing:0.4,
      ...style,
    }}>
      {children}
    </button>
  );
}
