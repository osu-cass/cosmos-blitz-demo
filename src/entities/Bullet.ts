import Phaser from 'phaser';
import { BULLET_CONFIG } from '../config/constants';

type BulletOptions = {
  homingTurnRate?: number;
};

export class Bullet {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly damage: number;
  private readonly expireAtMs: number;
  private readonly speed: number;
  private readonly homingTurnRate: number;

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
    options: BulletOptions = {},
  ) {
    this.sprite = scene.physics.add.image(x, y, texture);
    this.damage = damage;
    this.speed = speed;
    this.homingTurnRate = options.homingTurnRate ?? 0;
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

  updateHoming(deltaMs: number, targetX: number, targetY: number): void {
    if (this.homingTurnRate <= 0) {
      return;
    }

    const body = this.sprite.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) {
      return;
    }

    const toTarget = new Phaser.Math.Vector2(targetX - this.sprite.x, targetY - this.sprite.y);
    if (toTarget.lengthSq() < 0.001) {
      return;
    }

    const currentVelocity = new Phaser.Math.Vector2(body.velocity.x, body.velocity.y);
    if (currentVelocity.lengthSq() < 0.001) {
      return;
    }

    const turnAmount = Phaser.Math.Clamp((this.homingTurnRate * deltaMs) / 1000, 0, 1);
    const nextDirection = currentVelocity
      .normalize()
      .lerp(toTarget.normalize(), turnAmount)
      .normalize();

    this.sprite.setVelocity(nextDirection.x * this.speed, nextDirection.y * this.speed);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
