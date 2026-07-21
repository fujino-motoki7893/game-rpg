import Phaser from "phaser";
import { getDungeonNameForTier } from "../data/dungeonGenerator";
import { getMapDefinition } from "../data/maps";
import { GAME_EVENTS } from "../game/constants";
import {
  getActiveDungeonTier,
  getCurrentDungeonFloor,
  getDungeonFloorCount,
  isExpandedWorldUnlocked,
  getPlayerAttack,
  getPlayerDefense,
  getPlayerMaxHp,
  getPlayerMaxMp,
  getSave,
  getTotalItemCount
} from "../game/GameState";
import { getObjective } from "../data/dialogues";

export class UIScene extends Phaser.Scene {
  private hpText?: Phaser.GameObjects.Text;
  private statsText?: Phaser.GameObjects.Text;
  private objectiveText?: Phaser.GameObjects.Text;
  private mapText?: Phaser.GameObjects.Text;
  private hpBarFill?: Phaser.GameObjects.Rectangle;
  private mpBarFill?: Phaser.GameObjects.Rectangle;
  private toastText?: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super("UIScene");
  }

  create(): void {
    this.add.rectangle(400, 30, 800, 60, 0x0c1319, 0.96);
    this.add.rectangle(400, 60, 800, 2, 0xd6b56a, 0.72);
    this.add.rectangle(400, 64, 800, 3, 0x000000, 0.22);
    this.add.rectangle(400, 608, 800, 64, 0x0c1319, 0.9);
    this.add.rectangle(400, 576, 800, 2, 0xd6b56a, 0.65);
    this.hpText = this.add.text(24, 15, "", this.textStyle(18, "#f4df7e"));
    this.add.rectangle(24, 43, 150, 8, 0x1b232c, 1).setOrigin(0, 0.5);
    this.hpBarFill = this.add.rectangle(26, 43, 146, 4, 0xd95745, 1).setOrigin(0, 0.5);
    this.add.rectangle(24, 43, 150, 8).setStrokeStyle(1, 0xf1d585, 0.8).setOrigin(0, 0.5);
    this.add.rectangle(24, 55, 150, 8, 0x1b232c, 1).setOrigin(0, 0.5);
    this.mpBarFill = this.add.rectangle(26, 55, 146, 4, 0x4a8dff, 1).setOrigin(0, 0.5);
    this.add.rectangle(24, 55, 150, 8).setStrokeStyle(1, 0x8fc6ff, 0.72).setOrigin(0, 0.5);
    this.statsText = this.add.text(206, 18, "", this.textStyle(17, "#f4f0db"));
    this.add.text(24, 582, "目的", this.textStyle(13, "#d6b56a"));
    this.objectiveText = this.add.text(76, 582, "", this.textStyle(17, "#e6d7a8"));
    this.mapText = this.add.text(776, 15, "", this.textStyle(18, "#a9d8ff")).setOrigin(1, 0);
    this.add.text(
      24,
      616,
      "操作: 移動 矢印/WASD  決定 Space/Enter  メニュー M/Esc  ルナと話す L  リセット R",
      this.textStyle(14, "#9fb4c6")
    );
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
    const maxHp = getPlayerMaxHp();
    const maxMp = getPlayerMaxMp();
    this.hpText?.setText(`HP ${save.hp}/${maxHp}  MP ${save.mp}/${maxMp}`);
    this.statsText?.setText(
      `Lv ${save.level}  攻 ${getPlayerAttack()}  防 ${getPlayerDefense()}  道具 ${getTotalItemCount()}  G ${save.gold}`
    );
    const hpRatio = Phaser.Math.Clamp(save.hp / maxHp, 0, 1);
    const mpRatio = Phaser.Math.Clamp(save.mp / maxMp, 0, 1);
    this.hpBarFill?.setDisplaySize(146 * hpRatio, 4);
    this.mpBarFill?.setDisplaySize(146 * mpRatio, 4);
    this.objectiveText?.setText(getObjective());
    const mapName =
      save.mapId === "dungeon"
        ? `${getDungeonNameForTier(getActiveDungeonTier())} B${getCurrentDungeonFloor()}F/${getDungeonFloorCount() ?? "?"}F`
        : getMapDefinition(save.mapId, isExpandedWorldUnlocked()).name;
    this.mapText?.setText(mapName);
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
      fontFamily: '"Yu Gothic", Meiryo, "Hiragino Sans", "Noto Sans JP", sans-serif',
      fontSize: `${size}px`,
      color
    };
  }
}
