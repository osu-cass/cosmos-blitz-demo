import Phaser from 'phaser';
import { PICKUP_CONFIG, PLAYER_CONFIG } from '../config/constants';

type MovementInput = {
  x: number;
  y: number;
};

export type LuckyPowerupType = 'speed' | 'spread' | 'shield';

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Image;
  readonly weaponSprite: Phaser.GameObjects.Image;
  private readonly keyboard: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
  };

  private health: number;
  private shieldHits = 0;
  private shieldExpiresAt = 0;
  private burstActiveUntil = 0;
  private minigunActiveUntil = 0;
  private laserActiveUntil = 0;
  private speedBoostUntil = 0;
  private luckySpreadUntil = 0;
  private invulnerableUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.physics.add.image(x, y, 'player');
    this.weaponSprite = scene.add.image(x, y, 'normalWeapon').setDepth(5);
    this.sprite.setScale(1.2);
    this.sprite.setCircle(PLAYER_CONFIG.size / 2 - 1);
    this.sprite.setDrag(1300, 1300);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setMaxVelocity(PLAYER_CONFIG.speed, PLAYER_CONFIG.speed);

    this.keyboard = scene.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Player['keyboard'];

    this.health = PLAYER_CONFIG.maxHealth;
    this.syncWeaponSprite();
  }

  update(sceneTimeMs: number): void {
    this.syncTimedEffects(sceneTimeMs);

    const input = this.readMovementInput();
    const moveSpeed =
      PLAYER_CONFIG.speed *
      (sceneTimeMs < this.speedBoostUntil ? PLAYER_CONFIG.luckySpeedMultiplier : 1);

    const velocity = new Phaser.Math.Vector2(input.x, input.y);
    if (velocity.lengthSq() > 0) {
      velocity.normalize().scale(moveSpeed);
      this.sprite.setVelocity(velocity.x, velocity.y);
    } else {
      this.sprite.setVelocity(0, 0);
    }

    this.syncWeaponSprite();
  }

  aimToward(targetX: number, targetY: number): void {
    const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, targetX, targetY);
    this.sprite.rotation = angle + Math.PI / 2;
    this.weaponSprite.rotation = angle;
    this.syncWeaponSprite();
  }

  getHealth(): number {
    return this.health;
  }

  isAlive(): boolean {
    return this.health > 0;
  }

  hasShield(): boolean {
    return this.shieldHits > 0;
  }

  hasLuckySpread(sceneTimeMs: number): boolean {
    return sceneTimeMs < this.luckySpreadUntil;
  }

  hasSpeedBoost(sceneTimeMs: number): boolean {
    return sceneTimeMs < this.speedBoostUntil;
  }

  hasBurstShot(sceneTimeMs: number): boolean {
    return sceneTimeMs < this.burstActiveUntil;
  }

  hasMinigun(sceneTimeMs: number): boolean {
    return sceneTimeMs < this.minigunActiveUntil;
  }

  hasLaser(sceneTimeMs: number): boolean {
    return sceneTimeMs < this.laserActiveUntil;
  }

  grantShield(): void {
    this.shieldHits = PICKUP_CONFIG.shieldAbsorbHits;
    this.shieldExpiresAt = 0;
    this.sprite.setTint(0x9be7ff);
  }

  grantTimedShield(sceneTimeMs: number, durationMs: number): void {
    this.clearLuckyPowerups();
    this.shieldHits = 1;
    this.shieldExpiresAt = sceneTimeMs + durationMs;
    this.sprite.setTint(0x9be7ff);
  }

  grantBurstShot(sceneTimeMs: number): void {
    this.burstActiveUntil = sceneTimeMs + PICKUP_CONFIG.burstDurationMs;
  }

  grantMinigun(sceneTimeMs: number): void {
    this.minigunActiveUntil = sceneTimeMs + PICKUP_CONFIG.minigunDurationMs;
  }

  grantLaser(sceneTimeMs: number): void {
    this.laserActiveUntil = sceneTimeMs + PICKUP_CONFIG.laserDurationMs;
  }

  grantLuckySpeed(sceneTimeMs: number, durationMs: number): void {
    this.clearLuckyPowerups();
    this.speedBoostUntil = sceneTimeMs + durationMs;
  }

  grantLuckySpread(sceneTimeMs: number, durationMs: number): void {
    this.clearLuckyPowerups();
    this.luckySpreadUntil = sceneTimeMs + durationMs;
  }

  getActiveLuckyPowerup(sceneTimeMs: number): LuckyPowerupType | undefined {
    if (sceneTimeMs < this.speedBoostUntil) {
      return 'speed';
    }

    if (sceneTimeMs < this.luckySpreadUntil) {
      return 'spread';
    }

    if (this.shieldExpiresAt > 0 && sceneTimeMs < this.shieldExpiresAt && this.shieldHits > 0) {
      return 'shield';
    }

    return undefined;
  }

  heal(amount: number): boolean {
    if (!this.isAlive() || this.health >= PLAYER_CONFIG.maxHealth) {
      return false;
    }

    this.health = Math.min(PLAYER_CONFIG.maxHealth, this.health + amount);
    this.sprite.setTintFill(0xfff1a8);
    this.sprite.scene.time.delayedCall(PLAYER_CONFIG.damageFlashMs, () => {
      if (!this.sprite.active) {
        return;
      }

      if (this.shieldHits > 0) {
        this.sprite.setTint(0x9be7ff);
      } else {
        this.sprite.clearTint();
      }
    });

    return true;
  }

  takeDamage(sceneTimeMs: number, amount: number): boolean {
    if (sceneTimeMs < this.invulnerableUntil || !this.isAlive()) {
      return false;
    }

    if (this.shieldHits > 0) {
      this.shieldHits -= 1;
      this.invulnerableUntil = sceneTimeMs + Math.floor(PLAYER_CONFIG.damageInvulnerabilityMs * 0.6);
      this.sprite.clearTint();
      this.sprite.setTintFill(0x79f2ff);
      this.sprite.scene.time.delayedCall(PLAYER_CONFIG.damageFlashMs, () => {
        if (!this.sprite.active) {
          return;
        }

        if (this.shieldHits > 0) {
          this.sprite.setTint(0x9be7ff);
        } else {
          this.sprite.clearTint();
        }
      });
      return true;
    }

    this.health = Math.max(0, this.health - amount);
    this.invulnerableUntil = sceneTimeMs + PLAYER_CONFIG.damageInvulnerabilityMs;

    this.sprite.setTintFill(0xffffff);
    this.sprite.scene.time.delayedCall(PLAYER_CONFIG.damageFlashMs, () => {
      if (!this.sprite.active) {
        return;
      }

      this.sprite.clearTint();
    });

    return true;
  }

  private readMovementInput(): MovementInput {
    const leftPressed = this.keyboard.left.isDown || this.keyboard.a.isDown;
    const rightPressed = this.keyboard.right.isDown || this.keyboard.d.isDown;
    const upPressed = this.keyboard.up.isDown || this.keyboard.w.isDown;
    const downPressed = this.keyboard.down.isDown || this.keyboard.s.isDown;

    let x = 0;
    let y = 0;

    if (leftPressed) x -= 1;
    if (rightPressed) x += 1;
    if (upPressed) y -= 1;
    if (downPressed) y += 1;

    const gamepad = this.sprite.scene.input.gamepad?.getPad(0);
    if (gamepad) {
      const deadzone = 0.2;
      const axisX = Math.abs(gamepad.leftStick.x) > deadzone ? gamepad.leftStick.x : 0;
      const axisY = Math.abs(gamepad.leftStick.y) > deadzone ? gamepad.leftStick.y : 0;

      if (Math.abs(axisX) > Math.abs(x)) x = axisX;
      if (Math.abs(axisY) > Math.abs(y)) y = axisY;
    }

    return { x, y };
  }

  private clearLuckyPowerups(): void {
    this.speedBoostUntil = 0;
    this.luckySpreadUntil = 0;

    if (this.shieldExpiresAt > 0) {
      this.shieldHits = 0;
      this.shieldExpiresAt = 0;
      this.sprite.clearTint();
    }
  }

  private syncTimedEffects(sceneTimeMs: number): void {
    if (this.shieldExpiresAt > 0 && sceneTimeMs >= this.shieldExpiresAt) {
      this.shieldHits = 0;
      this.shieldExpiresAt = 0;
      this.sprite.clearTint();
    }
  }

  private syncWeaponSprite(): void {
    const offset = PLAYER_CONFIG.size * 0.52;
    const angle = this.sprite.rotation - Math.PI / 2;
    this.weaponSprite.setPosition(
      this.sprite.x + Math.cos(angle) * offset,
      this.sprite.y + Math.sin(angle) * offset,
    );
  }
}
