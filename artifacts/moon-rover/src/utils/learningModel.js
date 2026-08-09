/**
 * Self-Learning Cost Model
 * Maintains a traversal experience map that the rover updates as it drives.
 */

import { GRID_RES } from '../three/terrainGenerator.js';
import { worldToGrid, clearPathCache } from './pathfinder.js';

const ALPHA = 0.14;
const DECAY = 0.0002;

export class LearningModel {
  constructor() {
    this.experienceMap = new Float32Array(GRID_RES * GRID_RES);
    this.traversalCount = 0;
    this.history = [];
  }

  recordTraversal(wx, wz, difficulty) {
    const { col, row } = worldToGrid(wx, wz);
    const idx = row * GRID_RES + col;
    this.experienceMap[idx] = (1 - ALPHA) * this.experienceMap[idx] + ALPHA * difficulty;
    this.traversalCount++;

    for (let dr = -1; dr <= 1; dr++) {
      const nr = row + dr;
      if (nr < 0 || nr >= GRID_RES) continue;
      for (let dc = -1; dc <= 1; dc++) {
        const nc = col + dc;
        if (nc < 0 || nc >= GRID_RES) continue;
        const ni = nr * GRID_RES + nc;
        this.experienceMap[ni] *= (1 - DECAY);
      }
    }

    if (difficulty > 0.5) {
      this.history.unshift({ wx: wx.toFixed(1), wz: wz.toFixed(1), difficulty: difficulty.toFixed(2) });
      if (this.history.length > 2000) this.history.pop();
    }

    if (this.traversalCount % 50 === 0) clearPathCache();
  }

  computeDifficulty(speed, slope, craterDanger) {
    return Math.min(1, Math.min(slope / 0.8, 1.0) * 0.5 + craterDanger * 0.5);
  }

  getExperience(wx, wz) {
    const { col, row } = worldToGrid(wx, wz);
    return this.experienceMap[row * GRID_RES + col];
  }

  getExperienceMap() { return this.experienceMap; }
  getLog() { return this.history.slice(0, 20); }

  /** Stats shape expected by RightPanel */
  getStats() {
    let maxH = 0, nonZero = 0;
    for (let i = 0; i < this.experienceMap.length; i++) {
      if (this.experienceMap[i] > 0.01) {
        nonZero++;
        if (this.experienceMap[i] > maxH) maxH = this.experienceMap[i];
      }
    }
    return {
      traversals:  this.traversalCount,
      cellsKnown:  nonZero,
      maxHazard:   maxH,
    };
  }
}
