/**
 * Self-Learning Cost Model
 * Maintains a traversal experience map that the rover updates as it drives.
 * High-cost areas (craters, steep slopes) are reinforced over time.
 * The model improves future path planning by feeding back into cost maps.
 */

import { GRID_RES, TERRAIN_SIZE } from '../three/terrainGenerator.js';
import { worldToGrid } from './pathfinder.js';
import { clearPathCache } from './pathfinder.js';

const ALPHA = 0.12;      // Learning rate
const DECAY = 0.0002;    // Slow decay of learned costs
const MAX_MEMORY = 4000; // Max traversal records

export class LearningModel {
  constructor() {
    // Experience map: 0 = unknown, positive = learned cost
    this.experienceMap = new Float32Array(GRID_RES * GRID_RES);
    this.traversalCount = 0;
    this.history = []; // Recent traversal difficulty log
  }

  /**
   * Record the rover traversing a cell.
   * @param {number} wx - World X
   * @param {number} wz - World Z
   * @param {number} difficulty - 0 (easy) to 1 (hard)
   */
  recordTraversal(wx, wz, difficulty) {
    const { col, row } = worldToGrid(wx, wz);
    const idx = row * GRID_RES + col;
    // Incremental update: blend in new observation
    this.experienceMap[idx] = (1 - ALPHA) * this.experienceMap[idx] + ALPHA * difficulty;
    this.traversalCount++;

    // Decay nearby cells slightly
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const ni = (row + dr) * GRID_RES + (col + dc);
        if (ni >= 0 && ni < GRID_RES * GRID_RES) {
          this.experienceMap[ni] *= (1 - DECAY);
        }
      }
    }

    // Log difficulty events
    if (difficulty > 0.5) {
      this.history.unshift({ wx: wx.toFixed(1), wz: wz.toFixed(1), difficulty: difficulty.toFixed(2) });
      if (this.history.length > MAX_MEMORY) this.history.pop();
    }

    // Invalidate path cache every 50 updates so future plans use new knowledge
    if (this.traversalCount % 50 === 0) {
      clearPathCache();
    }
  }

  /**
   * Compute real-time difficulty score for current rover state.
   * @param {number} speed - Current rover speed
   * @param {number} slope - Current terrain slope
   * @param {number} craterDanger - 0-1 crater proximity
   * @returns {number} 0-1 difficulty
   */
  computeDifficulty(speed, slope, craterDanger) {
    const slopeFactor = Math.min(slope / 0.8, 1.0);
    const craterFactor = craterDanger;
    return Math.min(1, slopeFactor * 0.5 + craterFactor * 0.5);
  }

  /** Get experience value at world position */
  getExperience(wx, wz) {
    const { col, row } = worldToGrid(wx, wz);
    return this.experienceMap[row * GRID_RES + col];
  }

  /** Get the experience map as weighted overlay for heatmaps */
  getExperienceMap() {
    return this.experienceMap;
  }

  /** Get recent difficulty log */
  getLog() {
    return this.history.slice(0, 20);
  }

  /** Summary stats */
  getStats() {
    let maxExp = 0, sumExp = 0, nonZero = 0;
    for (let i = 0; i < this.experienceMap.length; i++) {
      if (this.experienceMap[i] > 0.01) {
        nonZero++;
        sumExp += this.experienceMap[i];
        maxExp = Math.max(maxExp, this.experienceMap[i]);
      }
    }
    return {
      totalTraversals: this.traversalCount,
      cellsExplored: nonZero,
      maxDifficulty: maxExp.toFixed(3),
      avgDifficulty: nonZero ? (sumExp / nonZero).toFixed(3) : '0.000',
    };
  }
}
