export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const PLAYER_CONFIG = {
  size: 28,
  speed: 260,
  maxHealth: 100,
  damageFlashMs: 120,
  damageInvulnerabilityMs: 500,
};

export const ENEMY_CONFIG = {
  size: 24,
  speed: 105,
  touchDamage: 10,
  minEnemyGapPx: 10,
  spacingOverrideNearPlayerPx: 90,
  steeringSmoothing: 0.16,
  predictionStrength: 0.65,
  strafeStrength: 0.42,
  strafeRange: 240,
  attackRingRadius: 140,
  attackRotateSpeed: 0.65,
  avoidanceRadius: 52,
  avoidanceStrength: 1.15,
  bounceFactor: 0.9,
};

export const BULLET_CONFIG = {
  size: 10,
  speed: 560,
  maxLifetimeMs: 1200,
  shootCooldownMs: 130,
};

export const WAVE_CONFIG = {
  startingEnemies: 4,
  enemiesPerWaveIncrease: 2,
  interWaveDelayMs: 2500,
};

export const COLORS = {
  arenaBg: 0x22303b,
  floorTileA: 0x324552,
  floorTileB: 0x2b3d49,
  player: 0x44ccff,
  enemy: 0xff6b6b,
  uiText: '#ffffff',
  uiShadow: '#000000',
};
