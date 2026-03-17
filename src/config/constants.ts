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
  specialTint: 0xffb347,
  armoredTint: 0x9d7bff,
  blitzTint: 0x5ce1e6,
  armoredSpawnChance: 0.18,
  blitzSpawnChance: 0.12,
  armoredFlashMs: 90,
  specialShotCooldownMs: 1400,
  blitzShotCooldownMs: 2000,
  specialShotRange: 360,
  blitzShotSpreadRadians: 0.28,
  blitzShotCount: 3,
  blitzSizeScale: 1.35,
  blitzSpeedMultiplier: 2.15,
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
  enemySpeed: 320,
  enemyMaxLifetimeMs: 1800,
  enemyDamage: 10,
  maxLifetimeMs: 1200,
  shootCooldownMs: 130,
};

export const PICKUP_CONFIG = {
  shieldSize: 22,
  shieldSpawnMinMs: 7000,
  shieldSpawnMaxMs: 12000,
  shieldLifetimeMs: 9000,
  shieldPadding: 48,
  shieldAbsorbHits: 1,
  burstSize: 24,
  burstSpawnMinMs: 9000,
  burstSpawnMaxMs: 15000,
  burstLifetimeMs: 9000,
  burstDurationMs: 7000,
  burstShotsPerTap: 3,
  burstSpreadRadians: 0.18,
  minigunSize: 24,
  minigunSpawnMinMs: 11000,
  minigunSpawnMaxMs: 18000,
  minigunLifetimeMs: 9000,
  minigunDurationMs: 6500,
  minigunShootCooldownMs: 55,
  minigunSpreadRadians: 0.09,
  healthSize: 26,
  healthLifetimeMs: 12000,
  healthHealAmount: 25,
};

export const HAZARD_CONFIG = {
  poolCount: 4,
  minRadius: 34,
  maxRadius: 58,
  edgePadding: 84,
  playerSpawnSafeRadius: 130,
  pickupSafeRadius: 96,
  damage: 8,
  damageIntervalMs: 700,
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
  shield: 0x79f2ff,
  burst: 0xffc857,
  minigun: 0xb9ff66,
  donut: 0xff9f68,
  donutIcing: 0xff6fae,
  lavaOuter: 0x702100,
  lavaMid: 0xd9480f,
  lavaInner: 0xffb347,
  uiText: '#ffffff',
  uiShadow: '#000000',
};
