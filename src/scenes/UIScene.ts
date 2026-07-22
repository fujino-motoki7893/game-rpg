import Phaser from "phaser";
import { getDungeonNameForTier } from "../data/dungeonGenerator";
import { getMapDefinition } from "../data/maps";
import { GAME_EVENTS } from "../game/constants";
import {
  getActiveDungeonTier,
  getCompanionHp,
  getCompanionMaxHp,
  getCompanionMaxMp,
  getCompanionMp,
  getCurrentDungeonFloor,
  getDungeonFloorCount,
  isExpandedWorldUnlocked,
  getPlayerMaxHp,
  getPlayerMaxMp,
  getSave,
  hasCompanion
} from "../game/GameState";
import { getObjective } from "../data/dialogues";

export class UIScene extends Phaser.Scene {
  private objectiveText?: Phaser.GameObjects.Text;
  private mapText?: Phaser.GameObjects.Text;
  private playerStatusText?: Phaser.GameObjects.Text;
  private lunaStatusText?: Phaser.GameObjects.Text;
  private toastText?: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super("UIScene");
  }

  create(): void {
    this.add.rectangle(400, 30, 800, 60, 0x0c1319, 0.96);
    this.add.rectangle(400, 60, 800, 2, 0xd6b56a, 0.72);
    this.add.rectangle(400, 64, 800, 3, 0x000000, 0.22);
    this.add.rectangle(400, 582, 800, 116, 0x0c1319, 0.9);
    this.add.rectangle(400, 524, 800, 2, 0xd6b56a, 0.65);
    this.add.text(24, 552, "目的", this.textStyle(13, "#d6b56a"));
    this.objectiveText = this.add.text(76, 552, "", this.textStyle(17, "#e6d7a8"));
    this.mapText = this.add.text(776, 532, "", this.textStyle(18, "#a9d8ff")).setOrigin(1, 0);
    this.playerStatusText = this.add
      .text(776, 554, "", this.textStyle(16, "#f4df7e"))
      .setOrigin(1, 0);
    this.lunaStatusText = this.add
      .text(776, 576, "", this.textStyle(16, "#b28aff"))
      .setOrigin(1, 0);
    this.add.text(
      24,
      612,
      "操作: 移動 矢印/WASD  決定 Space/Enter  メニュー M/Esc  ルナと話す L  リセット R",
      this.textStyle(14, "#9fb4c6")
    );
    this.toastText = this.add
      .text(400, 505, "", this.textStyle(16, "#ffffff"))
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
    this.playerStatusText?.setText(`Lv ${save.level}  HP ${save.hp}/${maxHp}  MP ${save.mp}/${maxMp}`);
    if (hasCompanion()) {
      this.lunaStatusText?.setText(
        `ルナ Lv ${save.level}  HP ${getCompanionHp()}/${getCompanionMaxHp()}  MP ${getCompanionMp()}/${getCompanionMaxMp()}`
      );
    } else {
      this.lunaStatusText?.setText("");
    }
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
