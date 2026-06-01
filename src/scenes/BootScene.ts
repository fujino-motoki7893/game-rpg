import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    this.createTile("tile-grass", "#3f8f5b", "#2f7447");
    this.createTile("tile-tall-grass", "#4a9d4f", "#2c7139", true);
    this.createTile("tile-path", "#b78c58", "#8f6b3e");
    this.createTile("tile-water", "#2c7fb8", "#175c8d", true);
    this.createTile("tile-house", "#86533d", "#5e382c");
    this.createTile("tile-tree", "#1f5e38", "#153f2a", true);
    this.createTile("tile-rock", "#58606b", "#3c424a", true);
    this.createTile("tile-cave", "#312c35", "#1c1920");
    this.createTile("tile-floor", "#6a5d48", "#423b31");
    this.createTile("tile-portal", "#614c9a", "#d9cfff", true);
    this.createTile("tile-chest", "#6f4628", "#d9a441");

    this.createHero("player", "#2c5d9e", "#f2d2a9", "#ead45e");
    this.createHero("npc-elder", "#70563f", "#f2d2a9", "#d5d0c8");
    this.createHero("npc-healer", "#8f3d67", "#f2d2a9", "#f2f4ff");
    this.createCreature("enemy-slime", "#69c36d", "#2a7138", "slime");
    this.createCreature("enemy-goblin", "#748c3d", "#3f5220", "goblin");
    this.createCreature("enemy-guardian", "#a14f3d", "#4b2825", "guardian");
    this.createChest("chest-closed", false);
    this.createChest("chest-open", true);

    this.scene.start("WorldScene");
  }

  private createTile(
    key: string,
    baseColor: string,
    shadeColor: string,
    extraPattern = false
  ): void {
    const texture = this.textures.createCanvas(key, 32, 32);
    if (!texture) {
      return;
    }

    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = shadeColor;
    ctx.fillRect(0, 28, 32, 4);
    ctx.fillRect(28, 0, 4, 32);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(2, 2, 8, 3);
    ctx.fillRect(17, 13, 10, 3);
    ctx.globalAlpha = 1;

    if (extraPattern) {
      ctx.strokeStyle = shadeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(7, 25);
      ctx.lineTo(12, 11);
      ctx.moveTo(17, 26);
      ctx.lineTo(22, 8);
      ctx.stroke();
    }

    texture.refresh();
  }

  private createHero(key: string, cloak: string, skin: string, accent: string): void {
    const texture = this.textures.createCanvas(key, 32, 32);
    if (!texture) {
      return;
    }

    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(8, 27, 16, 3);
    ctx.fillStyle = cloak;
    ctx.fillRect(9, 13, 14, 14);
    ctx.fillStyle = accent;
    ctx.fillRect(12, 18, 8, 3);
    ctx.fillStyle = skin;
    ctx.fillRect(10, 6, 12, 10);
    ctx.fillStyle = "#2b1d18";
    ctx.fillRect(10, 5, 12, 3);
    ctx.fillStyle = "#151515";
    ctx.fillRect(13, 10, 2, 2);
    ctx.fillRect(18, 10, 2, 2);
    texture.refresh();
  }

  private createCreature(
    key: string,
    baseColor: string,
    shadeColor: string,
    type: "slime" | "goblin" | "guardian"
  ): void {
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

    if (type === "slime") {
      ctx.beginPath();
      ctx.ellipse(16, 20, 12, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shadeColor;
      ctx.fillRect(10, 22, 12, 2);
    } else {
      ctx.fillRect(8, 11, 16, 16);
      ctx.fillStyle = shadeColor;
      ctx.fillRect(6, 9, 7, 5);
      ctx.fillRect(19, 9, 7, 5);
      if (type === "guardian") {
        ctx.fillStyle = "#f0c14b";
        ctx.fillRect(10, 6, 12, 4);
      }
    }

    ctx.fillStyle = "#111111";
    ctx.fillRect(12, 16, 3, 3);
    ctx.fillRect(19, 16, 3, 3);
    texture.refresh();
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
