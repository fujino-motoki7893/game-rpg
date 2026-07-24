import Phaser from "phaser";
import {
  getCharacterBattleScale,
  getCharacterIdleAnimationKey,
  getCharacterOriginY
} from "../data/characterSprites";
import { getCompanionSkillsForLevel } from "../data/companionSkills";
import { ENEMIES } from "../data/enemies";
import {
  canItemHealHp,
  canItemRestoreMp,
  getItemRarityLabel,
  ITEM_ORDER,
  ITEMS
} from "../data/items";
import { SKILLS } from "../data/skills";
import { GAME_EVENTS } from "../game/constants";
import {
  damageCompanion,
  damagePlayer,
  getCompanionAttack,
  getCompanionDefense,
  getCompanionHp,
  getCompanionMaxHp,
  getCompanionMaxMp,
  getCompanionMp,
  getCompanionSpeed,
  getPlayerAttack,
  getPlayerDefense,
  getPlayerMaxHp,
  getPlayerMaxMp,
  getPlayerSpeed,
  getKnownSkills,
  getItemCount,
  getSave,
  getTotalItemCount,
  grantReward,
  hasCompanion,
  hasLearnedSkill,
  healPlayer,
  markEnemyDefeated,
  persistSave,
  setPlayerPosition,
  spendCompanionMp,
  spendMp,
  useItem,
  useItemOnCompanion,
  useHealingSkill,
  useHealingSkillOnCompanion,
} from "../game/GameState";
import type { SkillDefinition } from "../data/skills";
import type { BattlePayload, EnemyDefinition, ItemId } from "../game/types";

