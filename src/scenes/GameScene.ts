import Phaser from 'phaser';
import {
  BULLET_CONFIG,
  COLORS,
  ENEMY_CONFIG,
  HAZARD_CONFIG,
  PICKUP_CONFIG,
  PLAYER_CONFIG,
} from '../config/constants';
import { Bullet } from '../entities/Bullet';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { WaveManager } from '../systems/WaveManager';

export class GameScene extends Phaser.Scene {
  private lavaPools: { x: number; y: number; radius: number }[] = [];
  private portal?: { x: number; y: number; radius: number };
  private backgroundGraphics!: Phaser.GameObjects.Graphics;
  private laserGraphics!: Phaser.GameObjects.Graphics;
  private player!: Player;
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private enemyBullets: Bullet[] = [];
  private waveManager = new WaveManager();
  private shieldPickup?: Phaser.GameObjects.Image;
  private burstPickup?: Phaser.GameObjects.Image;
  private minigunPickup?: Phaser.GameObjects.Image;
  private laserPickup?: Phaser.GameObjects.Image;
  private donutPickup?: Phaser.GameObjects.Image;

  private healthText!: Phaser.GameObjects.Text;
  private shieldText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private remainingText!: Phaser.GameObjects.Text;
  private legendContainer!: Phaser.GameObjects.Container;
  private gameOverText!: Phaser.GameObjects.Text;

