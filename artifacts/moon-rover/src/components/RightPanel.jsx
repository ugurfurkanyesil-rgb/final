/**
 * RightPanel - Mission control panel
 * Matches the reference image with: terrain controls, path planning,
 * sun direction, route selection, heatmaps, route log.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { drawHeatmap } from '../utils/heatmaps';
import { routeStats } from '../utils/pathfinder';
import { ROUTE_COLORS } from './MoonScene';
import { TERRAIN_SIZE } from '../three/terrainGenerator';

// Mini-map with path overlay
function MiniMap({ startPos, endPos, routes, activeRoute, onPickStart, onPickEnd, pickMode }) {
  const canvasRef = useRef();
  const half = TERRAIN_SIZE / 2;

  function worldToMapPx(wx, wz, W, H) {
    return {
      px: ((wx + half) / TERRAIN_SIZE) * W,
      py: ((wz + half) / TERRAIN_SIZE) * H,
    };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#111820';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(80,100,80,0.2)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      ctx.beginPath(); ctx.moveTo((i/10)*W, 0); ctx.lineTo((i/10)*W, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i/10)*H); ctx.lineTo(W, (i/10)*H); ctx.stroke();
    }

    // Draw routes
    if (routes) {
      const modes = ['FAST', 'ECO', 'AUTO', 'SAFE'];
      for (const mode of modes) {
        const pts = routes[mode];
        if (!pts || pts.length < 2) continue;
        const isActive = mode === activeRoute;
        ctx.beginPath();
        ctx.strokeStyle = ROUTE_COLORS[mode];
        ctx.globalAlpha = isActive ? 1.0 : 0.45;
        ctx.lineWidth = isActive ? 2.5 : 1.2;
        const { px: fx, py: fy } = worldToMapPx(pts[0][0], pts[0][2], W, H);
        ctx.moveTo(fx, fy);
        for (let i = 1; i < pts.length; i++) {
          const { px, py } = worldToMapPx(pts[i][0], pts[i][2], W, H);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Start marker
    if (startPos) {
      const { px, py } = worldToMapPx(startPos.x, startPos.z, W, H);
      ctx.beginPath();
      ctx.fillStyle = '#22ff66';
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(34,255,102,0.3)';
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // End marker
    if (endPos) {
      const { px, py } = worldToMapPx(endPos.x, endPos.z, W, H);
      ctx.beginPath();
      ctx.fillStyle = '#ff4422';
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Picker crosshair
    if (pickMode) {
      ctx.strokeStyle = pickMode === 'start' ? '#22ff66' : '#ff4422';
      ctx.lineWidth = 1;
      ctx.setLineDash([3,3]);
      ctx.strokeRect(1, 1, W-2, H-2);
      ctx.setLineDash([]);
    }

    // Border
    ctx.strokeStyle = 'rgba(80,140,80,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, W, H);
  }, [startPos, endPos, routes, activeRoute, pickMode]);

  const handleClick = useCallback((e) => {
    if (!pickMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const wx = (px / rect.width) * TERRAIN_SIZE - half;
    const wz = (py / rect.height) * TERRAIN_SIZE - half;
    // Clamp within bounds
    const cx = Math.max(-half + 2, Math.min(half - 2, wx));
    const cz = Math.max(-half + 2, Math.min(half - 2, wz));
    if (pickMode === 'start') onPickStart({ x: cx, z: cz });
    else onPickEnd({ x: cx, z: cz });
  }, [pickMode, onPickStart, onPickEnd]);

  return (
    <canvas
      ref={canvasRef}
      width={130}
      height={130}
      onClick={handleClick}
      style={{
        cursor: pickMode ? 'crosshair' : 'default',
        display: 'block',
        borderRadius: 2,
      }}
    />
  );
}

// Heatmap canvas widget
function HeatmapCanvas({ type, experienceMap }) {
  const canvasRef = useRef();
  useEffect(() => {
    if (canvasRef.current) drawHeatmap(canvasRef.current, type, experienceMap);
  }, [type, experienceMap]);
  return <canvas ref={canvasRef} width={130} height={80} style={{ display: 'block', borderRadius: 2 }} />;
}

// Sun direction dial
function SunDial({ angleDeg, onChange }) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const cx = 30, cy = 30, r = 22;
  const nx = cx + Math.cos(rad) * r;
  const ny = cy + Math.sin(rad) * r;

  const handleDrag = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - rect.left) - cx;
    const dy = (e.clientY - rect.top) - cy;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    onChange(((angle % 360) + 360) % 360);
  }, [onChange]);

  return (
    <svg width={60} height={60} style={{ cursor: 'crosshair' }}
      onMouseMove={(e) => { if (e.buttons === 1) handleDrag(e); }}
      onClick={handleDrag}>
      {/* Background */}
      <circle cx={cx} cy={cy} r={r} fill="rgba(20,30,20,0.8)" stroke="rgba(80,140,80,0.5)" strokeWidth={1} />
      {/* Compass ticks */}
      {[0,45,90,135,180,225,270,315].map(a => {
        const ar = ((a - 90) * Math.PI) / 180;
        const x1 = cx + Math.cos(ar) * (r - 5);
        const y1 = cy + Math.sin(ar) * (r - 5);
        const x2 = cx + Math.cos(ar) * r;
        const y2 = cy + Math.sin(ar) * r;
        return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(100,160,100,0.5)" strokeWidth={1} />;
      })}
      {/* N label */}
      <text x={cx} y={cy - r + 10} textAnchor="middle" fill="rgba(120,180,120,0.7)" fontSize={7} fontFamily="monospace">N</text>
      {/* Sun ray line */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#FFD700" strokeWidth={2} />
      {/* Sun dot */}
      <circle cx={nx} cy={ny} r={4} fill="#FFD700" />
      <circle cx={cx} cy={cy} r={2} fill="rgba(255,215,0,0.5)" />
    </svg>
  );
}

