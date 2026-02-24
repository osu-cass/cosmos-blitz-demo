import Phaser from 'phaser';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.add
      .text(width / 2, height * 0.38, 'COSMO BLITZ DX', {
        fontFamily: 'Arial',
        fontSize: '72px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.52, 'Survive the waves', {
        fontFamily: 'Arial',
        fontSize: '34px',
        color: '#d0efff',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.67, 'Press any key to start', {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#fff08a',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.input.keyboard?.once('keydown', () => {
      this.scene.start('GameScene');
    });
  }
}
