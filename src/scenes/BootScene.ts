import Phaser from "phaser";
import {
  CHARACTER_DIRECTION_ROWS,
  CHARACTER_DIRECTIONS,
  CHARACTER_SPRITES,
  getCharacterIdleAnimationKey,
  getCharacterWalkAnimationKey
} from "../data/characterSprites";

type CreatureType =
  | "slime"
  | "goblin"
  | "bat"
  | "skeleton"
  | "wolf"
  | "mage"
  | "mimic"
  | "guardian";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    CHARACTER_SPRITES.forEach((sprite) => {
      this.load.spritesheet(sprite.key, sprite.path, {
        frameWidth: sprite.frameWidth,
        frameHeight: sprite.frameHeight,
        endFrame: 15
      });
    });
  }

  create(): void {
    this.createTile("tile-grass", "#3f8f5b", "#2f7447", "grass");
    this.createTile("tile-tall-grass", "#4a9d4f", "#2c7139", "tallGrass");
    this.createTile("tile-path", "#b78c58", "#8f6b3e", "path");
    this.createTile("tile-water", "#2c7fb8", "#175c8d", "water");
    this.createTile("tile-house", "#86533d", "#5e382c", "house");
    this.createTile("tile-tree", "#1f5e38", "#153f2a", "tree");
    this.createTile("tile-rock", "#58606b", "#3c424a", "rock");
    this.createTile("tile-cave", "#312c35", "#1c1920", "cave");
    this.createTile("tile-floor", "#6a5d48", "#423b31", "floor");
    this.createTile("tile-portal", "#614c9a", "#d9cfff", "portal");
    this.createTile("tile-stairs-up", "#6a5d48", "#423b31", "stairsUp");
    this.createTile("tile-stairs-down", "#6a5d48", "#423b31", "stairsDown");
    this.createTile("tile-chest", "#6f4628", "#d9a441", "chest");

    this.createHero("player", "#2c5d9e", "#f2d2a9", "#ead45e");
    this.createHero("npc-elder", "#70563f", "#f2d2a9", "#d5d0c8");
    this.createHero("npc-healer", "#8f3d67", "#f2d2a9", "#f2f4ff");
    this.createHero("npc-shopkeeper", "#8a663e", "#f2d2a9", "#f0c14b");
    this.createHero("npc-armorer", "#4d6178", "#f2d2a9", "#c7d2da");
    this.createCreature("enemy-slime", "#69c36d", "#2a7138", "slime");
    this.createCreature("enemy-goblin", "#748c3d", "#3f5220", "goblin");
    this.createCreature("enemy-bat", "#4b4a72", "#252640", "bat");
    this.createCreature("enemy-skeleton", "#d2c8a8", "#6d6757", "skeleton");
    this.createCreature("enemy-wolf", "#7c7f86", "#3f444c", "wolf");
    this.createCreature("enemy-mage", "#6e4fa3", "#2f244d", "mage");
    this.createCreature("enemy-mimic", "#9a552f", "#3a2115", "mimic");
    this.createCreature("enemy-guardian", "#a14f3d", "#4b2825", "guardian");
    this.createCharacterAnimations();
    this.createChest("chest-closed", false);
    this.createChest("chest-open", true);

    this.scene.start("WorldScene");
  }

  private createTile(
    key: string,
    baseColor: string,
    shadeColor: string,
    pattern:
      | "grass"
      | "tallGrass"
      | "path"
      | "water"
      | "house"
      | "tree"
      | "rock"
      | "cave"
      | "floor"
      | "portal"
      | "stairsUp"
      | "stairsDown"
      | "chest"
  ): void {
    const texture = this.textures.createCanvas(key, 32, 32);
    if (!texture) {
      return;
    }

    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 32, 32);

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(0, 0, 32, 2);
    ctx.fillRect(0, 0, 2, 32);
    ctx.fillStyle = shadeColor;
    ctx.fillRect(0, 29, 32, 3);
    ctx.fillRect(29, 0, 3, 32);

    switch (pattern) {
      case "grass":
        this.drawGrass(ctx, shadeColor, "#6dbb6f", false);
        break;
      case "tallGrass":
        this.drawGrass(ctx, shadeColor, "#77c85e", true);
        break;
      case "path":
        this.drawPebbles(ctx, shadeColor, "#d0a26a");
        break;
      case "water":
        this.drawWater(ctx, shadeColor, "#60b7dc");
        break;
      case "house":
        this.drawPlanks(ctx, shadeColor, "#9f674c");
        break;
      case "tree":
        this.drawLeaves(ctx, shadeColor, "#2e7a49");
        break;
      case "rock":
        this.drawRock(ctx, shadeColor, "#727b86");
        break;
      case "cave":
        this.drawDungeonStone(ctx, shadeColor, "#4a4250");
        break;
      case "floor":
        this.drawDungeonFloor(ctx, shadeColor, "#7c6f56");
        break;
      case "portal":
        this.drawPortal(ctx, shadeColor);
        break;
      case "stairsUp":
        this.drawStairs(ctx, shadeColor, "#d6b56a", true);
        break;
      case "stairsDown":
        this.drawStairs(ctx, shadeColor, "#d6b56a", false);
        break;
      case "chest":
        this.drawPlanks(ctx, shadeColor, "#a16230");
        break;
    }

    texture.refresh();
  }

  private drawGrass(
    ctx: CanvasRenderingContext2D,
    shadeColor: string,
    highlightColor: string,
    tall: boolean
  ): void {
    ctx.strokeStyle = shadeColor;
    ctx.lineWidth = 1;
    const blades = tall
      ? [
          [6, 26, 9, 14],
          [12, 27, 16, 11],
          [22, 26, 25, 10],
          [27, 26, 29, 16]
        ]
      : [
          [8, 25, 10, 20],
          [18, 23, 20, 18],
          [26, 25, 27, 21]
        ];
    blades.forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
    ctx.fillStyle = highlightColor;
    ctx.globalAlpha = 0.34;
    ctx.fillRect(4, 5, 6, 2);
    ctx.fillRect(17, 12, 8, 2);
    ctx.globalAlpha = 1;
  }

  private drawPebbles(ctx: CanvasRenderingContext2D, shadeColor: string, highlightColor: string): void {
    ctx.fillStyle = shadeColor;
    ctx.globalAlpha = 0.42;
    ctx.fillRect(7, 8, 5, 3);
    ctx.fillRect(22, 19, 4, 3);
    ctx.fillRect(13, 25, 8, 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = highlightColor;
    ctx.fillRect(4, 4, 9, 2);
    ctx.fillRect(17, 13, 7, 2);
  }

  private drawWater(ctx: CanvasRenderingContext2D, shadeColor: string, highlightColor: string): void {
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = 2;
    [[4, 9], [15, 18], [22, 7]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 5, y - 2);
      ctx.lineTo(x + 10, y);
      ctx.stroke();
    });
    ctx.strokeStyle = shadeColor;
    ctx.beginPath();
    ctx.moveTo(5, 26);
    ctx.lineTo(15, 24);
    ctx.lineTo(24, 26);
    ctx.stroke();
  }

  private drawPlanks(ctx: CanvasRenderingContext2D, shadeColor: string, highlightColor: string): void {
    ctx.strokeStyle = shadeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(10, 32);
    ctx.moveTo(21, 0);
    ctx.lineTo(21, 32);
    ctx.stroke();
    ctx.fillStyle = highlightColor;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(3, 6, 7, 2);
    ctx.fillRect(13, 17, 7, 2);
    ctx.fillRect(23, 9, 5, 2);
    ctx.globalAlpha = 1;
  }

  private drawLeaves(ctx: CanvasRenderingContext2D, shadeColor: string, highlightColor: string): void {
    ctx.fillStyle = shadeColor;
    ctx.fillRect(4, 18, 8, 7);
    ctx.fillRect(19, 6, 8, 8);
    ctx.fillStyle = highlightColor;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(7, 7, 9, 5);
    ctx.fillRect(15, 18, 8, 4);
    ctx.globalAlpha = 1;
  }

  private drawRock(ctx: CanvasRenderingContext2D, shadeColor: string, highlightColor: string): void {
    ctx.strokeStyle = shadeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 24);
    ctx.lineTo(13, 15);
    ctx.lineTo(20, 19);
    ctx.lineTo(27, 9);
    ctx.stroke();
    ctx.fillStyle = highlightColor;
    ctx.globalAlpha = 0.28;
    ctx.fillRect(6, 6, 10, 3);
    ctx.fillRect(17, 22, 8, 2);
    ctx.globalAlpha = 1;
  }

  private drawDungeonStone(ctx: CanvasRenderingContext2D, shadeColor: string, highlightColor: string): void {
    ctx.strokeStyle = shadeColor;
    ctx.lineWidth = 1;
    [8, 18, 28].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(32, y);
      ctx.stroke();
    });
    ctx.fillStyle = highlightColor;
    ctx.globalAlpha = 0.22;
    ctx.fillRect(3, 4, 10, 2);
    ctx.fillRect(19, 20, 8, 2);
    ctx.globalAlpha = 1;
  }

  private drawDungeonFloor(ctx: CanvasRenderingContext2D, shadeColor: string, highlightColor: string): void {
    ctx.strokeStyle = shadeColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(32, 12);
    ctx.moveTo(0, 24);
    ctx.lineTo(32, 24);
    ctx.moveTo(15, 0);
    ctx.lineTo(15, 12);
    ctx.moveTo(7, 12);
    ctx.lineTo(7, 24);
    ctx.moveTo(24, 24);
    ctx.lineTo(24, 32);
    ctx.stroke();
    ctx.fillStyle = highlightColor;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(4, 4, 8, 2);
    ctx.fillRect(18, 16, 8, 2);
    ctx.globalAlpha = 1;
  }

  private drawPortal(ctx: CanvasRenderingContext2D, shadeColor: string): void {
    ctx.fillStyle = shadeColor;
    ctx.globalAlpha = 0.48;
    ctx.fillRect(7, 7, 18, 18);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#f0e6ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 23);
    ctx.bezierCurveTo(17, 7, 23, 25, 13, 11);
    ctx.stroke();
  }

  private drawStairs(
    ctx: CanvasRenderingContext2D,
    shadeColor: string,
    highlightColor: string,
    up: boolean
  ): void {
    this.drawDungeonFloor(ctx, shadeColor, "#7c6f56");
    const steps = up ? [20, 16, 12, 8] : [8, 12, 16, 20];
    ctx.fillStyle = "#211c1a";
    steps.forEach((y, index) => {
      const inset = 5 + index * 2;
      ctx.fillRect(inset, y, 22 - index * 4, 3);
    });
    ctx.fillStyle = highlightColor;
    ctx.globalAlpha = 0.58;
    ctx.fillRect(8, up ? 18 : 6, 16, 2);
    ctx.globalAlpha = 1;
  }

  private createHero(key: string, cloak: string, skin: string, accent: string): void {
    if (this.textures.exists(key)) {
      return;
    }

    const texture = this.textures.createCanvas(key, 32, 32);
    if (!texture) {
      return;
    }

    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(7, 27, 18, 3);
    ctx.fillStyle = "#1a2026";
    ctx.fillRect(8, 12, 16, 16);
    ctx.fillStyle = cloak;
    ctx.fillRect(9, 13, 14, 14);
    ctx.fillStyle = accent;
    ctx.fillRect(12, 18, 8, 3);
    ctx.fillRect(10, 25, 4, 3);
    ctx.fillRect(19, 25, 4, 3);
    ctx.fillStyle = skin;
    ctx.fillRect(10, 6, 12, 10);
    ctx.fillStyle = "#2b1d18";
    ctx.fillRect(10, 5, 12, 3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(11, 14, 4, 2);
    ctx.fillStyle = "#151515";
    ctx.fillRect(13, 10, 2, 2);
    ctx.fillRect(18, 10, 2, 2);
    texture.refresh();
  }

  private createCreature(
    key: string,
    baseColor: string,
    shadeColor: string,
    type: CreatureType
  ): void {
    if (this.textures.exists(key)) {
      return;
    }

    const texture = this.textures.createCanvas(key, 32, 32);
    if (!texture) {
      return;
    }

    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.fillRect(7, 27, 18, 3);
    ctx.fillStyle = baseColor;

    switch (type) {
      case "slime":
        ctx.beginPath();
        ctx.ellipse(16, 20, 12, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shadeColor;
        ctx.fillRect(10, 22, 12, 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.fillRect(10, 15, 7, 2);
        this.drawCreatureEyes(ctx, 12, 16);
        break;
      case "bat":
        ctx.fillStyle = shadeColor;
        ctx.beginPath();
        ctx.moveTo(4, 18);
        ctx.lineTo(13, 11);
        ctx.lineTo(16, 19);
        ctx.lineTo(19, 11);
        ctx.lineTo(28, 18);
        ctx.lineTo(21, 23);
        ctx.lineTo(16, 20);
        ctx.lineTo(11, 23);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = baseColor;
        ctx.fillRect(12, 13, 8, 10);
        this.drawCreatureEyes(ctx, 12, 16);
        break;
      case "skeleton":
        ctx.fillStyle = shadeColor;
        ctx.fillRect(10, 19, 12, 8);
        ctx.fillStyle = baseColor;
        ctx.fillRect(9, 8, 14, 12);
        ctx.fillRect(12, 21, 3, 6);
        ctx.fillRect(18, 21, 3, 6);
        ctx.fillStyle = "#2b2824";
        ctx.fillRect(12, 13, 3, 3);
        ctx.fillRect(18, 13, 3, 3);
        ctx.fillRect(15, 17, 3, 2);
        break;
      case "wolf":
        ctx.fillStyle = "#1a1616";
        ctx.fillRect(7, 13, 18, 14);
        ctx.fillStyle = baseColor;
        ctx.fillRect(8, 14, 16, 13);
        ctx.fillStyle = shadeColor;
        ctx.fillRect(8, 9, 5, 6);
        ctx.fillRect(20, 9, 5, 6);
        ctx.fillRect(17, 19, 7, 3);
        ctx.fillStyle = "#e5dfd2";
        ctx.fillRect(20, 22, 3, 2);
        this.drawCreatureEyes(ctx, 11, 16);
        break;
      case "mage":
        ctx.fillStyle = "#1a1616";
        ctx.fillRect(8, 12, 16, 16);
        ctx.fillStyle = baseColor;
        ctx.fillRect(9, 13, 14, 15);
        ctx.fillStyle = shadeColor;
        ctx.fillRect(10, 6, 12, 8);
        ctx.fillStyle = "#86d9ff";
        ctx.fillRect(14, 18, 5, 5);
        this.drawCreatureEyes(ctx, 12, 16);
        break;
      case "mimic":
        ctx.fillStyle = "#1a1616";
        ctx.fillRect(6, 12, 20, 14);
        ctx.fillStyle = baseColor;
        ctx.fillRect(7, 13, 18, 12);
        ctx.fillStyle = "#d5a33f";
        ctx.fillRect(7, 13, 18, 3);
        ctx.fillRect(15, 13, 3, 12);
        ctx.fillStyle = "#f1ead8";
        ctx.fillRect(10, 18, 3, 3);
        ctx.fillRect(19, 18, 3, 3);
        ctx.fillStyle = "#111111";
        ctx.fillRect(12, 15, 2, 2);
        ctx.fillRect(19, 15, 2, 2);
        break;
      case "goblin":
      case "guardian":
        ctx.fillStyle = "#1a1616";
        ctx.fillRect(7, 10, 18, 18);
        ctx.fillStyle = baseColor;
        ctx.fillRect(8, 11, 16, 16);
        ctx.fillStyle = shadeColor;
        ctx.fillRect(6, 9, 7, 5);
        ctx.fillRect(19, 9, 7, 5);
        if (type === "guardian") {
          ctx.fillStyle = "#f0c14b";
          ctx.fillRect(10, 6, 12, 4);
          ctx.fillStyle = "#f4d977";
          ctx.fillRect(12, 4, 8, 2);
        }
        this.drawCreatureEyes(ctx, 12, 16);
        break;
    }
    texture.refresh();
  }

  private createCharacterAnimations(): void {
    CHARACTER_SPRITES.forEach((sprite) => {
      if (!this.hasSpriteFrame(sprite.key, 15)) {
        return;
      }

      CHARACTER_DIRECTIONS.forEach((direction) => {
        const start = CHARACTER_DIRECTION_ROWS[direction] * 4;
        this.createAnimationIfMissing(getCharacterIdleAnimationKey(sprite.key, direction), sprite.key, [
          start,
          start + 1,
          start,
          start + 2
        ], 3);
        this.createAnimationIfMissing(getCharacterWalkAnimationKey(sprite.key, direction), sprite.key, [
          start,
          start + 1,
          start + 2,
          start + 3
        ], 7);
      });
    });
  }

  private createAnimationIfMissing(
    key: string,
    textureKey: string,
    frames: number[],
    frameRate: number
  ): void {
    if (this.anims.exists(key)) {
      return;
    }

    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(textureKey, { frames }),
      frameRate,
      repeat: -1
    });
  }

  private hasSpriteFrame(key: string, frame: number): boolean {
    const texture = this.textures.get(key);
    return Boolean((texture.frames as Record<string, unknown>)[String(frame)]);
  }

  private drawCreatureEyes(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = "#111111";
    ctx.fillRect(x, y, 3, 3);
    ctx.fillRect(x + 7, y, 3, 3);
  }

  private createChest(key: string, open: boolean): void {
    const texture = this.textures.createCanvas(key, 32, 32);
    if (!texture) {
      return;
    }

    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(6, 26, 20, 3);
    ctx.fillStyle = "#2c1d14";
    ctx.fillRect(6, open ? 14 : 10, 20, open ? 12 : 16);
    ctx.fillStyle = "#75421f";
    ctx.fillRect(7, open ? 15 : 11, 18, open ? 10 : 15);
    ctx.fillStyle = "#d7a640";
    ctx.fillRect(7, open ? 15 : 11, 18, 3);
    ctx.fillRect(15, open ? 15 : 11, 3, 14);
    if (open) {
      ctx.fillStyle = "#f7e17d";
      ctx.fillRect(10, 9, 14, 4);
    }
    texture.refresh();
  }
}
