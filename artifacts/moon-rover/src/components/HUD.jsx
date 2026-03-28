/**
 * HUD (Heads-Up Display) Panel
 * Shows rover telemetry: coordinates, speed, direction,
 * and control buttons for reset, camera toggle, and wireframe.
 */

import MiniMap from './MiniMap';

function formatNum(n) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function cardinalDir(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function TelemetryRow({ label, value, unit }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
      <span style={{ color: 'rgba(140,200,140,0.8)', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
        {label}
      </span>
      <span style={{ color: '#d4e8d4', fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' }}>
        {value}
        {unit && <span style={{ color: 'rgba(140,200,140,0.6)', fontSize: 9, marginLeft: 2 }}>{unit}</span>}
      </span>
    </div>
  );
}

function HUDButton({ onClick, children, variant = 'default' }) {
  const bg = variant === 'danger' ? 'rgba(180,60,60,0.3)' : 'rgba(40,80,40,0.5)';
  const border = variant === 'danger' ? 'rgba(200,80,80,0.5)' : 'rgba(80,160,80,0.4)';
  const hover = variant === 'danger' ? 'rgba(180,60,60,0.5)' : 'rgba(60,120,60,0.7)';
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '5px 0',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 3,
        color: '#c8e8c8',
        fontSize: 10,
        fontFamily: 'monospace',
        letterSpacing: '0.05em',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.target.style.background = hover}
      onMouseLeave={e => e.target.style.background = bg}
    >
      {children}
    </button>
  );
}

export default function HUD({ roverState, pathPoints, cameraMode, wireframe, onReset, onToggleCamera, onToggleWireframe }) {
  const speedKmh = roverState ? (roverState.speed * 3.6).toFixed(1) : '0.0';
  const dir = roverState ? cardinalDir(roverState.direction) : 'N';

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      width: 200,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'auto',
      userSelect: 'none',
    }}>
      {/* Mini Map */}
      <MiniMap roverState={roverState} pathPoints={pathPoints} />

      {/* Telemetry panel */}
      <div style={{
        background: 'rgba(8,18,8,0.88)',
        border: '1px solid rgba(60,120,60,0.5)',
        borderRadius: 4,
        padding: '8px 10px',
        boxShadow: '0 0 12px rgba(0,0,0,0.8)',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          fontSize: 10,
          color: 'rgba(100,200,100,0.8)',
          fontFamily: 'monospace',
          letterSpacing: '0.15em',
          marginBottom: 6,
          borderBottom: '1px solid rgba(60,120,60,0.3)',
          paddingBottom: 4,
        }}>
          ROVER TELEMETRY
        </div>

        <TelemetryRow label="X" value={roverState ? formatNum(roverState.x) : '0.0'} unit="m" />
        <TelemetryRow label="Y" value={roverState ? formatNum(roverState.y) : '0.0'} unit="m" />
        <TelemetryRow label="Z" value={roverState ? formatNum(roverState.z) : '0.0'} unit="m" />
        <div style={{ borderTop: '1px solid rgba(60,120,60,0.2)', margin: '4px 0' }} />
        <TelemetryRow label="SPEED" value={speedKmh} unit="km/h" />
        <TelemetryRow label="HDG" value={`${roverState ? Math.round(roverState.direction) : 0}°`} unit={dir} />
        <TelemetryRow label="PATH" value={pathPoints ? pathPoints.length : 0} unit="pts" />
      </div>

      {/* Control buttons */}
      <div style={{
        background: 'rgba(8,18,8,0.88)',
        border: '1px solid rgba(60,120,60,0.5)',
        borderRadius: 4,
        padding: '8px 10px',
        boxShadow: '0 0 12px rgba(0,0,0,0.8)',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          fontSize: 10,
          color: 'rgba(100,200,100,0.8)',
          fontFamily: 'monospace',
          letterSpacing: '0.15em',
          marginBottom: 6,
          borderBottom: '1px solid rgba(60,120,60,0.3)',
          paddingBottom: 4,
        }}>
          CONTROLS
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          <HUDButton onClick={onReset} variant="danger">RESET</HUDButton>
          <HUDButton onClick={onToggleCamera}>
            CAM: {cameraMode === 'follow' ? 'FOLLOW' : 'FREE'}
          </HUDButton>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <HUDButton onClick={onToggleWireframe}>
            {wireframe ? 'WIRE: ON' : 'WIRE: OFF'}
          </HUDButton>
        </div>
      </div>

      {/* Key hint */}
      <div style={{
        background: 'rgba(8,18,8,0.75)',
        border: '1px solid rgba(60,120,60,0.3)',
        borderRadius: 4,
        padding: '6px 10px',
        fontSize: 9,
        color: 'rgba(100,180,100,0.6)',
        fontFamily: 'monospace',
        letterSpacing: '0.05em',
        lineHeight: 1.6,
      }}>
        W/↑ forward · S/↓ back<br />
        A/← turn left · D/→ right
      </div>
    </div>
  );
}