  private spawnTimer = 0;
  private spawnIntervalMs = 550;
  private lastShotAtMs = 0;
  private specialEnemyWave = 0;
  private blitzEnemyWave = 0;
  private observedWave = 0;
  private nextShieldSpawnAt = 0;
  private shieldExpiresAt = 0;
  private nextBurstSpawnAt = 0;
  private burstExpiresAt = 0;
  private nextMinigunSpawnAt = 0;
  private minigunExpiresAt = 0;
  private nextLaserSpawnAt = 0;
  private laserExpiresAt = 0;
  private donutExpiresAt = 0;
  private lastLavaDamageAt = 0;
  private lastLaserTickAt = 0;
  private lastPortalTeleportAt = 0;
  private gameOver = false;
  private isPaused = false;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.createPlaceholderTextures();
  }

  create(): void {
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);
    this.generateLavaPools();
    this.generatePortal();
    this.drawArenaBackground();
    this.laserGraphics = this.add.graphics().setDepth(4);

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
    this.observedWave = this.waveManager.getState().currentWave;
    this.specialEnemyWave = this.observedWave - 1;
    this.blitzEnemyWave = this.observedWave - 1;
    this.scheduleNextShieldSpawn();
    this.scheduleNextBurstSpawn();
    this.scheduleNextMinigunSpawn();
    this.scheduleNextLaserSpawn();
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
        this.openPauseMenu();
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
    this.updateEnemyBullets();
    this.handleSpawning(delta);
    this.updateLavaHazards();
    this.updatePortal();
    this.updateShieldPickup();
    this.updateBurstPickup();
    this.updateMinigunPickup();
    this.updateLaserPickup();
    this.updateDonutPickup();
    this.updateLaserWeapon();
    this.updateHud();

    if (this.input.activePointer.isDown) {
      this.shootToward(pointer.worldX, pointer.worldY);
    }
  }

  private updateDonutPickup(): void {
    const currentWave = this.waveManager.getState().currentWave;
    if (currentWave !== this.observedWave) {
      this.observedWave = currentWave;
      this.trySpawnDonutForWave(currentWave);
    }

    if (this.donutPickup && this.time.now >= this.donutExpiresAt) {
      this.removeDonutPickup();
      return;
    }

    if (!this.donutPickup) {
      return;
    }

    const pickedUp =
      Phaser.Math.Distance.Between(
        this.player.sprite.x,
        this.player.sprite.y,
        this.donutPickup.x,
        this.donutPickup.y,
      ) <=
      PLAYER_CONFIG.size * 0.75 + PICKUP_CONFIG.healthSize * 0.5;

    if (!pickedUp) {
      return;
    }

    this.player.heal(PICKUP_CONFIG.healthHealAmount);
    this.removeDonutPickup();
  }

  private updateLavaHazards(): void {
    const playerInLava = this.isPointInLava(this.player.sprite.x, this.player.sprite.y, PLAYER_CONFIG.size * 0.35);
    if (
      playerInLava &&
      this.time.now - this.lastLavaDamageAt >= HAZARD_CONFIG.damageIntervalMs
    ) {
      this.lastLavaDamageAt = this.time.now;
      const didTakeDamage = this.player.takeDamage(this.time.now, HAZARD_CONFIG.damage);
      if (didTakeDamage && !this.player.isAlive()) {
        this.setGameOver();
      }
    }
  }

  private updatePortal(): void {
    if (!this.portal || this.time.now - this.lastPortalTeleportAt < HAZARD_CONFIG.portalTeleportCooldownMs) {
      return;
    }

    const playerInPortal =
      Phaser.Math.Distance.Between(
        this.player.sprite.x,
        this.player.sprite.y,
        this.portal.x,
        this.portal.y,
      ) <=
      this.portal.radius + PLAYER_CONFIG.size * 0.35;

    if (!playerInPortal) {
      return;
    }

    const destination = this.findSafeOpenPoint(HAZARD_CONFIG.portalPadding, this.portal.radius + 40);
    if (!destination) {
      return;
    }

    this.lastPortalTeleportAt = this.time.now;
    this.player.sprite.setPosition(destination.x, destination.y);
    this.player.sprite.setVelocity(0, 0);
  }

  private updateEnemies(): void {
    const target = new Phaser.Math.Vector2(this.player.sprite.x, this.player.sprite.y);
    const playerBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    const targetVelocity = new Phaser.Math.Vector2(playerBody.velocity.x, playerBody.velocity.y);
    const timeSeconds = this.time.now / 1000;
    const enemyCount = this.enemies.length;

    for (let i = enemyCount - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      const slotAngle =
        (i / Math.max(enemyCount, 1)) * Phaser.Math.PI2 +
        timeSeconds * ENEMY_CONFIG.attackRotateSpeed;
      const formationTarget = new Phaser.Math.Vector2(
        target.x + Math.cos(slotAngle) * ENEMY_CONFIG.attackRingRadius,
        target.y + Math.sin(slotAngle) * ENEMY_CONFIG.attackRingRadius,
      );

      const avoidance = this.computeEnemyAvoidance(i);
      enemy.update(target, targetVelocity, timeSeconds, formationTarget, avoidance);
      this.tryFireEnemyShot(enemy);
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
        const bothNearPlayer =
          ax * ax + ay * ay <= nearPlayerSq && bx * bx + by * by <= nearPlayerSq;
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

  private updateShieldPickup(): void {
    if (!this.shieldPickup && this.time.now >= this.nextShieldSpawnAt) {
      this.spawnShieldPickup();
    }

    if (this.shieldPickup && this.time.now >= this.shieldExpiresAt) {
      this.removeShieldPickup();
      this.scheduleNextShieldSpawn();
      return;
    }

    if (!this.shieldPickup) {
      return;
    }

    const pickedUp = Phaser.Geom.Intersects.RectangleToRectangle(
      this.player.sprite.getBounds(),
      this.shieldPickup.getBounds(),
    );

    if (!pickedUp) {
      return;
    }

    this.player.grantShield();
    this.removeShieldPickup();
    this.scheduleNextShieldSpawn();
  }

  private spawnShieldPickup(): void {
    const point = this.findSafeOpenPoint(PICKUP_CONFIG.shieldPadding);
    if (!point) {
      this.nextShieldSpawnAt = this.time.now + 1000;
      return;
    }

    const { x, y } = point;

    const tooCloseToPlayer =
      Phaser.Math.Distance.Between(x, y, this.player.sprite.x, this.player.sprite.y) <
      PLAYER_CONFIG.size * 3;

    if (tooCloseToPlayer) {
      this.nextShieldSpawnAt = this.time.now + 1000;
      return;
    }

    this.shieldPickup = this.add
      .image(x, y, 'shieldPickup')
      .setDepth(3);
    this.shieldExpiresAt = this.time.now + PICKUP_CONFIG.shieldLifetimeMs;
  }

  private scheduleNextShieldSpawn(): void {
    this.nextShieldSpawnAt =
      this.time.now +
      Phaser.Math.Between(PICKUP_CONFIG.shieldSpawnMinMs, PICKUP_CONFIG.shieldSpawnMaxMs);
  }

  private removeShieldPickup(): void {
    this.shieldPickup?.destroy();
    this.shieldPickup = undefined;
    this.shieldExpiresAt = 0;
  }

  private updateBurstPickup(): void {
    if (!this.burstPickup && this.time.now >= this.nextBurstSpawnAt) {
      this.spawnBurstPickup();
    }

    if (this.burstPickup && this.time.now >= this.burstExpiresAt) {
      this.removeBurstPickup();
      this.scheduleNextBurstSpawn();
      return;
    }

    if (!this.burstPickup) {
      return;
    }

    const pickedUp = Phaser.Geom.Intersects.RectangleToRectangle(
      this.player.sprite.getBounds(),
      this.burstPickup.getBounds(),
    );

    if (!pickedUp) {
      return;
    }

    this.player.grantBurstShot(this.time.now);
    this.removeBurstPickup();
    this.scheduleNextBurstSpawn();
  }

  private updateMinigunPickup(): void {
    if (!this.minigunPickup && this.time.now >= this.nextMinigunSpawnAt) {
      this.spawnMinigunPickup();
    }

    if (this.minigunPickup && this.time.now >= this.minigunExpiresAt) {
      this.removeMinigunPickup();
      this.scheduleNextMinigunSpawn();
      return;
    }

    if (!this.minigunPickup) {
      return;
    }

    const pickedUp = Phaser.Geom.Intersects.RectangleToRectangle(
      this.player.sprite.getBounds(),
      this.minigunPickup.getBounds(),
    );

    if (!pickedUp) {
      return;
    }

    this.player.grantMinigun(this.time.now);
    this.removeMinigunPickup();
    this.scheduleNextMinigunSpawn();
  }

  private updateLaserPickup(): void {
    if (!this.laserPickup && this.time.now >= this.nextLaserSpawnAt) {
      this.spawnLaserPickup();
    }

    if (this.laserPickup && this.time.now >= this.laserExpiresAt) {
      this.removeLaserPickup();
      this.scheduleNextLaserSpawn();
      return;
    }

    if (!this.laserPickup) {
      return;
    }

    const pickedUp = Phaser.Geom.Intersects.RectangleToRectangle(
      this.player.sprite.getBounds(),
      this.laserPickup.getBounds(),
    );

    if (!pickedUp) {
      return;
    }

    this.player.grantLaser(this.time.now);
    this.removeLaserPickup();
    this.scheduleNextLaserSpawn();
  }

  private spawnBurstPickup(): void {
    const point = this.findSafeOpenPoint(PICKUP_CONFIG.shieldPadding);
    if (!point) {
      this.nextBurstSpawnAt = this.time.now + 1000;
      return;
    }

    const { x, y } = point;

    const tooCloseToPlayer =
      Phaser.Math.Distance.Between(x, y, this.player.sprite.x, this.player.sprite.y) <
      PLAYER_CONFIG.size * 3;

    if (tooCloseToPlayer) {
      this.nextBurstSpawnAt = this.time.now + 1000;
      return;
    }

    this.burstPickup = this.add
      .image(x, y, 'burstPickup')
      .setDepth(3);
    this.burstExpiresAt = this.time.now + PICKUP_CONFIG.burstLifetimeMs;
  }

  private scheduleNextBurstSpawn(): void {
    this.nextBurstSpawnAt =
      this.time.now +
      Phaser.Math.Between(PICKUP_CONFIG.burstSpawnMinMs, PICKUP_CONFIG.burstSpawnMaxMs);
  }

  private removeBurstPickup(): void {
    this.burstPickup?.destroy();
    this.burstPickup = undefined;
    this.burstExpiresAt = 0;
  }

  private spawnMinigunPickup(): void {
    const point = this.findSafeOpenPoint(PICKUP_CONFIG.shieldPadding);
    if (!point) {
      this.nextMinigunSpawnAt = this.time.now + 1000;
      return;
    }

    const { x, y } = point;

    const tooCloseToPlayer =
      Phaser.Math.Distance.Between(x, y, this.player.sprite.x, this.player.sprite.y) <
      PLAYER_CONFIG.size * 3;

    if (tooCloseToPlayer) {
      this.nextMinigunSpawnAt = this.time.now + 1000;
      return;
    }

    this.minigunPickup = this.add
      .image(x, y, 'minigunPickup')
      .setDepth(3);
    this.minigunExpiresAt = this.time.now + PICKUP_CONFIG.minigunLifetimeMs;
  }

  private scheduleNextMinigunSpawn(): void {
    this.nextMinigunSpawnAt =
      this.time.now +
      Phaser.Math.Between(PICKUP_CONFIG.minigunSpawnMinMs, PICKUP_CONFIG.minigunSpawnMaxMs);
  }

  private removeMinigunPickup(): void {
    this.minigunPickup?.destroy();
    this.minigunPickup = undefined;
    this.minigunExpiresAt = 0;
  }

  private spawnLaserPickup(): void {
    const point = this.findSafeOpenPoint(PICKUP_CONFIG.shieldPadding);
    if (!point) {
      this.nextLaserSpawnAt = this.time.now + 1000;
      return;
    }

    const { x, y } = point;
    const tooCloseToPlayer =
      Phaser.Math.Distance.Between(x, y, this.player.sprite.x, this.player.sprite.y) <
      PLAYER_CONFIG.size * 3;

    if (tooCloseToPlayer) {
      this.nextLaserSpawnAt = this.time.now + 1000;
      return;
    }

    this.laserPickup = this.add.image(x, y, 'laserPickup').setDepth(3);
    this.laserExpiresAt = this.time.now + PICKUP_CONFIG.laserLifetimeMs;
  }

  private scheduleNextLaserSpawn(): void {
    this.nextLaserSpawnAt =
      this.time.now +
      Phaser.Math.Between(PICKUP_CONFIG.laserSpawnMinMs, PICKUP_CONFIG.laserSpawnMaxMs);
  }

  private removeLaserPickup(): void {
    this.laserPickup?.destroy();
    this.laserPickup = undefined;
    this.laserExpiresAt = 0;
  }

  private trySpawnDonutForWave(wave: number): void {
    if (wave % 2 !== 0 || this.donutPickup) {
      return;
    }

    const point = this.findSafeOpenPoint(PICKUP_CONFIG.shieldPadding);
    if (!point) {
      return;
    }

    const { x, y } = point;
    const tooCloseToPlayer =
      Phaser.Math.Distance.Between(x, y, this.player.sprite.x, this.player.sprite.y) <
      PLAYER_CONFIG.size * 3;

    if (tooCloseToPlayer) {
      return;
    }

    this.donutPickup = this.add.image(x, y, 'donutPickup').setDepth(3);
    this.donutExpiresAt = this.time.now + PICKUP_CONFIG.healthLifetimeMs;
  }

  private removeDonutPickup(): void {
    this.donutPickup?.destroy();
    this.donutPickup = undefined;
    this.donutExpiresAt = 0;
  }

  private spawnEnemyAtEdge(): void {
    const point = this.waveManager.getSpawnPosition(this.scale.width, this.scale.height);
    const currentWave = this.waveManager.getState().currentWave;
    const shouldSpawnSpecial = this.specialEnemyWave !== currentWave;
    const shouldSpawnBlitz =
      currentWave > 1 &&
      this.blitzEnemyWave !== currentWave &&
      Math.random() < ENEMY_CONFIG.blitzSpawnChance;
    const shouldSpawnArmored =
      !shouldSpawnBlitz && Math.random() < ENEMY_CONFIG.armoredSpawnChance;
    const enemy = new Enemy(
      this,
      point.x,
      point.y,
      shouldSpawnSpecial,
      shouldSpawnArmored,
      shouldSpawnBlitz,
    );
    this.enemies.push(enemy);
    this.enemyGroup.add(enemy.sprite);
    this.waveManager.onEnemySpawned();
    if (shouldSpawnSpecial) {
      this.specialEnemyWave = currentWave;
    }
    if (shouldSpawnBlitz) {
      this.blitzEnemyWave = currentWave;
    }
  }

  private shootToward(targetX: number, targetY: number): void {
    const hasMinigun = this.player.hasMinigun(this.time.now);
    const shootCooldown = hasMinigun
      ? PICKUP_CONFIG.minigunShootCooldownMs
      : BULLET_CONFIG.shootCooldownMs;

    if (this.time.now - this.lastShotAtMs < shootCooldown) {
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

    if (hasMinigun) {
      const spread = Phaser.Math.FloatBetween(
        -PICKUP_CONFIG.minigunSpreadRadians,
        PICKUP_CONFIG.minigunSpreadRadians,
      );
      this.spawnPlayerBullet(direction.rotate(spread));
    } else if (this.player.hasBurstShot(this.time.now)) {
      const centerIndex = Math.floor(PICKUP_CONFIG.burstShotsPerTap / 2);

      for (let i = 0; i < PICKUP_CONFIG.burstShotsPerTap; i += 1) {
        const spreadOffset = (i - centerIndex) * PICKUP_CONFIG.burstSpreadRadians;
        const burstDirection = direction.clone().rotate(spreadOffset);
        this.spawnPlayerBullet(burstDirection);
      }
    } else {
      this.spawnPlayerBullet(direction);
    }

    this.lastShotAtMs = this.time.now;
  }

  private spawnPlayerBullet(direction: Phaser.Math.Vector2): void {
    const spawnDistance = PLAYER_CONFIG.size / 2 + BULLET_CONFIG.size;
    const spawnX = this.player.sprite.x + direction.x * spawnDistance;
    const spawnY = this.player.sprite.y + direction.y * spawnDistance;
    const bullet = new Bullet(this, spawnX, spawnY, direction, this.time.now);
    this.bullets.push(bullet);
  }

  private updateLaserWeapon(): void {
    this.laserGraphics.clear();

    if (!this.player.hasLaser(this.time.now)) {
      return;
    }

    const angle = this.player.sprite.rotation - Math.PI / 2;
    const startDistance = PLAYER_CONFIG.size * 0.7;
    const startX = this.player.sprite.x + Math.cos(angle) * startDistance;
    const startY = this.player.sprite.y + Math.sin(angle) * startDistance;
    const endX = startX + Math.cos(angle) * PICKUP_CONFIG.laserLength;
    const endY = startY + Math.sin(angle) * PICKUP_CONFIG.laserLength;
    const line = new Phaser.Geom.Line(startX, startY, endX, endY);

    this.laserGraphics.lineStyle(PICKUP_CONFIG.laserWidth * 1.9, COLORS.laserGlow, 0.28);
    this.laserGraphics.strokeLineShape(line);
    this.laserGraphics.lineStyle(PICKUP_CONFIG.laserWidth, COLORS.laserGlow, 0.9);
    this.laserGraphics.strokeLineShape(line);
    this.laserGraphics.lineStyle(Math.max(3, PICKUP_CONFIG.laserWidth * 0.34), COLORS.laserCore, 1);
    this.laserGraphics.strokeLineShape(line);

    if (this.time.now - this.lastLaserTickAt < PICKUP_CONFIG.laserTickMs) {
      return;
    }

    this.lastLaserTickAt = this.time.now;

    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      const hit = this.isPointNearLine(
        enemy.sprite.x,
        enemy.sprite.y,
        line,
        Math.max(PICKUP_CONFIG.laserWidth * 0.5, ENEMY_CONFIG.size * 0.6),
      );

      if (!hit) {
        continue;
      }

      const destroyed = enemy.takeHit();
      if (destroyed) {
        this.destroyEnemyAt(i);
      }
    }
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

          const destroyed = enemy.takeHit();
          if (destroyed) {
            this.destroyEnemyAt(j);
          }
          break;
        }
      }
    }
  }

  private tryFireEnemyShot(enemy: Enemy): void {
    if (!enemy.canShoot(this.time.now)) {
      return;
    }

    const toPlayer = new Phaser.Math.Vector2(
      this.player.sprite.x - enemy.sprite.x,
      this.player.sprite.y - enemy.sprite.y,
    );
    const distanceSq = toPlayer.lengthSq();

    if (distanceSq > ENEMY_CONFIG.specialShotRange * ENEMY_CONFIG.specialShotRange) {
      return;
    }

    if (distanceSq < 0.001) {
      enemy.scheduleNextShot(this.time.now);
      return;
    }

    toPlayer.normalize();
    const spawnDistance =
      (ENEMY_CONFIG.size * (enemy.isSpecial || enemy.isBlitz ? 0.7 : 0.5)) + BULLET_CONFIG.size;

    if (enemy.isBlitz) {
      const centerIndex = Math.floor(ENEMY_CONFIG.blitzShotCount / 2);

      for (let i = 0; i < ENEMY_CONFIG.blitzShotCount; i += 1) {
        const spreadOffset = (i - centerIndex) * ENEMY_CONFIG.blitzShotSpreadRadians;
        const direction = toPlayer.clone().rotate(spreadOffset);
        const bullet = new Bullet(
          this,
          enemy.sprite.x + direction.x * spawnDistance,
          enemy.sprite.y + direction.y * spawnDistance,
          direction,
          this.time.now,
          'enemyBullet',
          BULLET_CONFIG.enemySpeed,
          BULLET_CONFIG.enemyMaxLifetimeMs,
        );
        this.enemyBullets.push(bullet);
      }
    } else {
      const bullet = new Bullet(
        this,
        enemy.sprite.x + toPlayer.x * spawnDistance,
        enemy.sprite.y + toPlayer.y * spawnDistance,
        toPlayer,
        this.time.now,
        'enemyBullet',
        BULLET_CONFIG.enemySpeed,
        BULLET_CONFIG.enemyMaxLifetimeMs,
      );
      this.enemyBullets.push(bullet);
    }

    enemy.scheduleNextShot(this.time.now);
  }

  private updateEnemyBullets(): void {
    for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.enemyBullets[i];

      if (bullet.isExpired(this.time.now)) {
        bullet.destroy();
        this.enemyBullets.splice(i, 1);
        continue;
      }

      const outOfBounds =
        bullet.sprite.x < -20 ||
        bullet.sprite.y < -20 ||
        bullet.sprite.x > this.scale.width + 20 ||
        bullet.sprite.y > this.scale.height + 20;
      if (outOfBounds) {
        bullet.destroy();
        this.enemyBullets.splice(i, 1);
        continue;
      }

      const hitPlayer = Phaser.Geom.Intersects.RectangleToRectangle(
        bullet.sprite.getBounds(),
        this.player.sprite.getBounds(),
      );
      if (!hitPlayer) {
        continue;
      }

      bullet.destroy();
      this.enemyBullets.splice(i, 1);

      const didTakeDamage = this.player.takeDamage(this.time.now, BULLET_CONFIG.enemyDamage);
      if (didTakeDamage && !this.player.isAlive()) {
        this.setGameOver();
        return;
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
    this.isPaused = false;
    this.scene.stop('PauseScene');
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
    this.shieldText = this.add.text(16, 44, '', style).setDepth(10);
    this.weaponText = this.add.text(16, 76, '', style).setDepth(10);
    this.waveText = this.add.text(16, 108, '', style).setDepth(10);
    this.remainingText = this.add.text(16, 140, '', style).setDepth(10);

    this.add
      .text(this.scale.width - 16, 12, 'ESC to Pause', {
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

    this.createLegend();
    this.updateHud();
  }

  private createLegend(): void {
    const entries = [
      { label: 'You', texture: 'player', scale: 0.78 },
      { label: 'Red enemy', texture: 'enemy', scale: 0.78 },
      { label: 'Orange shooter', texture: 'enemy', tint: ENEMY_CONFIG.specialTint, scale: 0.86 },
      { label: 'Purple armored', texture: 'enemy', tint: ENEMY_CONFIG.armoredTint, scale: 0.84 },
      { label: 'Cyan blitz', texture: 'enemy', tint: ENEMY_CONFIG.blitzTint, scale: 1 },
      { label: 'Shield', texture: 'shieldPickup', scale: 0.9 },
      { label: 'Burst', texture: 'burstPickup', scale: 0.88 },
      { label: 'Minigun', texture: 'minigunPickup', scale: 0.88 },
      { label: 'Laser', texture: 'laserPickup', scale: 0.88 },
      { label: 'Donut', texture: 'donutPickup', scale: 0.86 },
      { label: 'Lava', texture: 'lavaLegendIcon', scale: 0.9 },
      { label: 'Portal', texture: 'portalLegendIcon', scale: 0.9 },
    ];
    const panelWidth = 320;
    const rowHeight = 30;
    const columnWidth = 150;
    const columnCount = 2;
    const rowCount = Math.ceil(entries.length / columnCount);
    const panelHeight = 40 + rowCount * rowHeight + 12;

    const background = this.add
      .rectangle(0, 0, panelWidth, panelHeight, 0x0b1520, 0.78)
      .setOrigin(0)
      .setStrokeStyle(2, 0x89b9d6, 0.8);

    const title = this.add.text(14, 10, 'Legend', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: COLORS.uiText,
      stroke: COLORS.uiShadow,
      strokeThickness: 4,
    });

    const objects: Phaser.GameObjects.GameObject[] = [background, title];

    entries.forEach((entry, index) => {
      const column = Math.floor(index / rowCount);
      const row = index % rowCount;
      const baseX = 16 + column * columnWidth;
      const baseY = 44 + row * rowHeight;

      const icon = this.add
        .image(baseX, baseY + 10, entry.texture)
        .setOrigin(0, 0.5)
        .setScale(entry.scale)
        .setDepth(10);

      if (entry.tint !== undefined) {
        icon.setTint(entry.tint);
      }

      const label = this.add.text(baseX + 32, baseY, entry.label, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: COLORS.uiText,
        stroke: COLORS.uiShadow,
        strokeThickness: 3,
      });

      objects.push(icon, label);
    });

    this.legendContainer = this.add.container(0, 0, objects).setDepth(10);
    this.positionLegend();
  }

  private updateHud(): void {
    const waveState = this.waveManager.getState();
    const remaining = waveState.enemiesToSpawn + waveState.enemiesAlive;

    this.healthText.setText(`Health: ${this.player.getHealth()}/${PLAYER_CONFIG.maxHealth}`);
    this.shieldText.setText(`Shield: ${this.player.hasShield() ? 'READY' : 'NONE'}`);
    const weaponLabel = this.player.hasLaser(this.time.now)
      ? 'LASER'
      : this.player.hasMinigun(this.time.now)
      ? 'MINIGUN'
      : this.player.hasBurstShot(this.time.now)
        ? 'BURST'
        : 'NORMAL';
    this.weaponText.setText(`Weapon: ${weaponLabel}`);
    this.waveText.setText(`Wave: ${waveState.currentWave}`);

    if (waveState.inBreak) {
      this.remainingText.setText('Enemies: 0 (next wave soon...)');
    } else {
      this.remainingText.setText(`Enemies: ${remaining}`);
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

    for (const pool of this.lavaPools) {
      bg.fillStyle(COLORS.lavaOuter, 0.95);
      bg.fillCircle(pool.x, pool.y, pool.radius);
      bg.fillStyle(COLORS.lavaMid, 0.95);
      bg.fillCircle(pool.x, pool.y, pool.radius * 0.72);
      bg.fillStyle(COLORS.lavaInner, 0.95);
      bg.fillCircle(pool.x, pool.y, pool.radius * 0.38);
    }

    if (this.portal) {
      bg.fillStyle(COLORS.portalOuter, 0.95);
      bg.fillCircle(this.portal.x, this.portal.y, this.portal.radius);
      bg.fillStyle(COLORS.portalMid, 0.95);
      bg.fillCircle(this.portal.x, this.portal.y, this.portal.radius * 0.72);
      bg.fillStyle(COLORS.portalInner, 0.95);
      bg.fillCircle(this.portal.x, this.portal.y, this.portal.radius * 0.2);
    }
  }

  private onResize(width: number, height: number): void {
    this.physics.world.setBounds(0, 0, width, height);
    this.generateLavaPools();
    this.generatePortal();
    this.drawArenaBackground();
    this.gameOverText.setPosition(width / 2, height / 2);
    this.positionLegend();
  }

  private positionLegend(): void {
    if (!this.legendContainer) {
      return;
    }

    const bounds = this.legendContainer.getBounds();
    this.legendContainer.setPosition(this.scale.width - bounds.width - 16, 48);
  }

  private generateLavaPools(): void {
    this.lavaPools = [];

    for (let i = 0; i < HAZARD_CONFIG.poolCount; i += 1) {
      let placed = false;

      for (let attempt = 0; attempt < 80; attempt += 1) {
        const radius = Phaser.Math.Between(HAZARD_CONFIG.minRadius, HAZARD_CONFIG.maxRadius);
        const x = Phaser.Math.Between(
          HAZARD_CONFIG.edgePadding + radius,
          this.scale.width - HAZARD_CONFIG.edgePadding - radius,
        );
        const y = Phaser.Math.Between(
          HAZARD_CONFIG.edgePadding + radius,
          this.scale.height - HAZARD_CONFIG.edgePadding - radius,
        );

        const tooCloseToSpawn =
          Phaser.Math.Distance.Between(x, y, this.scale.width / 2, this.scale.height / 2) <
          radius + HAZARD_CONFIG.playerSpawnSafeRadius;
        if (tooCloseToSpawn) {
          continue;
        }

        const overlapsExisting = this.lavaPools.some((pool) => {
          const minGap = radius + pool.radius + 44;
          return Phaser.Math.Distance.Between(x, y, pool.x, pool.y) < minGap;
        });

        if (overlapsExisting) {
          continue;
        }

        this.lavaPools.push({ x, y, radius });
        placed = true;
        break;
      }

      if (!placed) {
        break;
      }
    }
  }

  private generatePortal(): void {
    this.portal = undefined;

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const radius = HAZARD_CONFIG.portalRadius;
      const x = Phaser.Math.Between(
        HAZARD_CONFIG.portalPadding + radius,
        this.scale.width - HAZARD_CONFIG.portalPadding - radius,
      );
      const y = Phaser.Math.Between(
        HAZARD_CONFIG.portalPadding + radius,
        this.scale.height - HAZARD_CONFIG.portalPadding - radius,
      );

      const tooCloseToSpawn =
        Phaser.Math.Distance.Between(x, y, this.scale.width / 2, this.scale.height / 2) <
        radius + HAZARD_CONFIG.playerSpawnSafeRadius;
      if (tooCloseToSpawn || this.isPointInLava(x, y, radius + 18)) {
        continue;
      }

      this.portal = { x, y, radius };
      return;
    }
  }

  private findSafeOpenPoint(
    padding: number,
    portalBuffer = 0,
  ): { x: number; y: number } | undefined {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const x = Phaser.Math.Between(padding, this.scale.width - padding);
      const y = Phaser.Math.Between(padding, this.scale.height - padding);

      if (this.isPointInLava(x, y, HAZARD_CONFIG.pickupSafeRadius)) {
        continue;
      }

       if (
        this.portal &&
        Phaser.Math.Distance.Between(x, y, this.portal.x, this.portal.y) <=
          this.portal.radius + portalBuffer
      ) {
        continue;
      }

      return { x, y };
    }

    return undefined;
  }

  private isPointInLava(x: number, y: number, extraRadius = 0): boolean {
    return this.lavaPools.some((pool) => {
      const safeRadius = pool.radius + extraRadius;
      return Phaser.Math.Distance.Between(x, y, pool.x, pool.y) <= safeRadius;
    });
  }

  private isPointNearLine(
    x: number,
    y: number,
    line: Phaser.Geom.Line,
    radius: number,
  ): boolean {
    const distance = Phaser.Math.Distance.BetweenPoints(
      { x, y },
      Phaser.Geom.Line.GetNearestPoint(line, { x, y }),
    );
    return distance <= radius;
  }

  private openPauseMenu(): void {
    if (this.isPaused) {
      return;
    }

    this.isPaused = true;
    this.scene.launch('PauseScene');
    this.scene.pause();
  }

  resumeFromPause(): void {
    this.isPaused = false;
    this.scene.stop('PauseScene');
    this.scene.resume();
  }

  restartRun(): void {
    this.isPaused = false;
    this.gameOver = false;
    this.scene.stop('PauseScene');
    this.scene.restart();
  }

  returnToTitle(): void {
    this.isPaused = false;
    this.gameOver = false;
    this.scene.stop('PauseScene');
    this.scene.start('TitleScene');
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

    g.clear();
    g.fillStyle(ENEMY_CONFIG.specialTint, 1);
    g.fillCircle(BULLET_CONFIG.size / 2, BULLET_CONFIG.size / 2, BULLET_CONFIG.size / 2 - 1);
    g.generateTexture('enemyBullet', BULLET_CONFIG.size, BULLET_CONFIG.size);

    g.clear();
    g.lineStyle(3, COLORS.shield, 1);
    g.strokeCircle(
      PICKUP_CONFIG.shieldSize / 2,
      PICKUP_CONFIG.shieldSize / 2,
      PICKUP_CONFIG.shieldSize / 2 - 3,
    );
    g.fillStyle(COLORS.shield, 0.2);
    g.fillCircle(
      PICKUP_CONFIG.shieldSize / 2,
      PICKUP_CONFIG.shieldSize / 2,
      PICKUP_CONFIG.shieldSize / 2 - 5,
    );
    g.generateTexture('shieldPickup', PICKUP_CONFIG.shieldSize, PICKUP_CONFIG.shieldSize);

    g.clear();
    g.fillStyle(COLORS.burst, 1);
    g.fillCircle(
      PICKUP_CONFIG.burstSize / 2,
      PICKUP_CONFIG.burstSize / 2,
      PICKUP_CONFIG.burstSize / 2 - 2,
    );
    g.fillStyle(0x3b2f14, 1);
    g.fillCircle(PICKUP_CONFIG.burstSize / 2, PICKUP_CONFIG.burstSize / 2 - 5, 2);
    g.fillCircle(PICKUP_CONFIG.burstSize / 2 - 6, PICKUP_CONFIG.burstSize / 2 + 4, 2);
    g.fillCircle(PICKUP_CONFIG.burstSize / 2 + 6, PICKUP_CONFIG.burstSize / 2 + 4, 2);
    g.generateTexture('burstPickup', PICKUP_CONFIG.burstSize, PICKUP_CONFIG.burstSize);

    g.clear();
    g.fillStyle(COLORS.minigun, 1);
    g.fillRoundedRect(2, 7, PICKUP_CONFIG.minigunSize - 4, PICKUP_CONFIG.minigunSize - 14, 6);
    g.fillStyle(0x173126, 1);
    g.fillRect(8, Math.floor(PICKUP_CONFIG.minigunSize / 2) - 2, PICKUP_CONFIG.minigunSize - 7, 4);
    g.fillRect(PICKUP_CONFIG.minigunSize - 8, Math.floor(PICKUP_CONFIG.minigunSize / 2) - 5, 3, 10);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(7, Math.floor(PICKUP_CONFIG.minigunSize / 2), 2);
    g.generateTexture('minigunPickup', PICKUP_CONFIG.minigunSize, PICKUP_CONFIG.minigunSize);

    g.clear();
    g.fillStyle(COLORS.laserGlow, 1);
    g.fillCircle(PICKUP_CONFIG.laserSize / 2, PICKUP_CONFIG.laserSize / 2, PICKUP_CONFIG.laserSize / 2 - 2);
    g.lineStyle(4, COLORS.laserCore, 1);
    g.beginPath();
    g.moveTo(6, PICKUP_CONFIG.laserSize - 6);
    g.lineTo(PICKUP_CONFIG.laserSize - 6, 6);
    g.strokePath();
    g.generateTexture('laserPickup', PICKUP_CONFIG.laserSize, PICKUP_CONFIG.laserSize);

    g.clear();
    g.fillStyle(COLORS.donut, 1);
    g.fillCircle(
      PICKUP_CONFIG.healthSize / 2,
      PICKUP_CONFIG.healthSize / 2,
      PICKUP_CONFIG.healthSize / 2 - 1,
    );
    g.fillStyle(COLORS.donutIcing, 1);
    g.fillCircle(
      PICKUP_CONFIG.healthSize / 2,
      PICKUP_CONFIG.healthSize / 2 - 1,
      PICKUP_CONFIG.healthSize / 2 - 5,
    );
    g.fillStyle(COLORS.arenaBg, 1);
    g.fillCircle(
      PICKUP_CONFIG.healthSize / 2,
      PICKUP_CONFIG.healthSize / 2,
      Math.floor(PICKUP_CONFIG.healthSize * 0.2),
    );
    g.generateTexture('donutPickup', PICKUP_CONFIG.healthSize, PICKUP_CONFIG.healthSize);

    g.clear();
    g.fillStyle(COLORS.lavaOuter, 1);
    g.fillCircle(12, 12, 11);
    g.fillStyle(COLORS.lavaMid, 1);
    g.fillCircle(12, 12, 8);
    g.fillStyle(COLORS.lavaInner, 1);
    g.fillCircle(12, 12, 4);
    g.generateTexture('lavaLegendIcon', 24, 24);

    g.fillStyle(COLORS.portalOuter, 1);
    g.fillCircle(12, 12, 11);
    g.fillStyle(COLORS.portalMid, 1);
    g.fillCircle(12, 12, 8);
    g.fillStyle(COLORS.portalInner, 1);
    g.fillCircle(12, 12, 3);
    g.generateTexture('portalLegendIcon', 24, 24);

    g.destroy();
  }

  private clearBullets(): void {
    for (const bullet of this.bullets) {
      bullet.destroy();
    }
    this.bullets = [];

    for (const bullet of this.enemyBullets) {
      bullet.destroy();
    }
    this.enemyBullets = [];
    this.removeShieldPickup();
    this.removeBurstPickup();
    this.removeMinigunPickup();
    this.removeLaserPickup();
    this.removeDonutPickup();
    this.laserGraphics.clear();
  }

  private destroyEnemyAt(index: number): void {
    const enemy = this.enemies[index];
    this.enemyGroup.remove(enemy.sprite, false, false);
    enemy.destroy();
    this.enemies.splice(index, 1);
    this.waveManager.onEnemyDefeated(this);
  }
}
