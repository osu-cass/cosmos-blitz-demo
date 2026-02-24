# Top-Down Arena Shooter (Phaser + TypeScript + Bun)

A simple single-player 2D top-down arena shooter designed for fast live editing.

## Install

```bash
bun install
```

If Bun cache permissions are restricted on your machine, use a local cache directory:

```bash
$env:BUN_INSTALL_CACHE_DIR = "$PWD\.bun-cache"
bun install
```

## Run (dev)

```bash
bun run dev
```

## Build

```bash
bun run build
```

## Controls

- Move: `WASD` or Arrow Keys
- Gamepad: Left stick (when connected)
- Shoot: Left mouse click (fires toward cursor)
- Toggle browser fullscreen: `F`
- Restart after game over: `R`

## Current gameplay

- Player moves in a fixed-size arena and cannot leave bounds.
- Enemies spawn from arena edges and move toward the player.
- Enemies use simple steering (predictive chase + strafe) and collide with each other.
- Click-to-shoot bullets can defeat enemies.
- Touching an enemy damages the player.
- Waves increase enemy count over time.
- HUD shows health, wave number, and enemies remaining.
- Endless progression with a short break between waves.

## Project structure

- `src/config/constants.ts` — all tuneable values (arena, movement, health, wave scaling, colors)
- `src/entities/Player.ts` — player movement + damage/invulnerability behavior
- `src/entities/Enemy.ts` — basic enemy chase behavior
- `src/systems/WaveManager.ts` — wave progression and edge spawn selection
- `src/scenes/GameScene.ts` — game loop orchestration, spawning, collisions, HUD, game over
- `src/main.ts` — Phaser bootstrap/config

## Where to extend later

- Add new enemy types in `src/entities/` and spawn rules in `src/systems/WaveManager.ts`.
- Add new gameplay systems (weapons, powerups, etc.) by composing into `GameScene` instead of rewriting core classes.
- Adjust pace/difficulty in `src/config/constants.ts`.
- Enemy steering and movement feel can be tuned in `ENEMY_CONFIG` in `src/config/constants.ts`.
- Replace generated placeholder visuals in `GameScene.createPlaceholderTextures()` with image assets when desired.

## Notes for live AI editing

- Keep each feature in its own module.
- Prefer changing values in constants first before changing behavior code.
- Existing extension-point comments in `GameScene` indicate safe insertion areas.
