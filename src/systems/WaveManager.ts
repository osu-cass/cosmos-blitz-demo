import Phaser from 'phaser';
import { WAVE_CONFIG } from '../config/constants';

export type WaveState = {
  currentWave: number;
  enemiesToSpawn: number;
  enemiesAlive: number;
  inBreak: boolean;
};

export class WaveManager {
  private currentWave = 0;
  private enemiesToSpawn = 0;
  private enemiesAlive = 0;
  private inBreak = false;

  startFirstWave(): void {
    this.currentWave = 1;
    this.enemiesToSpawn = this.waveEnemyCount(this.currentWave);
    this.enemiesAlive = 0;
    this.inBreak = false;
  }

  getState(): WaveState {
    return {
      currentWave: this.currentWave,
      enemiesToSpawn: this.enemiesToSpawn,
      enemiesAlive: this.enemiesAlive,
      inBreak: this.inBreak,
    };
  }

  canSpawnEnemy(): boolean {
    return !this.inBreak && this.enemiesToSpawn > 0;
  }

  onEnemySpawned(): void {
    this.enemiesToSpawn -= 1;
    this.enemiesAlive += 1;
  }

  onEnemyDefeated(scene: Phaser.Scene): void {
    this.enemiesAlive = Math.max(0, this.enemiesAlive - 1);

    if (this.enemiesToSpawn === 0 && this.enemiesAlive === 0 && !this.inBreak) {
      this.inBreak = true;
      scene.time.delayedCall(WAVE_CONFIG.interWaveDelayMs, () => {
        this.startNextWave();
      });
    }
  }

  getSpawnPosition(width: number, height: number, rng = Math.random): Phaser.Math.Vector2 {
    const edge = Math.floor(rng() * 4);

    if (edge === 0) {
      return new Phaser.Math.Vector2(rng() * width, 0);
    }
    if (edge === 1) {
      return new Phaser.Math.Vector2(width, rng() * height);
    }
    if (edge === 2) {
      return new Phaser.Math.Vector2(rng() * width, height);
    }

    return new Phaser.Math.Vector2(0, rng() * height);
  }

  private startNextWave(): void {
    this.currentWave += 1;
    this.enemiesToSpawn = this.waveEnemyCount(this.currentWave);
    this.enemiesAlive = 0;
    this.inBreak = false;
  }

  private waveEnemyCount(wave: number): number {
    return WAVE_CONFIG.startingEnemies + (wave - 1) * WAVE_CONFIG.enemiesPerWaveIncrease;
  }
}