const HEATMAP_OPTIONS = ['Slope', 'Slope Angle', 'Roughness', 'Slip Risk', 'Illumination', 'Hazard Score', 'Traversability'];

const SEP = () => (
  <div style={{ borderTop: '1px solid rgba(60,100,60,0.35)', margin: '6px 0' }} />
);

const Label = ({ children }) => (
  <div style={{ fontSize: 9, color: 'rgba(100,180,100,0.75)', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 3 }}>
    {children}
  </div>
);

const BTN_BASE = {
  border: '1px solid rgba(80,130,80,0.5)',
  borderRadius: 3,
  fontSize: 10,
  fontFamily: 'monospace',
  letterSpacing: '0.06em',
  cursor: 'pointer',
  padding: '4px 0',
  transition: 'all 0.12s',
};

function Btn({ onClick, children, color = 'default', active = false, style = {} }) {
  const bg = active ? (color === 'green' ? '#22aa44' : color === 'blue' ? '#2255cc' : color === 'cyan' ? '#118888' : '#997700')
    : 'rgba(20,40,20,0.7)';
  const border = active ? (color === 'green' ? '#44dd66' : color === 'blue' ? '#4488ff' : color === 'cyan' ? '#22dddd' : '#ddaa00')
    : 'rgba(80,130,80,0.5)';
  return (
    <button onClick={onClick} style={{ ...BTN_BASE, background: bg, borderColor: border, color: '#d8ecd8', ...style }}>
      {children}
    </button>
  );
}

