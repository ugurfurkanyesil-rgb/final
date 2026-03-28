# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── moon-rover/         # Moon Rover 3D Simulation (React + Vite + React Three Fiber)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Moon Rover Simulation (`artifacts/moon-rover`)

Full 3D Moon surface rover simulation with:
- **Terrain**: 100×100m smooth Moon terrain with procedural craters (no noise, only crater geometry)
- **3D Rover**: Detailed geometric rover model (6-wheel rocker-bogie, solar panels, mast)
- **Path Planning**: A* algorithm with 4 modes (SAFE, ECO, FAST, AUTO) — always finds a path
- **Right Panel UI**: Matches reference design with topographic mini-map, route selection, heatmaps
- **Heatmaps**: Slope, Slope Angle, Roughness, Slip Risk, Illumination, Hazard Score, Traversability
- **Sun Direction**: 360° adjustable sun with real-time shadow sync
- **Self-Learning AI**: Q-learning style experience map that updates costs as rover traverses
- **Camera**: Bird's eye follow camera + free orbit mode

### Key Files

- `src/App.jsx` — main orchestrator (state, path planning, UI coordination)
- `src/three/terrainGenerator.js` — 100×100m terrain, crater geometry, height/slope/crater maps
- `src/utils/pathfinder.js` — A* pathfinder with 4 cost modes, guaranteed path finding
- `src/utils/learningModel.js` — experience map, difficulty computation, traversal feedback
- `src/utils/heatmaps.js` — thermal/grayscale heatmap canvas rendering for all parameters
- `src/components/MoonScene.jsx` — React Three Fiber 3D scene (terrain, rover, routes, sun)
- `src/components/RightPanel.jsx` — mission control right panel UI
- `src/three/roverController.js` — keyboard + autonomous path-following physics

### Dependencies (moon-rover)

- `@react-three/fiber` — React renderer for Three.js
- `@react-three/drei` — Three.js helper components (OrbitControls, Stars)
- `three` — 3D engine

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/`.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec + Orval codegen config.
