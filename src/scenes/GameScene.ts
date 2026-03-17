import Phaser from 'phaser';
import {
  BULLET_CONFIG,
  COLORS,
  ENEMY_CONFIG,
  PLAYER_CONFIG,
} from '../config/constants';
import { Bullet } from '../entities/Bullet';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { WaveManager } from '../systems/WaveManager';

export class GameScene extends Phaser.Scene {
  private backgroundGraphics!: Phaser.GameObjects.Graphics;
  private player!: Player;
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private waveManager = new WaveManager();

  private healthText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private remainingText!: Phaser.GameObjects.Text;
  private gameOverText!: Phaser.GameObjects.Text;

  private spawnTimer = 0;
  private spawnIntervalMs = 550;
  private lastShotAtMs = 0;
  private gameOver = false;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.createPlaceholderTextures();
  }

  create(): void {
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);
    this.drawArenaBackground();

    this.player = new Player(this, this.scale.width / 2, this.scale.height / 2);
    this.enemyGroup = this.physics.add.group();

    this.physics.add.collider(
      this.player.sprite,
      this.enemyGroup,
      this.handlePlayerEnemyCollision,
      undefined,
      this,
    );
    this.physics.add.collider(this.enemyGroup, this.enemyGroup);

    this.waveManager.startFirstWave();
    this.createHud();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.gameOver) {
        this.shootToward(pointer.worldX, pointer.worldY);
      }
    });

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.onResize(gameSize.width, gameSize.height);
    });

    this.input.keyboard?.on('keydown-R', () => {
      if (this.gameOver) {
        window.location.reload();
      }
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.gameOver) {
        this.setGameOver();
      }
    });

    this.input.keyboard?.on('keydown-F', () => {
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
      } else {
        this.scale.startFullscreen();
      }
    });
  }

  update(_: number, delta: number): void {
    if (this.gameOver) {
      return;
    }

    const pointer = this.input.activePointer;
    this.player.aimToward(pointer.worldX, pointer.worldY);
    this.player.update();
    this.updateEnemies();
    this.updateBullets();
    this.handleSpawning(delta);
    this.updateHud();
  }

  private updateEnemies(): void {
    const target = new Phaser.Math.Vector2(this.player.sprite.x, this.player.sprite.y);
    const playerBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    const targetVelocity = new Phaser.Math.Vector2(playerBody.velocity.x, playerBody.velocity.y);
    const timeSeconds = this.time.now / 1000;
    const enemyCount = this.enemies.length;

    for (let i = enemyCount - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      const slotAngle = (i / Math.max(enemyCount, 1)) * Phaser.Math.PI2 + timeSeconds * ENEMY_CONFIG.attackRotateSpeed;
      const formationTarget = new Phaser.Math.Vector2(
        target.x + Math.cos(slotAngle) * ENEMY_CONFIG.attackRingRadius,
        target.y + Math.sin(slotAngle) * ENEMY_CONFIG.attackRingRadius,
      );

      const avoidance = this.computeEnemyAvoidance(i);
      enemy.update(target, targetVelocity, timeSeconds, formationTarget, avoidance);
    }

    this.enforceEnemySpacing(target);
  }

  private enforceEnemySpacing(playerPos: Phaser.Math.Vector2): void {
    const minCenterDistance = ENEMY_CONFIG.size + ENEMY_CONFIG.minEnemyGapPx;
    const minCenterDistanceSq = minCenterDistance * minCenterDistance;
    const nearPlayerSq =
      ENEMY_CONFIG.spacingOverrideNearPlayerPx * ENEMY_CONFIG.spacingOverrideNearPlayerPx;

    for (let i = 0; i < this.enemies.length; i += 1) {
      for (let j = i + 1; j < this.enemies.length; j += 1) {
        const a = this.enemies[i].sprite;
        const b = this.enemies[j].sprite;

        const ax = a.x - playerPos.x;
        const ay = a.y - playerPos.y;
        const bx = b.x - playerPos.x;
        const by = b.y - playerPos.y;
        const bothNearPlayer = ax * ax + ay * ay <= nearPlayerSq && bx * bx + by * by <= nearPlayerSq;
        if (bothNearPlayer) {
          continue;
        }

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;

        if (distSq >= minCenterDistanceSq) {
          continue;
        }

        const distance = Math.max(0.0001, Math.sqrt(distSq));
        const overlap = minCenterDistance - distance;
        const nx = dx / distance;
        const ny = dy / distance;
        const push = overlap * 0.5;

        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;

        const bodyA = a.body as Phaser.Physics.Arcade.Body;
        const bodyB = b.body as Phaser.Physics.Arcade.Body;
        bodyA.velocity.x -= nx * 8;
        bodyA.velocity.y -= ny * 8;
        bodyB.velocity.x += nx * 8;
        bodyB.velocity.y += ny * 8;
      }
    }
  }

  private computeEnemyAvoidance(index: number): Phaser.Math.Vector2 {
    const enemy = this.enemies[index];
    const avoidance = new Phaser.Math.Vector2(0, 0);
    const radius = ENEMY_CONFIG.avoidanceRadius;
    const radiusSq = radius * radius;

    for (let i = 0; i < this.enemies.length; i += 1) {
      if (i === index) {
        continue;
      }

      const other = this.enemies[i];
      const dx = enemy.sprite.x - other.sprite.x;
      const dy = enemy.sprite.y - other.sprite.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq <= 0.001 || distanceSq > radiusSq) {
        continue;
      }

      const distance = Math.sqrt(distanceSq);
      const strength = (radius - distance) / radius;
      avoidance.x += (dx / distance) * strength;
      avoidance.y += (dy / distance) * strength;
    }

    return avoidance;
  }

  private handleSpawning(delta: number): void {
    this.spawnTimer += delta;

    if (!this.waveManager.canSpawnEnemy() || this.spawnTimer < this.spawnIntervalMs) {
      return;
    }

    this.spawnTimer = 0;
    this.spawnEnemyAtEdge();
  }

  private spawnEnemyAtEdge(): void {
    const point = this.waveManager.getSpawnPosition(this.scale.width, this.scale.height);
    const enemy = new Enemy(this, point.x, point.y);
    this.enemies.push(enemy);
    this.enemyGroup.add(enemy.sprite);
    this.waveManager.onEnemySpawned();
  }

  private shootToward(targetX: number, targetY: number): void {
    if (this.time.now - this.lastShotAtMs < BULLET_CONFIG.shootCooldownMs) {
      return;
    }

    const direction = new Phaser.Math.Vector2(
      targetX - this.player.sprite.x,
      targetY - this.player.sprite.y,
    );

    if (direction.lengthSq() < 0.001) {
      return;
    }

    direction.normalize();

    const spawnDistance = PLAYER_CONFIG.size / 2 + BULLET_CONFIG.size;
    const spawnX = this.player.sprite.x + direction.x * spawnDistance;
    const spawnY = this.player.sprite.y + direction.y * spawnDistance;

    const bullet = new Bullet(this, spawnX, spawnY, direction, this.time.now);
    this.bullets.push(bullet);
    this.lastShotAtMs = this.time.now;
  }

  private updateBullets(): void {
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.bullets[i];

      if (bullet.isExpired(this.time.now)) {
        bullet.destroy();
        this.bullets.splice(i, 1);
        continue;
      }

      const outOfBounds =
        bullet.sprite.x < -20 ||
        bullet.sprite.y < -20 ||
        bullet.sprite.x > this.scale.width + 20 ||
        bullet.sprite.y > this.scale.height + 20;
      if (outOfBounds) {
        bullet.destroy();
        this.bullets.splice(i, 1);
        continue;
      }

      for (let j = this.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = this.enemies[j];
        const hit = Phaser.Geom.Intersects.RectangleToRectangle(
          bullet.sprite.getBounds(),
          enemy.sprite.getBounds(),
        );

        if (hit) {
          bullet.destroy();
          this.bullets.splice(i, 1);

          this.destroyEnemyAt(j);
          break;
        }
      }
    }
  }

  private handlePlayerEnemyCollision(): void {
    const didTakeDamage = this.player.takeDamage(this.time.now, ENEMY_CONFIG.touchDamage);
    if (!didTakeDamage) {
      return;
    }

    if (!this.player.isAlive()) {
      this.setGameOver();
    }
  }

  private setGameOver(): void {
    this.gameOver = true;
    this.physics.world.pause();
    this.gameOverText.setVisible(true);
    this.player.sprite.setTint(0x888888);
    this.clearBullets();
  }

  private createHud(): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      color: COLORS.uiText,
      fontSize: '32px',
      fontFamily: 'Arial',
      stroke: COLORS.uiShadow,
      strokeThickness: 5,
    };

    this.healthText = this.add.text(16, 12, '', style).setDepth(10);
    this.waveText = this.add.text(16, 44, '', style).setDepth(10);
    this.remainingText = this.add.text(16, 76, '', style).setDepth(10);

    this.add
      .text(this.scale.width - 16, 12, 'ESC to Forfeit', {
        ...style,
        fontSize: '24px',
      })
      .setOrigin(1, 0)
      .setDepth(10);

    this.gameOverText = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        'GAME OVER\nPress R to Restart',
        {
          ...style,
          fontSize: '58px',
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);

    this.updateHud();
  }

  private updateHud(): void {
    const waveState = this.waveManager.getState();
    const remaining = waveState.enemiesToSpawn + waveState.enemiesAlive;

    this.healthText.setText(`❤ Health: ${this.player.getHealth()}/${PLAYER_CONFIG.maxHealth}`);
    this.waveText.setText(`⚑ Wave: ${waveState.currentWave}`);

    if (waveState.inBreak) {
      this.remainingText.setText('☠ Enemies: 0 (next wave soon...)');
    } else {
      this.remainingText.setText(`☠ Enemies: ${remaining}`);
    }
  }

  private drawArenaBackground(): void {
    if (!this.backgroundGraphics) {
      this.backgroundGraphics = this.add.graphics();
    }

    const bg = this.backgroundGraphics;
    bg.clear();

    bg.fillStyle(COLORS.arenaBg, 1);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);

    // Extension point: switch to a tilemap or generated art here.
    const tileSize = 48;
    for (let y = 0; y < this.scale.height; y += tileSize) {
      for (let x = 0; x < this.scale.width; x += tileSize) {
        const isAlt = ((x + y) / tileSize) % 2 === 0;
        bg.fillStyle(isAlt ? COLORS.floorTileA : COLORS.floorTileB, 0.9);
        bg.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
      }
    }
  }

  private onResize(width: number, height: number): void {
    this.physics.world.setBounds(0, 0, width, height);
    this.drawArenaBackground();
    this.gameOverText.setPosition(width / 2, height / 2);
  }

  private createPlaceholderTextures(): void {
    const g = this.add.graphics();

    g.clear();
    g.fillStyle(COLORS.player, 1);
    g.fillCircle(
      PLAYER_CONFIG.size / 2,
      PLAYER_CONFIG.size / 2,
      PLAYER_CONFIG.size / 2 - 1,
    );
    g.fillStyle(0xffffff, 1);
    g.fillRect(
      PLAYER_CONFIG.size / 2 - 2,
      Math.floor(PLAYER_CONFIG.size * 0.2),
      4,
      Math.floor(PLAYER_CONFIG.size * 0.35),
    );
    g.generateTexture('player', PLAYER_CONFIG.size, PLAYER_CONFIG.size);

    g.clear();
    g.fillStyle(COLORS.enemy, 1);
    g.fillCircle(ENEMY_CONFIG.size / 2, ENEMY_CONFIG.size / 2, ENEMY_CONFIG.size / 2 - 1);
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(6, 7, 4, 4);
    g.fillRect(14, 7, 4, 4);
    g.generateTexture('enemy', ENEMY_CONFIG.size, ENEMY_CONFIG.size);

    g.clear();
    g.fillStyle(0xfff08a, 1);
    g.fillCircle(BULLET_CONFIG.size / 2, BULLET_CONFIG.size / 2, BULLET_CONFIG.size / 2 - 1);
    g.generateTexture('bullet', BULLET_CONFIG.size, BULLET_CONFIG.size);

    g.destroy();
  }

  private clearBullets(): void {
    for (const bullet of this.bullets) {
      bullet.destroy();
    }
    this.bullets = [];
  }

  private destroyEnemyAt(index: number): void {
    const enemy = this.enemies[index];
    this.enemyGroup.remove(enemy.sprite, false, false);
    enemy.destroy();
    this.enemies.splice(index, 1);
    this.waveManager.onEnemyDefeated(this);
  }
}