export default function RightPanel({
  roverState, routes, activeRoute, onSelectRoute,
  startPos, endPos, onPickStart, onPickEnd,
  onPlanPath, onStartRover, onClear, onSwapPoints,
  pickMode, setPickMode,
  sunAngleDeg, onSunAngleChange,
  heatmapType, onHeatmapChange,
  learningModel, wireframe, onToggleWireframe,
  routeLog,
}) {
  const [sunEnabled, setSunEnabled] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  const expMap = learningModel?.getExperienceMap();
  const stats = learningModel?.getStats();

  const formatPos = (pos) => pos ? `${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}` : '—';

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: 170,
      height: '100%',
      background: 'rgba(6,14,6,0.94)',
      borderLeft: '1px solid rgba(50,100,50,0.5)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'monospace',
      zIndex: 20,
      boxShadow: '-4px 0 16px rgba(0,0,0,0.7)',
    }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', scrollbarWidth: 'thin' }}>

        {/* Header */}
        <div style={{ fontSize: 9, color: 'rgba(100,200,100,0.8)', letterSpacing: '0.15em', marginBottom: 6, borderBottom: '1px solid rgba(60,120,60,0.4)', paddingBottom: 4 }}>
          MOON ROVER SIM
        </div>

        {/* Terrain type */}
        <Label>TERRAIN MODE</Label>
        <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
          <div style={{ flex: 1, background: 'rgba(20,50,20,0.8)', border: '1px solid rgba(60,120,60,0.5)', borderRadius: 3, padding: '3px 6px', fontSize: 9, color: '#a8d8a8', textAlign: 'center' }}>
            PROCEDURAL
          </div>
          <Btn onClick={onToggleWireframe} style={{ width: 36, fontSize: 8 }}>
            {wireframe ? 'WIRE' : 'SURF'}
          </Btn>
        </div>

        <SEP />

        {/* Map thumbnail */}
        <Label>TOPOGRAPHIC MAP</Label>
        <div style={{ marginBottom: 6 }}>
          <MiniMap
            startPos={startPos}
            endPos={endPos}
            routes={routes}
            activeRoute={activeRoute}
            onPickStart={(p) => { onPickStart(p); setPickMode(null); }}
            onPickEnd={(p) => { onPickEnd(p); setPickMode(null); }}
            pickMode={pickMode}
          />
        </div>

        {/* Coordinates */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(140,200,140,0.8)', marginBottom: 4 }}>
          <span>S: {formatPos(startPos)}</span>
          <span>E: {formatPos(endPos)}</span>
        </div>

        {/* Pick buttons */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
          <Btn
            onClick={() => setPickMode(pickMode === 'start' ? null : 'start')}
            active={pickMode === 'start'}
            color="green"
            style={{ flex: 1, fontSize: 9 }}
          >
            PICK START
          </Btn>
          <Btn
            onClick={() => setPickMode(pickMode === 'end' ? null : 'end')}
            active={pickMode === 'end'}
            color="green"
            style={{ flex: 1, fontSize: 9 }}
          >
            PICK END
          </Btn>
        </div>

        {/* Clear / Swap / Plan */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
          <Btn onClick={onClear} style={{ flex: 1, fontSize: 9 }}>CLEAR</Btn>
          <Btn onClick={onSwapPoints} style={{ flex: 1, fontSize: 9 }}>SWAP</Btn>
          <Btn onClick={onPlanPath} active={!!routes} color="green" style={{ flex: 1, fontSize: 9 }}>
            PLAN
          </Btn>
        </div>

        <SEP />

        {/* Sun direction */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Label>SUN DIR</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 8, color: 'rgba(100,180,100,0.7)' }}>
              {Math.round(sunAngleDeg)}°
            </span>
            <button onClick={() => setSunEnabled(s => !s)} style={{
              fontSize: 8, fontFamily: 'monospace',
              background: sunEnabled ? 'rgba(34,120,34,0.5)' : 'rgba(40,40,40,0.5)',
              border: `1px solid ${sunEnabled ? '#44aa44' : '#555'}`,
              borderRadius: 2, color: '#a0c0a0', padding: '1px 4px', cursor: 'pointer',
            }}>
              {sunEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <SunDial angleDeg={sunAngleDeg} onChange={onSunAngleChange} />
          <input
            type="range" min={0} max={359} step={1}
            value={Math.round(sunAngleDeg)}
            onChange={e => onSunAngleChange(Number(e.target.value))}
            style={{ flex: 1, height: 2, cursor: 'pointer', accentColor: '#FFD700' }}
          />
        </div>

        <SEP />

        {/* Route selection */}
        <Label>SELECT ROUTE</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 3 }}>
          {[['SAFE','green'],['ECO','cyan'],['FAST','blue'],['AUTO','yellow']].map(([mode, col]) => (
            <Btn
              key={mode}
              onClick={() => routes?.[mode] && onSelectRoute(mode)}
              active={activeRoute === mode}
              color={col === 'yellow' ? 'auto' : col}
              style={{ fontSize: 10, border: `1px solid ${activeRoute === mode ? ROUTE_COLORS[mode] : 'rgba(80,130,80,0.4)'}` }}
            >
              {mode}
            </Btn>
          ))}
        </div>

        {/* Route stats */}
        {activeRoute && routes?.[activeRoute] && (() => {
          const s = routeStats(routes[activeRoute]);
          return (
            <div style={{ fontSize: 8, color: 'rgba(120,180,120,0.8)', marginBottom: 4, display: 'flex', gap: 8 }}>
              <span>DIST: {s.distance}m</span>
              <span>+{s.elevGain}m</span>
            </div>
          );
        })()}

        {/* Start rover button */}
        <button
          onClick={onStartRover}
          disabled={!activeRoute || !routes}
          style={{
            width: '100%',
            padding: '6px 0',
            background: activeRoute ? 'rgba(20,140,60,0.8)' : 'rgba(30,30,30,0.5)',
            border: `1px solid ${activeRoute ? '#22dd66' : 'rgba(80,80,80,0.4)'}`,
            borderRadius: 3,
            color: activeRoute ? '#aaffcc' : '#666',
            fontSize: 11,
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            cursor: activeRoute ? 'pointer' : 'not-allowed',
            marginBottom: 6,
            fontWeight: 'bold',
          }}
        >
          ▶ START ROVER
        </button>

        <SEP />

        {/* Heatmap */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Label>PARAMETER HEATMAP</Label>
        </div>
        <div style={{ position: 'relative', marginBottom: 4 }}>
          <button
            onClick={() => setShowDropdown(d => !d)}
            style={{
              width: '100%', padding: '3px 6px',
              background: 'rgba(10,25,10,0.9)',
              border: '1px solid rgba(60,120,60,0.5)',
              borderRadius: 3, color: '#a8d8a8', fontSize: 9,
              fontFamily: 'monospace', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span>{heatmapType}</span>
            <span>▼</span>
          </button>
          {showDropdown && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
              background: 'rgba(8,18,8,0.98)',
              border: '1px solid rgba(60,120,60,0.5)',
              borderRadius: 3,
            }}>
              {HEATMAP_OPTIONS.map(opt => (
                <div
                  key={opt}
                  onClick={() => { onHeatmapChange(opt); setShowDropdown(false); }}
                  style={{
                    padding: '4px 8px', fontSize: 9, color: opt === heatmapType ? '#22ff66' : '#a0d0a0',
                    background: opt === heatmapType ? 'rgba(20,60,20,0.8)' : 'transparent',
                    cursor: 'pointer', fontFamily: 'monospace',
                  }}
                >
                  {opt}
                </div>
              ))}
            </div>
          )}
        </div>
        <HeatmapCanvas type={heatmapType} experienceMap={expMap} />

        <SEP />

        {/* Learning model stats */}
        <Label>AI LEARNING</Label>
        {stats && (
          <div style={{ fontSize: 8, color: 'rgba(120,180,120,0.7)', lineHeight: 1.7 }}>
            <div>Traversals: {stats.totalTraversals}</div>
            <div>Cells known: {stats.cellsExplored}</div>
            <div>Max hazard: {stats.maxDifficulty}</div>
          </div>
        )}

        <SEP />

        {/* Rover telemetry */}
        <Label>TELEMETRY</Label>
        <div style={{ fontSize: 8, color: 'rgba(120,180,120,0.8)', lineHeight: 1.8 }}>
          {roverState && (
            <>
              <div>X: {roverState.x?.toFixed(1)}  Z: {roverState.z?.toFixed(1)}</div>
              <div>SPD: {(roverState.speed * 3.6).toFixed(1)} km/h</div>
              <div>HDG: {Math.round(roverState.direction)}°</div>
              <div>MODE: {roverState.autoMode ? 'AUTO' : 'MANUAL'}</div>
            </>
          )}
        </div>

        <SEP />

        {/* Route log */}
        <Label>ROUTE LOG</Label>
        <div style={{ fontSize: 8, color: 'rgba(100,160,100,0.7)', lineHeight: 1.6, minHeight: 40 }}>
          {routeLog.length === 0
            ? <span style={{ color: 'rgba(80,120,80,0.5)' }}>Press PLAN PATH to begin</span>
            : routeLog.slice(0, 8).map((entry, i) => (
              <div key={i}>{entry}</div>
            ))
          }
        </div>

        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