export class BattleScene extends Phaser.Scene {
  private enemy!: EnemyDefinition;
  private enemyInstanceId = "";
  private enemyHp = 0;
  private playerTurn = true;
  private battleOver = false;
  private companionActive = false;
  private turnOrder: Array<"player" | "companion" | "enemy"> = [];
  private turnIndex = 0;
  private pendingAdvanceAt?: number;
  private playerX = 205;
  private playerSprite?: Phaser.GameObjects.Sprite;
  private enemySprite?: Phaser.GameObjects.Sprite;
  private companionSprite?: Phaser.GameObjects.Sprite;
  private playerHpFill?: Phaser.GameObjects.Rectangle;
  private enemyHpFill?: Phaser.GameObjects.Rectangle;
  private companionHpFill?: Phaser.GameObjects.Rectangle;
  private logText?: Phaser.GameObjects.Text;
  private playerHpText?: Phaser.GameObjects.Text;
  private enemyHpText?: Phaser.GameObjects.Text;
  private companionHpText?: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("BattleScene");
  }

  create(payload: BattlePayload): void {
    this.buttons = [];
    this.playerSprite = undefined;
    this.enemySprite = undefined;
    this.companionSprite = undefined;
    this.playerHpFill = undefined;
    this.enemyHpFill = undefined;
    this.companionHpFill = undefined;
    this.logText = undefined;
    this.playerHpText = undefined;
    this.enemyHpText = undefined;
    this.companionHpText = undefined;
    this.enemy = ENEMIES[payload.enemyKey] ?? ENEMIES.goblin;
    this.enemyInstanceId = payload.enemyInstanceId;
    this.enemyHp = this.enemy.maxHp;
    this.playerTurn = true;
    this.battleOver = false;
    this.companionActive = hasCompanion();
    this.turnOrder = [];
    this.turnIndex = 0;
    this.pendingAdvanceAt = undefined;

    this.playerX = this.companionActive ? 160 : 205;

    this.add.rectangle(400, 320, 800, 640, 0x07090d, 0.88);
    this.add.rectangle(400, 324, 660, 456, 0x101923, 0.98).setStrokeStyle(3, 0xd8bc72);
    this.add.rectangle(400, 134, 600, 2, 0xf0d98a, 0.75);
    this.add.text(116, 112, "ターンバトル", this.textStyle(24, "#f6e4a4")).setShadow(2, 2, "#000000", 3);
    this.add.ellipse(560, 286, 106, 22, 0x05080b, 0.36);
    this.add.ellipse(this.playerX, 308, 80, 18, 0x05080b, 0.36);
    this.enemySprite = this.add
      .sprite(560, 218, this.enemy.texture, 0)
      .setOrigin(0.5, getCharacterOriginY(this.enemy.texture))
      .setScale(getCharacterBattleScale(this.enemy.texture, 3))
      .setDepth(5);
    this.playerSprite = this.add
      .sprite(this.playerX, 258, "player", 0)
      .setOrigin(0.5, getCharacterOriginY("player"))
      .setScale(getCharacterBattleScale("player", 2.6))
      .setDepth(5);
    this.playCharacterIdle(this.enemySprite, this.enemy.texture);
    this.playCharacterIdle(this.playerSprite, "player");

    if (this.companionActive) {
      this.add.ellipse(272, 288, 74, 16, 0x05080b, 0.32);
      this.companionSprite = this.add
        .sprite(272, 232, "companion-luna", 0)
        .setOrigin(0.5, getCharacterOriginY("companion-luna"))
        .setScale(getCharacterBattleScale("companion-luna", 2.3))
        .setDepth(4);
      this.playCharacterIdle(this.companionSprite, "companion-luna");
    }

    this.playerHpText = this.add.text(116, 300, "", this.textStyle(17, "#f5f1dc"));
    this.enemyHpText = this.add.text(448, 300, "", this.textStyle(18, "#f5f1dc"));
    this.add.rectangle(116, 322, 188, 10, 0x1c2732, 1).setOrigin(0, 0.5);
    this.add.rectangle(448, 322, 188, 10, 0x1c2732, 1).setOrigin(0, 0.5);
    this.playerHpFill = this.add.rectangle(118, 322, 184, 6, 0xd95745, 1).setOrigin(0, 0.5);
    this.enemyHpFill = this.add.rectangle(450, 322, 184, 6, 0xd95745, 1).setOrigin(0, 0.5);
    this.add.rectangle(116, 322, 188, 10).setStrokeStyle(1, 0xf1d585, 0.8).setOrigin(0, 0.5);
    this.add.rectangle(448, 322, 188, 10).setStrokeStyle(1, 0xf1d585, 0.8).setOrigin(0, 0.5);

    if (this.companionActive) {
      this.companionHpText = this.add.text(116, 342, "", this.textStyle(17, "#f5f1dc"));
      this.add.rectangle(116, 364, 188, 10, 0x1c2732, 1).setOrigin(0, 0.5);
      this.companionHpFill = this.add.rectangle(118, 364, 184, 6, 0xb28aff, 1).setOrigin(0, 0.5);
      this.add.rectangle(116, 364, 188, 10).setStrokeStyle(1, 0xf1d585, 0.8).setOrigin(0, 0.5);
    }

    this.logText = this.add.text(116, 390, "", {
      ...this.textStyle(18, "#fff4cf"),
      wordWrap: { width: 568, useAdvancedWrap: true },
      lineSpacing: 8
    });

    this.refreshHud();
    this.setLog(`${this.enemy.name}が行く手をふさいだ。`);
    this.turnOrder = this.computeTurnOrder();
    this.turnIndex = 0;
    if (this.turnOrder[0] === "player") {
      this.resolveCurrentTurn(false);
    } else {
      this.playerTurn = false;
      this.pendingAdvanceAt = this.time.now + 700;
    }
  }

  update(): void {
    if (this.battleOver) {
      return;
    }

    if (this.pendingAdvanceAt !== undefined && this.time.now >= this.pendingAdvanceAt) {
      this.pendingAdvanceAt = undefined;
      this.resolveCurrentTurn();
    }
  }

  private computeTurnOrder(): Array<"player" | "companion" | "enemy"> {
    const actors: Array<{ id: "player" | "companion" | "enemy"; speed: number }> = [
      { id: "player", speed: Math.max(1, getPlayerSpeed()) },
      { id: "enemy", speed: Math.max(1, this.enemy.speed) }
    ];
    if (this.companionActive && getCompanionHp() > 0) {
      actors.push({ id: "companion", speed: Math.max(1, getCompanionSpeed()) });
    }

    return actors
      .map((actor) => ({ id: actor.id, key: Math.random() ** (1 / actor.speed) }))
      .sort((a, b) => b.key - a.key)
      .map((entry) => entry.id);
  }

  private resolveCurrentTurn(announce = true): void {
    if (this.battleOver) {
      return;
    }

    if (this.turnIndex >= this.turnOrder.length) {
      this.turnOrder = this.computeTurnOrder();
      this.turnIndex = 0;
    }

    const actor = this.turnOrder[this.turnIndex];
    if (actor === "companion" && (!this.companionActive || getCompanionHp() <= 0)) {
      this.turnIndex += 1;
      this.resolveCurrentTurn(announce);
      return;
    }

    if (actor === "player") {
      this.playerTurn = true;
      this.renderMainActions();
      if (announce) {
        this.setLog("あなたの番だ。");
      }
      return;
    }

    this.playerTurn = false;
    if (actor === "companion") {
      this.runCompanionTurn();
    } else {
      this.runEnemyTurn();
    }
  }

  private advanceTurn(delayMs: number): void {
    this.turnIndex += 1;
    this.playerTurn = false;
    this.setButtonsEnabled(false);
    this.pendingAdvanceAt = this.time.now + delayMs;
  }

  private renderMainActions(): void {
    this.clearButtons();
    const actions = [
      { label: "攻撃", run: () => this.attack() },
      { label: "スキル", run: () => this.showSkillActions() },
      { label: "道具", run: () => this.showItemActions() },
      { label: "逃げる", run: () => this.flee() }
    ];

    actions.forEach((action, index) => {
      this.createBattleButton(action.label, index, action.run);
    });
  }

  private showItemActions(): void {
    if (!this.playerTurn) {
      return;
    }

    this.clearButtons();
    this.setLog("使う道具を選んでください。");

    ITEM_ORDER.forEach((itemId, index) => {
      const item = ITEMS[itemId];
      const count = getItemCount(itemId);
      this.createBattleButton(
        `${item.name} ${getItemRarityLabel(itemId)}\nx${count}`,
        index,
        () => {
          if (this.companionActive && (canItemHealHp(itemId) || canItemRestoreMp(itemId))) {
            this.showItemTargetActions(itemId);
            return;
          }
          this.useBattleItem(itemId);
        },
        this.canUseBattleItem(itemId),
        true
      );
    });

    this.createBattleButton("戻る", ITEM_ORDER.length, () => {
      this.renderMainActions();
      this.setLog("あなたの番だ。");
    }, true, true);
  }

  private showItemTargetActions(itemId: ItemId): void {
    if (!this.playerTurn) {
      return;
    }

    const item = ITEMS[itemId];
    this.clearButtons();
    this.setLog(`${item.name}を誰に使いますか?`);

    const canUseOnSelf = this.playerBenefitsFromItem(itemId);
    const canUseOnCompanion = this.companionActive && this.companionBenefitsFromItem(itemId);

    this.createBattleButton("自分", 0, () => this.useBattleItem(itemId, "self"), canUseOnSelf, true);
    this.createBattleButton("ルナ", 1, () => this.useBattleItem(itemId, "companion"), canUseOnCompanion, true);
    this.createBattleButton("戻る", 2, () => this.showItemActions(), true, true);
  }

  private showSkillActions(): void {
    if (!this.playerTurn) {
      return;
    }

    const skills = getKnownSkills();
    if (skills.length === 0) {
      this.setLog("まだ使えるスキルを覚えていない。");
      return;
    }

    this.clearButtons();
    this.setLog(`使うスキルを選んでください。MP ${getSave().mp}/${getPlayerMaxMp()}`);

    skills.forEach((skill, index) => {
      const enabled = getSave().mp >= skill.mpCost;
      this.createBattleButton(
        `${skill.name}\nMP${skill.mpCost}`,
        index,
        () => {
          if (skill.effect.type === "heal" && this.companionActive) {
            this.showHealTargetActions(skill);
            return;
          }
          this.useSkill(skill);
        },
        enabled,
        true
      );
    });

    this.createBattleButton("戻る", skills.length, () => {
      this.renderMainActions();
      this.setLog("あなたの番だ。");
    }, true, true);
  }

  private showHealTargetActions(skill: SkillDefinition): void {
    if (!this.playerTurn) {
      return;
    }

    this.clearButtons();
    this.setLog(`${skill.name}を誰に使いますか?`);

    const save = getSave();
    const canHealSelf = save.hp < getPlayerMaxHp();
    const canHealCompanion = getCompanionHp() < getCompanionMaxHp();

    this.createBattleButton("自分", 0, () => this.useSkill(skill, "self"), canHealSelf, true);
    this.createBattleButton("ルナ", 1, () => this.useSkill(skill, "companion"), canHealCompanion, true);
    this.createBattleButton("戻る", 2, () => this.showSkillActions(), true, true);
  }

  private createBattleButton(
    label: string,
    index: number,
    run: () => void,
    enabled = true,
    skillGrid = false
  ): Phaser.GameObjects.Text {
    const x = skillGrid ? 116 + (index % 3) * 184 : 116 + index * 154;
    const y = skillGrid ? 432 + Math.floor(index / 3) * 62 : 470;
    const button = this.add
      .text(x, y, label, {
        ...this.textStyle(label.includes("\n") ? 16 : 19, enabled ? "#101820" : "#2a3036"),
        backgroundColor: enabled ? "#f2d27a" : "#66707a",
        padding: { x: 14, y: skillGrid ? 7 : 10 },
        fixedWidth: skillGrid ? 152 : 122,
        fixedHeight: skillGrid ? 54 : 44,
        align: "center"
      })
      .setAlpha(enabled ? 1 : 0.58)
      .setShadow(1, 1, "#d2a856", 0);

    if (enabled) {
      button.setInteractive({ useHandCursor: true }).on("pointerdown", run);
    }

    this.buttons.push(button);
    return button;
  }

  private attack(): void {
    if (!this.playerTurn) {
      return;
    }

    const save = getSave();
    const attack = getPlayerAttack();
    const damage = Phaser.Math.Between(Math.max(2, attack - 2), attack + 3);
    this.enemyHp = Math.max(0, this.enemyHp - damage);
    this.refreshHud();
    this.flashTarget(this.enemySprite);
    this.showDamageNumber(damage, 560, 146, "#ffe08a");

    if (this.enemyHp <= 0) {
      this.winBattle(damage);
      return;
    }

    this.setLog(`${damage}のダメージを与えた。`);
    this.endPlayerTurn();
  }

  private useBattleItem(itemId: ItemId, target: "self" | "companion" = "self"): void {
    if (!this.playerTurn) {
      return;
    }

    const item = ITEMS[itemId];

    if (target === "companion") {
      const result = useItemOnCompanion(itemId);
      if (!result.used) {
        this.setLog(this.getItemFailureMessage(item.name, result.reason));
        this.refreshHud();
        return;
      }

      this.refreshHud();
      if (result.healed > 0) {
        this.pulseTarget(this.companionSprite);
        this.showDamageNumber(result.healed, 272, 164, "#a5ffb2", "+");
      } else if (result.restoredMp > 0) {
        this.pulseTarget(this.companionSprite);
        this.showDamageNumber(result.restoredMp, 272, 164, "#8fc6ff", "+");
      }
      this.setLog(`${item.name}をルナに使った。${this.describeHealResult(result.healed, result.restoredMp)}`);
      this.endPlayerTurn();
      return;
    }

    const result = useItem(itemId);
    if (!result.used) {
      this.setLog(this.getItemFailureMessage(item.name, result.reason));
      this.refreshHud();
      return;
    }

    this.refreshHud();
    if (result.healed > 0) {
      this.pulseTarget(this.playerSprite);
      this.showDamageNumber(result.healed, this.playerX, 190, "#a5ffb2", "+");
    } else if (result.restoredMp > 0) {
      this.pulseTarget(this.playerSprite);
      this.showDamageNumber(result.restoredMp, this.playerX, 190, "#8fc6ff", "+");
    }
    this.setLog(this.getItemUseMessage(item.name, result.healed, result.restoredMp));
    this.endPlayerTurn();
  }

  private useSkill(skill: SkillDefinition, healTarget: "self" | "companion" = "self"): void {
    if (!this.playerTurn) {
      return;
    }

    if (!hasLearnedSkill(skill.id)) {
      this.setLog(`${skill.name}はまだ覚えていない。`);
      return;
    }

    if (getSave().mp < skill.mpCost) {
      this.setLog(`${skill.name}を使うMPが足りない。`);
      this.refreshHud();
      return;
    }

    if (skill.effect.type === "heal") {
      if (healTarget === "companion") {
        const result = useHealingSkillOnCompanion(skill.id);
        if (!result.used) {
          this.setLog(result.reason === "full-hp" ? "ルナのHPは満タンだ。" : `${skill.name}を使えなかった。`);
          this.refreshHud();
          return;
        }

        this.refreshHud();
        this.pulseTarget(this.companionSprite);
        this.showDamageNumber(result.healed, 272, 164, "#a5ffb2", "+");
        this.setLog(`${skill.name}でルナのHPを${result.healed}回復した。`);
        this.endPlayerTurn();
        return;
      }

      const result = useHealingSkill(skill.id);
      if (!result.used) {
        this.setLog(result.reason === "full-hp" ? "HPは満タンだ。" : `${skill.name}を使えなかった。`);
        this.refreshHud();
        return;
      }

      this.refreshHud();
      this.pulseTarget(this.playerSprite);
      this.showDamageNumber(result.healed, this.playerX, 190, "#a5ffb2", "+");
      this.setLog(`${skill.name}でHPを${result.healed}回復した。`);
      this.endPlayerTurn();
      return;
    }

    if (!spendMp(skill.mpCost)) {
      this.setLog(`${skill.name}を使うMPが足りない。`);
      this.refreshHud();
      return;
    }

    const damage = this.calculateSkillDamage(skill);
    this.enemyHp = Math.max(0, this.enemyHp - damage);
    this.refreshHud();
    this.flashTarget(this.enemySprite);
    this.showDamageNumber(damage, 560, 146, "#ffe08a");

    if (this.enemyHp <= 0) {
      this.winBattle(damage);
      return;
    }

    this.setLog(`${skill.name}！${damage}のダメージを与えた。`);
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
    this.advanceTurn(700);
  }

  private runCompanionTurn(): void {
    try {
      this.companionTurn();
    } catch (error) {
      console.error(error);
      this.advanceTurn(200);
    }
  }

  private companionTurn(): void {
    if (!this.companionActive || getCompanionHp() <= 0) {
      this.advanceTurn(300);
      return;
    }

    const maxHp = getPlayerMaxHp();
    const playerHp = getSave().hp;
    const level = getSave().level;
    const healSkills = getCompanionSkillsForLevel(level)
      .filter((skill) => skill.effect.type === "heal")
      .reverse();

    for (const skill of healSkills) {
      if (skill.effect.type !== "heal") {
        continue;
      }

      const { healRatio, triggerRatio } = skill.effect;
      if (playerHp > 0 && playerHp < maxHp * triggerRatio && getCompanionMp() >= skill.mpCost) {
        spendCompanionMp(skill.mpCost);
        const healed = healPlayer(Math.round(maxHp * healRatio));
        this.refreshHud();
        this.pulseTarget(this.playerSprite);
        this.showDamageNumber(healed, this.playerX, 190, "#c6ffd8", "+");
        this.setLog(`ルナの${skill.name}！HPを${healed}回復した。`);
        this.advanceTurn(700);
        return;
      }
    }

    const attack = getCompanionAttack();
    const damage = Phaser.Math.Between(Math.max(1, attack - 1), attack + 2);
    this.enemyHp = Math.max(0, this.enemyHp - damage);
    this.refreshHud();
    this.flashTarget(this.enemySprite);
    this.showDamageNumber(damage, 560, 146, "#c9baff");

    if (this.enemyHp <= 0) {
      this.winBattle(damage);
      return;
    }

    this.setLog(`ルナの魔法弾！${damage}のダメージを与えた。`);
    this.advanceTurn(700);
  }

  private runEnemyTurn(): void {
    try {
      this.enemyTurn();
    } catch (error) {
      console.error(error);
      this.pendingAdvanceAt = undefined;
      this.playerTurn = true;
      this.renderMainActions();
      this.setLog("ターン処理を復旧しました。もう一度行動できます。");
    }
  }

  private enemyTurn(): void {
    const rawDamage = Phaser.Math.Between(Math.max(1, this.enemy.attack - 2), this.enemy.attack + 2);
    const targetsCompanion =
      this.companionActive && getCompanionHp() > 0 && Phaser.Math.Between(1, 100) <= 30;

    if (targetsCompanion) {
      const damage = Math.max(1, rawDamage - getCompanionDefense());
      damageCompanion(damage);
      this.refreshHud();
      this.flashTarget(this.companionSprite);
      this.showDamageNumber(damage, 272, 164, "#ff9a7a");
      this.setLog(
        getCompanionHp() <= 0
          ? `${this.enemy.name}の攻撃。ルナは倒れてしまった。`
          : `${this.enemy.name}の攻撃。ルナが${damage}のダメージを受けた。`
      );
      this.advanceTurn(700);
      return;
    }

    const damage = Math.max(1, rawDamage - getPlayerDefense());
    damagePlayer(damage);
    this.refreshHud();
    this.flashTarget(this.playerSprite);
    this.showDamageNumber(damage, this.playerX, 190, "#ff9a7a");

    if (getSave().hp <= 0) {
      this.loseBattle(damage);
      return;
    }

    this.setLog(`${this.enemy.name}の攻撃。${damage}のダメージを受けた。`);
    this.advanceTurn(700);
  }

  private winBattle(lastDamage: number): void {
    this.battleOver = true;
    this.pendingAdvanceAt = undefined;
    markEnemyDefeated(this.enemyInstanceId);
    const reward = grantReward(this.enemy.exp, this.enemy.gold);
    const learnedText =
      reward.learnedSkillIds.length > 0
        ? ` ${reward.learnedSkillIds.map((skillId) => SKILLS[skillId].name).join("、")}を覚えた！`
        : "";
    const levelText = reward.leveledUp ? ` レベルアップ！${learnedText}` : "";
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
    this.pendingAdvanceAt = undefined;
    const save = getSave();
    save.hp = Math.ceil(getPlayerMaxHp() * 0.6);
    save.mp = Math.ceil(getPlayerMaxMp() * 0.5);
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
    this.pendingAdvanceAt = undefined;
    this.game.events.emit(GAME_EVENTS.toast, message);
    this.game.events.emit(GAME_EVENTS.stateChanged);
    this.scene.stop();
    this.scene.resume("WorldScene");
  }

  private refreshHud(): void {
    const save = getSave();
    const maxHp = getPlayerMaxHp();
    const maxMp = getPlayerMaxMp();
    this.playerHpText?.setText(
      `勇者 HP ${save.hp}/${maxHp}  MP ${save.mp}/${maxMp}  道具 ${getTotalItemCount()}`
    );
    this.enemyHpText?.setText(`${this.enemy.name} HP ${this.enemyHp}/${this.enemy.maxHp}`);
    this.playerHpFill?.setDisplaySize(184 * Phaser.Math.Clamp(save.hp / maxHp, 0, 1), 6);
    this.enemyHpFill?.setDisplaySize(
      184 * Phaser.Math.Clamp(this.enemyHp / this.enemy.maxHp, 0, 1),
      6
    );

    if (this.companionActive) {
      const companionMaxHp = getCompanionMaxHp();
      const companionMaxMp = getCompanionMaxMp();
      const companionHp = getCompanionHp();
      const companionMp = getCompanionMp();
      this.companionHpText?.setText(`ルナ HP ${companionHp}/${companionMaxHp}  MP ${companionMp}/${companionMaxMp}`);
      this.companionHpFill?.setDisplaySize(
        184 * Phaser.Math.Clamp(companionHp / companionMaxHp, 0, 1),
        6
      );
    }
  }

  private setLog(message: string): void {
    this.logText?.setText(message);
  }

  private setButtonsEnabled(enabled: boolean): void {
    this.buttons = this.buttons.filter((button) => button.active && button.scene === this);
    this.buttons.forEach((button) => {
      button.setAlpha(enabled ? 1 : 0.55);
      if (enabled) {
        button.setInteractive({ useHandCursor: true });
      } else {
        button.disableInteractive();
      }
    });
  }

  private clearButtons(): void {
    this.buttons.forEach((button) => button.destroy());
    this.buttons = [];
  }

  private calculateSkillDamage(skill: SkillDefinition): number {
    if (skill.effect.type !== "damage") {
      return 0;
    }

    const save = getSave();
    const baseDamage = Math.round(getPlayerAttack() * skill.effect.multiplier + skill.effect.bonus);
    return Phaser.Math.Between(Math.max(2, baseDamage - 3), baseDamage + 4);
  }

  private canUseBattleItem(itemId: ItemId): boolean {
    if (getItemCount(itemId) <= 0) {
      return false;
    }

    return (
      this.playerBenefitsFromItem(itemId) ||
      (this.companionActive && this.companionBenefitsFromItem(itemId))
    );
  }

  private playerBenefitsFromItem(itemId: ItemId): boolean {
    const save = getSave();
    return (
      (canItemHealHp(itemId) && save.hp < getPlayerMaxHp()) ||
      (canItemRestoreMp(itemId) && save.mp < getPlayerMaxMp())
    );
  }

  private companionBenefitsFromItem(itemId: ItemId): boolean {
    return (
      (canItemHealHp(itemId) && getCompanionHp() < getCompanionMaxHp()) ||
      (canItemRestoreMp(itemId) && getCompanionMp() < getCompanionMaxMp())
    );
  }

  private getItemUseMessage(itemName: string, healed: number, restoredMp: number): string {
    return `${itemName}で${this.describeHealResult(healed, restoredMp)}`;
  }

  private describeHealResult(healed: number, restoredMp: number): string {
    const parts: string[] = [];
    if (healed > 0) {
      parts.push(`HPを${healed}`);
    }
    if (restoredMp > 0) {
      parts.push(`MPを${restoredMp}`);
    }

    return `${parts.join("、")}回復した。`;
  }

  private getItemFailureMessage(itemName: string, reason?: string): string {
    if (reason === "full-hp") {
      return "HPは満タンだ。";
    }
    if (reason === "full-mp") {
      return "MPは満タンだ。";
    }
    return `${itemName}を使えなかった。`;
  }

  private playCharacterIdle(sprite: Phaser.GameObjects.Sprite, textureKey: string): void {
    const animationKey = getCharacterIdleAnimationKey(textureKey, "down");
    if (this.anims.exists(animationKey)) {
      sprite.play(animationKey, true);
    }
  }

  private flashTarget(target?: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
    if (!target) {
      return;
    }

    target.setTint(0xffffff);
    this.tweens.add({
      targets: target,
      x: target.x + 6,
      duration: 55,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        target.clearTint();
      }
    });
  }

  private pulseTarget(target?: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
    if (!target) {
      return;
    }

    target.setTint(0xa5ffb2);
    this.tweens.add({
      targets: target,
      scale: target.scaleX + 0.12,
      duration: 110,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        target.clearTint();
      }
    });
  }

  private showDamageNumber(amount: number, x: number, y: number, color: string, prefix = "-"): void {
    const text = this.add
      .text(x, y, `${prefix}${amount}`, {
        ...this.textStyle(22, color),
        fontStyle: "bold"
      })
      .setOrigin(0.5, 0.5)
      .setDepth(20)
      .setShadow(2, 2, "#000000", 3);

    this.tweens.add({
      targets: text,
      y: y - 26,
      alpha: 0,
      duration: 650,
      ease: "Sine.easeOut",
      onComplete: () => text.destroy()
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
