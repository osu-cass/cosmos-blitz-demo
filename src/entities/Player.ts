import Phaser from 'phaser';
import { PLAYER_CONFIG } from '../config/constants';

type MovementInput = {
  x: number;
  y: number;
};

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Image;
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
  private invulnerableUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.physics.add.image(x, y, 'player');
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
  }

  update(): void {
    const input = this.readMovementInput();

    const velocity = new Phaser.Math.Vector2(input.x, input.y);
    if (velocity.lengthSq() > 0) {
      velocity.normalize().scale(PLAYER_CONFIG.speed);
      this.sprite.setVelocity(velocity.x, velocity.y);
    } else {
      this.sprite.setVelocity(0, 0);
    }
  }

  aimToward(targetX: number, targetY: number): void {
    const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, targetX, targetY);
    this.sprite.rotation = angle + Math.PI / 2;
  }

  getHealth(): number {
    return this.health;
  }

  isAlive(): boolean {
    return this.health > 0;
  }

  takeDamage(sceneTimeMs: number, amount: number): boolean {
    if (sceneTimeMs < this.invulnerableUntil || !this.isAlive()) {
      return false;
    }

    this.health = Math.max(0, this.health - amount);
    this.invulnerableUntil = sceneTimeMs + PLAYER_CONFIG.damageInvulnerabilityMs;

    this.sprite.setTintFill(0xffffff);
    this.sprite.scene.time.delayedCall(PLAYER_CONFIG.damageFlashMs, () => {
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
}
