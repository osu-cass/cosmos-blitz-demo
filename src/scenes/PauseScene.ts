import Phaser from 'phaser';
import { COLORS } from '../config/constants';
import { GameScene } from './GameScene';

export class PauseScene extends Phaser.Scene {
  private backdrop!: Phaser.GameObjects.Rectangle;
  private panel!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private buttons: Array<{
    box: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
    yFactor: number;
  }> = [];

  constructor() {
    super('PauseScene');
  }

  create(): void {
    const { width, height } = this.scale;

    this.backdrop = this.add
      .rectangle(width / 2, height / 2, width, height, 0x081018, 0.72)
      .setDepth(100);

    this.panel = this.add
      .rectangle(width / 2, height / 2, Math.min(width * 0.45, 420), 210, 0x1f2f3a, 0.96)
      .setStrokeStyle(4, 0x8fe9ff)
      .setDepth(101);

    this.titleText = this.add
      .text(width / 2, height * 0.35, 'PAUSED', {
        fontFamily: 'Arial',
        fontSize: '52px',
        color: COLORS.uiText,
        stroke: COLORS.uiShadow,
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(102);

    this.hintText = this.add
      .text(width / 2, height * 0.43, 'Press ESC to jump back in', {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#d7f8ff',
        stroke: COLORS.uiShadow,
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(102);

    this.buttons = [
      this.createButton('Resume', 0.53, () => this.resumeGame()),
    ];

    this.input.keyboard?.on('keydown-ESC', this.resumeGame, this);
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.layout(gameSize.width, gameSize.height);
    });

    this.layout(width, height);
  }

  private createButton(
    label: string,
    yFactor: number,
    onClick: () => void,
  ): { box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; yFactor: number } {
    const box = this.add
      .rectangle(0, 0, 240, 48, 0x355162, 1)
      .setStrokeStyle(3, 0xa5f4ff)
      .setInteractive({ useHandCursor: true })
      .setDepth(102);

    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        stroke: COLORS.uiShadow,
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(103);

    box.on('pointerover', () => {
      box.setFillStyle(0x43667b, 1);
    });

    box.on('pointerout', () => {
      box.setFillStyle(0x355162, 1);
    });

    box.on('pointerdown', onClick);

    return { box, label: text, yFactor };
  }

  private layout(width: number, height: number): void {
    this.backdrop.setPosition(width / 2, height / 2).setSize(width, height);
    this.panel
      .setPosition(width / 2, height / 2)
      .setSize(Math.min(width * 0.45, 420), Math.min(height * 0.36, 210));
    this.titleText.setPosition(width / 2, height * 0.35);
    this.hintText.setPosition(width / 2, height * 0.43);

    for (const button of this.buttons) {
      const y = height * button.yFactor;
      button.box.setPosition(width / 2, y);
      button.label.setPosition(width / 2, y);
    }
  }

  private resumeGame(): void {
    const gameScene = this.scene.get('GameScene') as GameScene;
    gameScene.resumeFromPause();
  }
}
