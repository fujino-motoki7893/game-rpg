import Phaser from "phaser";

const EPILOGUE_LINES: string[] = [
  "月蝕の魔獣は光の粒となって消え、谷に静寂が戻った。",
  "村長ローアン: 太陽石、月影石、そして今日の勇気。ストーンブルックは、幾度となくおぬしたちに救われたな。",
  "ルナ: でも……この谷の外にも、まだ知られざる脅威が眠っているような気がします。",
  "ルナ: これから先も、隣を歩かせてくださいね。私たちの冒険は、まだ終わっていませんから。",
  "こうして、ストーンブルックの谷に穏やかな夜が戻った。だが、これは物語の終わりではない。",
  "- 冒険の始まり -"
];

export class EndingScene extends Phaser.Scene {
  private lineText?: Phaser.GameObjects.Text;
  private promptText?: Phaser.GameObjects.Text;
  private index = 0;

  constructor() {
    super("EndingScene");
  }

  create(): void {
    this.index = 0;

    this.add.rectangle(400, 320, 800, 640, 0x05070a, 0.94).setDepth(0);
    this.add.text(400, 130, "冒険の始まり", this.textStyle(28, "#f4df7e")).setOrigin(0.5).setDepth(1);
    this.add.rectangle(400, 170, 360, 2, 0xd6b56a, 0.7).setDepth(1);
    this.lineText = this.add
      .text(400, 320, "", {
        ...this.textStyle(20, "#e6d7a8"),
        wordWrap: { width: 620, useAdvancedWrap: true },
        align: "center"
      })
      .setOrigin(0.5)
      .setDepth(1);
    this.promptText = this.add
      .text(400, 560, "", this.textStyle(14, "#9fb4c6"))
      .setOrigin(0.5)
      .setDepth(1);

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.events.once("shutdown", this.shutdown, this);

    this.showLine();
  }

  private shutdown(): void {
    this.input.keyboard?.off("keydown", this.handleKeyDown, this);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code !== "Space" && event.code !== "Enter") {
      return;
    }
    this.advance();
  }

  private showLine(): void {
    this.lineText?.setText(EPILOGUE_LINES[this.index]);
    this.promptText?.setText(
      this.index >= EPILOGUE_LINES.length - 1 ? "Space/Enter で 冒険に戻る" : "Space/Enter で つづける"
    );
  }

  private advance(): void {
    this.index += 1;
    if (this.index >= EPILOGUE_LINES.length) {
      this.scene.stop();
      this.scene.resume("WorldScene");
      return;
    }
    this.showLine();
  }

  private textStyle(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: '"Yu Gothic", Meiryo, "Hiragino Sans", "Noto Sans JP", sans-serif',
      fontSize: `${size}px`,
      color
    };
  }
}
