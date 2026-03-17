import Phaser from 'phaser';
import { BULLET_CONFIG } from '../config/constants';

export class Bullet {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly damage: number;
  private readonly expireAtMs: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    direction: Phaser.Math.Vector2,
    createdAtMs: number,
    texture = 'bullet',
    speed = BULLET_CONFIG.speed,
    lifetimeMs = BULLET_CONFIG.maxLifetimeMs,
    damage = 0,
  ) {
    this.sprite = scene.physics.add.image(x, y, texture);
    this.damage = damage;
    this.sprite.setCircle(BULLET_CONFIG.size / 2 - 1);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    this.sprite.setVelocity(
      direction.x * speed,
      direction.y * speed,
    );

    this.expireAtMs = createdAtMs + lifetimeMs;
  }

  isExpired(nowMs: number): boolean {
    return nowMs >= this.expireAtMs;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
