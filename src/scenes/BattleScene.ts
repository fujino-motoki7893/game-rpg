import Phaser from "phaser";
import { ENEMIES } from "../data/enemies";
import { GAME_EVENTS } from "../game/constants";
import {
  damagePlayer,
  getSave,
  grantReward,
  markEnemyDefeated,
  persistSave,
  setPlayerPosition,
  usePotion
} from "../game/GameState";
import type { BattlePayload, EnemyDefinition } from "../game/types";

export class BattleScene extends Phaser.Scene {
  private enemy!: EnemyDefinition;
  private enemyInstanceId = "";
  private enemyHp = 0;
  private playerTurn = true;
  private logText?: Phaser.GameObjects.Text;
  private playerHpText?: Phaser.GameObjects.Text;
  private enemyHpText?: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("BattleScene");
  }

  create(payload: BattlePayload): void {
    this.enemy = ENEMIES[payload.enemyKey];
    this.enemyInstanceId = payload.enemyInstanceId;
    this.enemyHp = this.enemy.maxHp;
    this.playerTurn = true;

    this.add.rectangle(400, 320, 800, 640, 0x090b0e, 0.86);
    this.add.rectangle(400, 324, 640, 440, 0x18202a, 0.98).setStrokeStyle(2, 0xd8bc72);
    this.add.text(116, 124, "Turn Battle", this.textStyle(24, "#f6e4a4"));
    this.add.image(560, 218, this.enemy.texture).setScale(3).setDepth(5);
    this.add.image(205, 258, "player").setScale(2.6).setDepth(5);

    this.playerHpText = this.add.text(116, 338, "", this.textStyle(18, "#f5f1dc"));
    this.enemyHpText = this.add.text(448, 338, "", this.textStyle(18, "#f5f1dc"));
    this.logText = this.add.text(116, 384, "", {
      ...this.textStyle(18, "#fff4cf"),
      wordWrap: { width: 568, useAdvancedWrap: true },
      lineSpacing: 8
    });

    this.createButtons();
    this.refreshHud();
    this.setLog(`${this.enemy.name} blocks your path.`);
  }

  private createButtons(): void {
    const labels = ["Attack", "Potion", "Flee"];
    labels.forEach((label, index) => {
      const button = this.add
        .text(116 + index * 154, 470, label, {
          ...this.textStyle(19, "#101820"),
          backgroundColor: "#f2d27a",
          padding: { x: 18, y: 10 },
          fixedWidth: 122,
          align: "center"
        })
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          if (label === "Attack") {
            this.attack();
          } else if (label === "Potion") {
            this.drinkPotion();
          } else {
            this.flee();
          }
        });
      this.buttons.push(button);
    });
  }

  private attack(): void {
    if (!this.playerTurn) {
      return;
    }

    const save = getSave();
    const damage = Phaser.Math.Between(Math.max(2, save.attack - 2), save.attack + 3);
    this.enemyHp = Math.max(0, this.enemyHp - damage);
    this.refreshHud();

    if (this.enemyHp <= 0) {
      this.winBattle(damage);
      return;
    }

    this.setLog(`You strike for ${damage}.`);
    this.endPlayerTurn();
  }

  private drinkPotion(): void {
    if (!this.playerTurn) {
      return;
    }

    if (!usePotion()) {
      this.setLog("No useful potion remains.");
      this.refreshHud();
      return;
    }

    this.setLog("You drink a potion.");
    this.refreshHud();
    this.endPlayerTurn();
  }

  private flee(): void {
    if (!this.playerTurn) {
      return;
    }

    if (this.enemy.boss) {
      this.setLog("The guardian seals the exit.");
      this.endPlayerTurn();
      return;
    }

    if (Phaser.Math.Between(1, 100) <= 70) {
      this.closeBattle("You slip away.");
      return;
    }

    this.setLog("You fail to escape.");
    this.endPlayerTurn();
  }

  private endPlayerTurn(): void {
    this.playerTurn = false;
    this.setButtonsEnabled(false);
    this.time.delayedCall(700, () => this.enemyTurn());
  }

  private enemyTurn(): void {
    const damage = Phaser.Math.Between(Math.max(1, this.enemy.attack - 2), this.enemy.attack + 2);
    damagePlayer(damage);
    this.refreshHud();

    if (getSave().hp <= 0) {
      this.loseBattle(damage);
      return;
    }

    this.setLog(`${this.enemy.name} hits for ${damage}.`);
    this.time.delayedCall(700, () => {
      this.playerTurn = true;
      this.setButtonsEnabled(true);
      this.setLog("Your turn.");
    });
  }

  private winBattle(lastDamage: number): void {
    markEnemyDefeated(this.enemyInstanceId);
    const reward = grantReward(this.enemy.exp, this.enemy.gold);
    const levelText = reward.leveledUp ? " Level up!" : "";
    this.setLog(
      `You strike for ${lastDamage}. ${this.enemy.name} falls. +${this.enemy.exp} EXP, +${this.enemy.gold} gold.${levelText}`
    );
    this.refreshHud();
    this.game.events.emit(GAME_EVENTS.stateChanged);
    this.setButtonsEnabled(false);
    this.time.delayedCall(1200, () => this.closeBattle("Victory"));
  }

  private loseBattle(lastDamage: number): void {
    const save = getSave();
    save.hp = Math.ceil(save.maxHp * 0.6);
    save.gold = Math.floor(save.gold * 0.8);
    persistSave();
    this.setLog(`${this.enemy.name} hits for ${lastDamage}. You wake up in Stonebrook.`);
    this.setButtonsEnabled(false);
    this.time.delayedCall(1400, () => {
      setPlayerPosition("village", 9, 6);
      this.game.events.emit(GAME_EVENTS.stateChanged);
      this.scene.stop("WorldScene");
      this.scene.stop();
      this.scene.start("WorldScene");
    });
  }

  private closeBattle(message: string): void {
    this.game.events.emit(GAME_EVENTS.toast, message);
    this.game.events.emit(GAME_EVENTS.stateChanged);
    this.scene.stop();
    this.scene.resume("WorldScene");
  }

  private refreshHud(): void {
    const save = getSave();
    this.playerHpText?.setText(`Hero HP ${save.hp}/${save.maxHp}  Potions ${save.potions}`);
    this.enemyHpText?.setText(`${this.enemy.name} HP ${this.enemyHp}/${this.enemy.maxHp}`);
  }

  private setLog(message: string): void {
    this.logText?.setText(message);
  }

  private setButtonsEnabled(enabled: boolean): void {
    this.buttons.forEach((button) => {
      button.setAlpha(enabled ? 1 : 0.55);
      if (enabled) {
        button.setInteractive({ useHandCursor: true });
      } else {
        button.disableInteractive();
      }
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
