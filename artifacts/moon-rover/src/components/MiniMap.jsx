/**
 * MiniMap Component
 * Renders a 2D canvas top-down map showing rover position,
 * crater outlines, and the rover's tracked path.
 */

import { useRef, useEffect } from 'react';
import { worldToMapPixel } from '../three/mapSync';

const MAP_SIZE = 160;
const TERRAIN_SIZE = 200;

// Crater data mirrored from terrainGenerator for map display
const CRATERS = [
  { x: 20, z: -15, radius: 12 },
  { x: -40, z: 30, radius: 8 },
  { x: 60, z: 60, radius: 18 },
  { x: -70, z: -50, radius: 15 },
  { x: 10, z: 70, radius: 6 },
  { x: -20, z: -70, radius: 9 },
  { x: 80, z: -30, radius: 20 },
  { x: -80, z: 60, radius: 10 },
  { x: 35, z: -55, radius: 7 },
  { x: -55, z: 15, radius: 5 },
  { x: 0, z: 0, radius: 14 },
  { x: -30, z: 80, radius: 11 },
];

export default function MiniMap({ roverState, pathPoints }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = MAP_SIZE;
    const H = MAP_SIZE;

    // Background — dark moon surface
    ctx.fillStyle = '#1a1a20';
    ctx.fillRect(0, 0, W, H);

    // Draw subtle grid lines
    ctx.strokeStyle = 'rgba(100,120,100,0.12)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * W;
      const y = (i / 8) * H;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Draw crater circles
    ctx.strokeStyle = 'rgba(160,160,170,0.3)';
    ctx.lineWidth = 1;
    for (const c of CRATERS) {
      const { px, py } = worldToMapPixel(c.x, c.z, W, H);
      const r = (c.radius / TERRAIN_SIZE) * W;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw path
    if (pathPoints && pathPoints.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(80,200,180,0.6)';
      ctx.lineWidth = 1.5;
      const first = pathPoints[0];
      const { px: fpx, py: fpy } = worldToMapPixel(first[0], first[2], W, H);
      ctx.moveTo(fpx, fpy);
      for (let i = 1; i < pathPoints.length; i++) {
        const pt = pathPoints[i];
        const { px, py } = worldToMapPixel(pt[0], pt[2], W, H);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Draw rover dot
    if (roverState) {
      const { px, py } = worldToMapPixel(roverState.x, roverState.z, W, H);

      // Direction indicator
      const angle = (roverState.direction * Math.PI) / 180;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,220,80,0.9)';
      ctx.lineWidth = 1.5;
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.sin(angle) * 8, py + Math.cos(angle) * 8);
      ctx.stroke();

      // Rover dot
      ctx.beginPath();
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 6;
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Border
    ctx.strokeStyle = 'rgba(100,150,100,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, W, H);

  }, [roverState, pathPoints]);

  return (
    <div style={{
      position: 'relative',
      width: MAP_SIZE,
      height: MAP_SIZE,
      borderRadius: '4px',
      overflow: 'hidden',
      border: '1px solid rgba(100,180,100,0.4)',
      boxShadow: '0 0 12px rgba(0,0,0,0.8)',
    }}>
      <canvas ref={canvasRef} width={MAP_SIZE} height={MAP_SIZE} />
      <div style={{
        position: 'absolute',
        top: 4, left: 6,
        fontSize: 9,
        color: 'rgba(150,220,150,0.7)',
        fontFamily: 'monospace',
        letterSpacing: '0.05em',
        pointerEvents: 'none',
      }}>TOPOGRAPHIC</div>
    </div>
  );
}
