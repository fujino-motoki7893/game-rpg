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
  private battleOver = false;
  private pendingEnemyTurnAt?: number;
  private pendingPlayerTurnAt?: number;
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
    this.battleOver = false;
    this.pendingEnemyTurnAt = undefined;
    this.pendingPlayerTurnAt = undefined;

    this.add.rectangle(400, 320, 800, 640, 0x090b0e, 0.86);
    this.add.rectangle(400, 324, 640, 440, 0x18202a, 0.98).setStrokeStyle(2, 0xd8bc72);
    this.add.text(116, 124, "ターンバトル", this.textStyle(24, "#f6e4a4"));
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
    this.setLog(`${this.enemy.name}が行く手をふさいだ。`);
  }

  update(): void {
    if (this.battleOver) {
      return;
    }

    const now = this.time.now;
    if (this.pendingEnemyTurnAt !== undefined && now >= this.pendingEnemyTurnAt) {
      this.pendingEnemyTurnAt = undefined;
      this.runEnemyTurn();
    }

    if (this.pendingPlayerTurnAt !== undefined && now >= this.pendingPlayerTurnAt) {
      this.pendingPlayerTurnAt = undefined;
      this.playerTurn = true;
      this.setButtonsEnabled(true);
      this.setLog("あなたの番だ。");
    }
  }

  private createButtons(): void {
    const actions = [
      { label: "攻撃", run: () => this.attack() },
      { label: "薬草", run: () => this.drinkPotion() },
      { label: "逃げる", run: () => this.flee() }
    ];

    actions.forEach((action, index) => {
      const button = this.add
        .text(116 + index * 154, 470, action.label, {
          ...this.textStyle(19, "#101820"),
          backgroundColor: "#f2d27a",
          padding: { x: 18, y: 10 },
          fixedWidth: 122,
          align: "center"
        })
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", action.run);
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

    this.setLog(`${damage}のダメージを与えた。`);
    this.endPlayerTurn();
  }

  private drinkPotion(): void {
    if (!this.playerTurn) {
      return;
    }

    if (!usePotion()) {
      this.setLog("使える薬草がない。");
      this.refreshHud();
      return;
    }

    this.setLog("薬草で傷を癒した。");
    this.refreshHud();
    this.endPlayerTurn();
  }

  private flee(): void {
    if (!this.playerTurn) {
      return;
    }

    if (this.enemy.boss) {
      this.setLog("守護者が退路を封じている。");
      this.endPlayerTurn();
      return;
    }

    if (Phaser.Math.Between(1, 100) <= 70) {
      this.closeBattle("うまく逃げ切った。");
      return;
    }

    this.setLog("逃げられなかった。");
    this.endPlayerTurn();
  }

  private endPlayerTurn(): void {
    this.playerTurn = false;
    this.setButtonsEnabled(false);
    this.pendingEnemyTurnAt = this.time.now + 700;
  }

  private runEnemyTurn(): void {
    try {
      this.enemyTurn();
    } catch (error) {
      console.error(error);
      this.pendingEnemyTurnAt = undefined;
      this.pendingPlayerTurnAt = undefined;
      this.playerTurn = true;
      this.setButtonsEnabled(true);
      this.setLog("ターン処理を復旧しました。もう一度行動できます。");
    }
  }

  private enemyTurn(): void {
    const damage = Phaser.Math.Between(Math.max(1, this.enemy.attack - 2), this.enemy.attack + 2);
    damagePlayer(damage);
    this.refreshHud();

    if (getSave().hp <= 0) {
      this.loseBattle(damage);
      return;
    }

    this.setLog(`${this.enemy.name}の攻撃。${damage}のダメージを受けた。`);
    this.pendingPlayerTurnAt = this.time.now + 700;
  }

  private winBattle(lastDamage: number): void {
    this.battleOver = true;
    this.pendingEnemyTurnAt = undefined;
    this.pendingPlayerTurnAt = undefined;
    markEnemyDefeated(this.enemyInstanceId);
    const reward = grantReward(this.enemy.exp, this.enemy.gold);
    const levelText = reward.leveledUp ? " レベルアップ！" : "";
    this.setLog(
      `${lastDamage}のダメージを与えた。${this.enemy.name}を倒した。EXP +${this.enemy.exp}、G +${this.enemy.gold}。${levelText}`
    );
    this.refreshHud();
    this.game.events.emit(GAME_EVENTS.stateChanged);
    this.setButtonsEnabled(false);
    this.time.delayedCall(1200, () => this.closeBattle("勝利"));
  }

  private loseBattle(lastDamage: number): void {
    this.battleOver = true;
    this.pendingEnemyTurnAt = undefined;
    this.pendingPlayerTurnAt = undefined;
    const save = getSave();
    save.hp = Math.ceil(save.maxHp * 0.6);
    save.gold = Math.floor(save.gold * 0.8);
    persistSave();
    this.setLog(
      `${this.enemy.name}の攻撃。${lastDamage}のダメージを受けた。気がつくとストーンブルック村に戻っていた。`
    );
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
    this.battleOver = true;
    this.pendingEnemyTurnAt = undefined;
    this.pendingPlayerTurnAt = undefined;
    this.game.events.emit(GAME_EVENTS.toast, message);
    this.game.events.emit(GAME_EVENTS.stateChanged);
    this.scene.stop();
    this.scene.resume("WorldScene");
  }

  private refreshHud(): void {
    const save = getSave();
    this.playerHpText?.setText(`勇者 HP ${save.hp}/${save.maxHp}  薬草 ${save.potions}`);
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
      fontFamily: '"Yu Gothic", Meiryo, "Hiragino Sans", "Noto Sans JP", sans-serif',
      fontSize: `${size}px`,
      color
    };
  }
}
