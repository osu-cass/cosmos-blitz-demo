import Phaser from 'phaser';
import { ENEMY_CONFIG } from '../config/constants';

export class Enemy {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly isSpecial: boolean;
  private readonly strafeDirection: number;
  private readonly strafePhase: number;
  private readonly attackPhase: number;
  private nextShotAtMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, isSpecial = false) {
    this.sprite = scene.physics.add.image(x, y, 'enemy');
    this.isSpecial = isSpecial;
    this.sprite.setCircle(ENEMY_CONFIG.size / 2 - 1);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setBounce(ENEMY_CONFIG.bounceFactor, ENEMY_CONFIG.bounceFactor);
    body.setCollideWorldBounds(true);
    if (this.isSpecial) {
      this.sprite.setTint(ENEMY_CONFIG.specialTint);
      this.sprite.setScale(1.16);
      this.nextShotAtMs = scene.time.now + Phaser.Math.Between(500, 900);
    }
    this.strafeDirection = Math.random() < 0.5 ? -1 : 1;
    this.strafePhase = Math.random() * Math.PI * 2;
    this.attackPhase = Math.random() * 2.6;
  }

  update(
    target: Phaser.Math.Vector2,
    targetVelocity: Phaser.Math.Vector2,
    timeSeconds: number,
    formationTarget: Phaser.Math.Vector2,
    avoidanceDirection: Phaser.Math.Vector2,
  ): void {
    const toTarget = new Phaser.Math.Vector2(target.x - this.sprite.x, target.y - this.sprite.y);
    const distance = toTarget.length();

    if (distance <= 0.0001) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    const predictionTime = Phaser.Math.Clamp(
      (distance / 320) * ENEMY_CONFIG.predictionStrength,
      0,
      0.55,
    );
    const predictedTarget = new Phaser.Math.Vector2(
      target.x + targetVelocity.x * predictionTime,
      target.y + targetVelocity.y * predictionTime,
    );

    const predictedDirection = new Phaser.Math.Vector2(
      predictedTarget.x - this.sprite.x,
      predictedTarget.y - this.sprite.y,
    );

    const towardPlayer = toTarget.clone().normalize();
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    const attackCycleSeconds = 2.6;
    const attackWindowSeconds = 1.0;
    const cycleT = (timeSeconds + this.attackPhase) % attackCycleSeconds;
    const isChargeWindow = cycleT <= attackWindowSeconds;

    const desiredDirection = predictedDirection.clone();

    if (isChargeWindow) {
      desiredDirection.scale(0.6).add(towardPlayer.clone().scale(1.4));
    } else {
      const ringBlend = Phaser.Math.Clamp(1 - distance / (ENEMY_CONFIG.attackRingRadius * 2.4), 0, 1);
      desiredDirection.lerp(
        new Phaser.Math.Vector2(formationTarget.x - this.sprite.x, formationTarget.y - this.sprite.y),
        ringBlend * 0.4,
      );

      const preferredDistance = ENEMY_CONFIG.attackRingRadius * 0.78;
      const pressure = Phaser.Math.Clamp(
        (distance - preferredDistance) / ENEMY_CONFIG.attackRingRadius,
        -0.2,
        1,
      );
      const inwardWeight = 0.8 + pressure * 0.7;
      desiredDirection.add(towardPlayer.clone().scale(inwardWeight));
    }

    if (distance < ENEMY_CONFIG.attackRingRadius * 1.35 && body.velocity.lengthSq() > 0.001) {
      const tangent = new Phaser.Math.Vector2(-towardPlayer.y, towardPlayer.x);
      const tangentialSpeed = Math.abs(body.velocity.dot(tangent));
      const antiOrbit = Phaser.Math.Clamp(tangentialSpeed / ENEMY_CONFIG.speed, 0, 1.4);
      desiredDirection.add(towardPlayer.clone().scale(antiOrbit * 1.35));
    }

    if (distance < ENEMY_CONFIG.size * 2.6) {
      desiredDirection.copy(towardPlayer);
    }

    if (!isChargeWindow && distance < ENEMY_CONFIG.strafeRange && distance > ENEMY_CONFIG.size * 3) {
      const strafeAmount =
        Math.sin(timeSeconds * 3 + this.strafePhase) *
        ENEMY_CONFIG.strafeStrength *
        this.strafeDirection;
      const side = new Phaser.Math.Vector2(-desiredDirection.y, desiredDirection.x)
        .normalize()
        .scale(strafeAmount);
      desiredDirection.add(side);
    }

    if (avoidanceDirection.lengthSq() > 0.0001) {
      desiredDirection.add(avoidanceDirection.scale(ENEMY_CONFIG.avoidanceStrength));
    }

    if (desiredDirection.lengthSq() <= 0.0001) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    desiredDirection.normalize();

    const speedMultiplier = isChargeWindow ? 1.12 : distance > 320 ? 1.08 : 1;
    const desiredVelocity = desiredDirection.scale(ENEMY_CONFIG.speed * speedMultiplier);

    const nextVx = Phaser.Math.Linear(
      body.velocity.x,
      desiredVelocity.x,
      ENEMY_CONFIG.steeringSmoothing,
    );
    const nextVy = Phaser.Math.Linear(
      body.velocity.y,
      desiredVelocity.y,
      ENEMY_CONFIG.steeringSmoothing,
    );

    this.sprite.setVelocity(nextVx, nextVy);
    this.sprite.rotation = Phaser.Math.Angle.Between(0, 0, nextVx, nextVy) + Math.PI / 2;
  }

  destroy(): void {
    this.sprite.destroy();
  }

  canShoot(nowMs: number): boolean {
    return this.isSpecial && nowMs >= this.nextShotAtMs;
  }

  scheduleNextShot(nowMs: number): void {
    this.nextShotAtMs =
      nowMs +
      ENEMY_CONFIG.specialShotCooldownMs +
      Phaser.Math.Between(-180, 220);
  }
}
