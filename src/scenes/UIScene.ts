import Phaser from "phaser";
import { GAME_EVENTS } from "../game/constants";
import { getSave } from "../game/GameState";
import { getObjective } from "../data/dialogues";

export class UIScene extends Phaser.Scene {
  private hpText?: Phaser.GameObjects.Text;
  private statsText?: Phaser.GameObjects.Text;
  private objectiveText?: Phaser.GameObjects.Text;
  private mapText?: Phaser.GameObjects.Text;
  private toastText?: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super("UIScene");
  }

  create(): void {
    this.add.rectangle(400, 30, 800, 60, 0x11181f, 0.94);
    this.add.rectangle(400, 608, 800, 64, 0x11181f, 0.86);
    this.hpText = this.add.text(24, 15, "", this.textStyle(18, "#f4df7e"));
    this.statsText = this.add.text(210, 15, "", this.textStyle(18, "#f4f0db"));
    this.objectiveText = this.add.text(24, 590, "", this.textStyle(17, "#e6d7a8"));
    this.mapText = this.add.text(776, 15, "", this.textStyle(18, "#a9d8ff")).setOrigin(1, 0);
    this.toastText = this.add
      .text(400, 565, "", this.textStyle(16, "#ffffff"))
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    this.game.events.on(GAME_EVENTS.stateChanged, this.refresh, this);
    this.game.events.on(GAME_EVENTS.mapChanged, this.setMapName, this);
    this.game.events.on(GAME_EVENTS.toast, this.showToast, this);
    this.refresh();
  }

  shutdown(): void {
    this.game.events.off(GAME_EVENTS.stateChanged, this.refresh, this);
    this.game.events.off(GAME_EVENTS.mapChanged, this.setMapName, this);
    this.game.events.off(GAME_EVENTS.toast, this.showToast, this);
  }

  private refresh(): void {
    const save = getSave();
    this.hpText?.setText(`HP ${save.hp}/${save.maxHp}`);
    this.statsText?.setText(
      `Lv ${save.level}  ATK ${save.attack}  Potions ${save.potions}  Gold ${save.gold}`
    );
    this.objectiveText?.setText(getObjective());
  }

  private setMapName(mapName: string): void {
    this.mapText?.setText(mapName);
  }

  private showToast(message: string): void {
    this.toastTimer?.remove(false);
    this.toastText?.setText(message).setVisible(true);
    this.toastTimer = this.time.delayedCall(1800, () => {
      this.toastText?.setVisible(false);
    });
  }

  private textStyle(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: `${size}px`,
      color
    };
  }
}
