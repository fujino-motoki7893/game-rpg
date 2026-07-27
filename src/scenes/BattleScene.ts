import Phaser from "phaser";
import {
  getCharacterBattleScale,
  getCharacterIdleAnimationKey,
  getCharacterOriginY
} from "../data/characterSprites";
import { COMPANION_ORDER, COMPANIONS, decideCompanionAction, isCompanionId } from "../data/companions";
import { ENEMIES } from "../data/enemies";
import { getEnemySkills } from "../data/enemySkills";
import {
  canItemCureStatus,
  canItemHealHp,
  canItemRestoreMp,
  getItemCuresStatus,
  getItemRarityLabel,
  ITEM_ORDER,
  ITEMS
} from "../data/items";
import { SKILLS } from "../data/skills";
import {
  getStatusEffectIcon,
  getStatusEffectName,
  getStatusTickDamage,
  isDamageTickStatus,
  isStunStatus
} from "../data/statusEffects";
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
  consumeItem,
  useItem,
  useItemOnCompanion,
  useHealingSkill,
  useHealingSkillOnCompanion
} from "../game/GameState";
import type { CompanionId } from "../data/companions";
import type { SkillDefinition } from "../data/skills";
import type { ActiveStatusEffect, StatusEffectType, StatusInflict } from "../data/statusEffects";
import type { BattlePayload, EnemyDefinition, ItemId } from "../game/types";

interface AllySlot {
  id: CompanionId;
  x: number;
  sprite?: Phaser.GameObjects.Sprite;
  hpText?: Phaser.GameObjects.Text;
  hpFill?: Phaser.GameObjects.Rectangle;
}

interface EnemySlot {
  key: string;
  definition: EnemyDefinition;
  hp: number;
  /** Enemy skill MP — never restored mid-battle, so a boss's signature
   * skill naturally tapers off into basic attacks over a long fight. */
  mp: number;
  x: number;
  alive: boolean;
  sprite?: Phaser.GameObjects.Sprite;
  hpText?: Phaser.GameObjects.Text;
}

/** Enemy HP is shown only as a name-color cue, not an exact bar/number. */
const ENEMY_HP_COLOR_HEALTHY = "#ffffff";
const ENEMY_HP_COLOR_HURT = "#ffe066";
const ENEMY_HP_COLOR_CRITICAL = "#ff9a3c";

type TurnActor = CompanionId | "player" | `enemy-${number}`;

/**
 * Pixel layout by party size — the one piece of this scene that a new
 * companion genuinely can't inherit for free, since where sprites/HP rows
 * sit is a visual call, not a formula. Add a `3: {...}` entry (and tune it
 * visually) when a third companion arrives; everything else in this scene
 * (turn order, AI, targeting, HUD) already works for any length of
 * `this.allies`.
 */
const ALLY_LAYOUT_BY_COUNT: Record<number, { playerX: number; allyX: number[]; hpRowY: number[]; logY: number }> = {
  0: { playerX: 205, allyX: [], hpRowY: [], logY: 390 },
  1: { playerX: 160, allyX: [272], hpRowY: [342], logY: 390 },
  2: { playerX: 110, allyX: [280, 195], hpRowY: [342, 380], logY: 408 }
};

/** Sprite/HP-row placement for a 1-3 enemy encounter group. */
const ENEMY_LAYOUT_BY_COUNT: Record<number, { enemyX: number[]; hpRowY: number[] }> = {
  1: { enemyX: [560], hpRowY: [300] },
  2: { enemyX: [520, 612], hpRowY: [300, 338] },
  3: { enemyX: [480, 560, 640], hpRowY: [300, 338, 376] }
};

export class BattleScene extends Phaser.Scene {
  private enemySlots: EnemySlot[] = [];
  private enemyInstanceId = "";
  private playerTurn = true;
  private battleOver = false;
  private allies: AllySlot[] = [];
  private turnOrder: TurnActor[] = [];
  private turnIndex = 0;
  /** Battle-runtime only — never persisted, so effects never carry over
   * between separate battles (a fresh scene instance = a fresh map). */
  private statusEffects = new Map<TurnActor, ActiveStatusEffect[]>();
  private pendingAdvanceAt?: number;
  private playerX = 205;
  private logY = 390;
  private playerSprite?: Phaser.GameObjects.Sprite;
  private playerHpFill?: Phaser.GameObjects.Rectangle;
  private logText?: Phaser.GameObjects.Text;
  private playerHpText?: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("BattleScene");
  }

  create(payload: BattlePayload): void {
    this.buttons = [];
    this.playerSprite = undefined;
    this.playerHpFill = undefined;
    this.logText = undefined;
    this.playerHpText = undefined;
    this.enemyInstanceId = payload.enemyInstanceId;
    const enemyKeys = payload.enemyKeys.length > 0 ? payload.enemyKeys : ["goblin"];
    const enemyLayout = ENEMY_LAYOUT_BY_COUNT[enemyKeys.length] ?? ENEMY_LAYOUT_BY_COUNT[1];
    this.enemySlots = enemyKeys.map((key, index) => {
      const definition = ENEMIES[key] ?? ENEMIES.goblin;
      return {
        key,
        definition,
        hp: definition.maxHp,
        mp: definition.maxMp ?? 0,
        x: enemyLayout.enemyX[index],
        alive: true
      };
    });
    this.playerTurn = true;
    this.battleOver = false;
    this.turnOrder = [];
    this.turnIndex = 0;
    this.pendingAdvanceAt = undefined;

    const activeIds = COMPANION_ORDER.filter((id) => hasCompanion(id));
    const layout = ALLY_LAYOUT_BY_COUNT[activeIds.length] ?? ALLY_LAYOUT_BY_COUNT[0];
    this.playerX = layout.playerX;
    this.logY = layout.logY;
    this.allies = activeIds.map((id, index) => ({ id, x: layout.allyX[index] }));

    this.add.rectangle(400, 320, 800, 640, 0x07090d, 0.88);
    this.add.rectangle(400, 324, 660, 456, 0x101923, 0.98).setStrokeStyle(3, 0xd8bc72);
    this.add.rectangle(400, 134, 600, 2, 0xf0d98a, 0.75);
    this.add.text(116, 112, "ターンバトル", this.textStyle(24, "#f6e4a4")).setShadow(2, 2, "#000000", 3);
    this.add.ellipse(this.playerX, 308, 80, 18, 0x05080b, 0.36);
    this.playerSprite = this.add
      .sprite(this.playerX, 258, "player", 0)
      .setOrigin(0.5, getCharacterOriginY("player"))
      .setScale(getCharacterBattleScale("player", 2.6))
      .setDepth(5);
    this.playCharacterIdle(this.playerSprite, "player");

    this.playerHpText = this.add.text(116, 300, "", this.textStyle(17, "#f5f1dc"));
    this.add.rectangle(116, 322, 188, 10, 0x1c2732, 1).setOrigin(0, 0.5);
    this.playerHpFill = this.add.rectangle(118, 322, 184, 6, 0xd95745, 1).setOrigin(0, 0.5);
    this.add.rectangle(116, 322, 188, 10).setStrokeStyle(1, 0xf1d585, 0.8).setOrigin(0, 0.5);

    this.enemySlots.forEach((slot, index) => {
      this.add.ellipse(slot.x, 286, 106, 22, 0x05080b, 0.36);
      slot.sprite = this.add
        .sprite(slot.x, 218, slot.definition.texture, 0)
        .setOrigin(0.5, getCharacterOriginY(slot.definition.texture))
        .setScale(getCharacterBattleScale(slot.definition.texture, 3))
        .setDepth(5);
      this.playCharacterIdle(slot.sprite, slot.definition.texture);

      const rowY = enemyLayout.hpRowY[index];
      slot.hpText = this.add.text(448, rowY + 8, "", this.textStyle(18, "#f5f1dc"));
    });

    this.allies.forEach((ally, index) => {
      const definition = COMPANIONS[ally.id];
      this.add.ellipse(ally.x, 288, 74, 16, 0x05080b, 0.32);
      ally.sprite = this.add
        .sprite(ally.x, 232, definition.texture, 0)
        .setOrigin(0.5, getCharacterOriginY(definition.texture))
        .setScale(getCharacterBattleScale(definition.texture, definition.battleScale))
        .setDepth(4);
      this.playCharacterIdle(ally.sprite, definition.texture);

      const rowY = layout.hpRowY[index];
      ally.hpText = this.add.text(116, rowY, "", this.textStyle(17, "#f5f1dc"));
      this.add.rectangle(116, rowY + 22, 188, 10, 0x1c2732, 1).setOrigin(0, 0.5);
      ally.hpFill = this.add.rectangle(118, rowY + 22, 184, 6, definition.hpBarColor, 1).setOrigin(0, 0.5);
      this.add.rectangle(116, rowY + 22, 188, 10).setStrokeStyle(1, 0xf1d585, 0.8).setOrigin(0, 0.5);
    });

    this.logText = this.add.text(116, this.logY, "", {
      ...this.textStyle(18, "#fff4cf"),
      wordWrap: { width: 568, useAdvancedWrap: true },
      lineSpacing: 8
    });

    this.refreshHud();
    this.setLog(`${this.describeEnemyGroupNames()}が行く手をふさいだ。`);
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

  private getAlly(id: CompanionId): AllySlot | undefined {
    return this.allies.find((ally) => ally.id === id);
  }

  private isAllyActive(id: CompanionId): boolean {
    return this.allies.some((ally) => ally.id === id);
  }

  private enemySlotIndexFromActor(actor: TurnActor): number | undefined {
    return actor.startsWith("enemy-") ? Number(actor.slice("enemy-".length)) : undefined;
  }

  private computeTurnOrder(): TurnActor[] {
    const actors: Array<{ id: TurnActor; speed: number }> = [
      { id: "player", speed: Math.max(1, getPlayerSpeed()) }
    ];
    this.enemySlots.forEach((slot, index) => {
      if (slot.alive) {
        actors.push({ id: `enemy-${index}`, speed: Math.max(1, slot.definition.speed) });
      }
    });
    this.allies.forEach((ally) => {
      if (getCompanionHp(ally.id) > 0) {
        actors.push({ id: ally.id, speed: Math.max(1, getCompanionSpeed(ally.id)) });
      }
    });

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
    if (isCompanionId(actor) && (!this.isAllyActive(actor) || getCompanionHp(actor) <= 0)) {
      this.turnIndex += 1;
      this.resolveCurrentTurn(announce);
      return;
    }

    const enemyIndex = this.enemySlotIndexFromActor(actor);
    if (enemyIndex !== undefined && !this.enemySlots[enemyIndex]?.alive) {
      this.turnIndex += 1;
      this.resolveCurrentTurn(announce);
      return;
    }

    if (this.tickStatusEffectsAndMaybeStun(actor)) {
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
    if (isCompanionId(actor)) {
      this.runAllyTurn(actor);
    } else if (enemyIndex !== undefined) {
      this.runEnemyTurn(enemyIndex);
    }
  }

  private advanceTurn(delayMs: number): void {
    this.turnIndex += 1;
    this.playerTurn = false;
    this.setButtonsEnabled(false);
    this.pendingAdvanceAt = this.time.now + delayMs;
  }

  private actorDisplayName(actor: TurnActor): string {
    if (actor === "player") {
      return "勇者";
    }
    if (isCompanionId(actor)) {
      return COMPANIONS[actor].name;
    }
    const index = this.enemySlotIndexFromActor(actor);
    return index !== undefined ? this.enemySlots[index]?.definition.name ?? "" : "";
  }

  private addStatusEffect(actor: TurnActor, type: StatusEffectType, duration: number): void {
    // Reapplying a status refreshes its duration rather than stacking a
    // second copy — simpler to reason about for the player than tracking
    // multiple independent burn timers on one target.
    const withoutSameType = this.getActorStatusEffects(actor).filter((effect) => effect.type !== type);
    withoutSameType.push({ type, remainingTurns: duration });
    this.statusEffects.set(actor, withoutSameType);
  }

  private getActorStatusEffects(actor: TurnActor): ActiveStatusEffect[] {
    return this.statusEffects.get(actor) ?? [];
  }

  private clearActorStatusEffects(actor: TurnActor): void {
    this.statusEffects.delete(actor);
  }

  private describeActorStatusSuffix(actor: TurnActor): string {
    const effects = this.getActorStatusEffects(actor);
    if (effects.length === 0) {
      return "";
    }
    return ` ${effects.map((effect) => getStatusEffectIcon(effect.type)).join("")}`;
  }

  /** Rolls a skill's optional status-inflict chance against the target it
   * just hit, applies it on success, and returns a log-message fragment (or
   * an empty string on a miss) for the caller to append to its damage line. */
  private maybeInflictStatus(actor: TurnActor, status: StatusInflict | undefined): string {
    if (!status || Math.random() >= status.chance) {
      return "";
    }
    this.addStatusEffect(actor, status.type, status.duration);
    return `${this.actorDisplayName(actor)}は${getStatusEffectName(status.type)}状態になった。`;
  }

  /** Applies one damage-ticking status's per-turn damage to whichever kind
   * of combatant `actor` is, reusing the same damage-application paths as a
   * normal attack (dealDamageToEnemy / damagePlayer / damageCompanion) so
   * HUD/defeat handling stays consistent. */
  private applyStatusTickDamage(
    actor: TurnActor,
    type: StatusEffectType
  ): { message?: string; battleEnded: boolean } {
    const name = this.actorDisplayName(actor);
    const label = getStatusEffectName(type);

    const enemyIndex = this.enemySlotIndexFromActor(actor);
    if (enemyIndex !== undefined) {
      const slot = this.enemySlots[enemyIndex];
      if (!slot?.alive) {
        return { battleEnded: false };
      }
      const damage = getStatusTickDamage(slot.definition.maxHp);
      const { justDefeated, allDefeated } = this.dealDamageToEnemy(enemyIndex, damage, "#c98cff");
      if (allDefeated) {
        this.winBattle(damage);
        return { battleEnded: true };
      }
      return {
        message: justDefeated
          ? `${name}は${label}で${damage}のダメージを受けて倒れた!`
          : `${name}は${label}で${damage}のダメージを受けた。`,
        battleEnded: false
      };
    }

    if (actor === "player") {
      const damage = getStatusTickDamage(getPlayerMaxHp());
      damagePlayer(damage);
      this.showDamageNumber(damage, this.playerX, 190, "#c98cff");
      if (getSave().hp <= 0) {
        this.loseBattle(label, damage);
        return { battleEnded: true };
      }
      return { message: `${name}は${label}で${damage}のダメージを受けた。`, battleEnded: false };
    }

    if (isCompanionId(actor)) {
      const damage = getStatusTickDamage(getCompanionMaxHp(actor));
      damageCompanion(actor, damage);
      const ally = this.getAlly(actor);
      this.showDamageNumber(damage, ally?.x ?? this.playerX, 164, "#c98cff");
      const message =
        getCompanionHp(actor) <= 0
          ? `${name}は${label}で倒れてしまった。`
          : `${name}は${label}で${damage}のダメージを受けた。`;
      return { message, battleEnded: false };
    }

    return { battleEnded: false };
  }

  /**
   * Ticks every active status on `actor` at the start of its turn: applies
   * damage-ticking effects (burn/poison), decrements durations, and — if a
   * stun is active — skips the actor's action entirely. Returns true when
   * the caller (resolveCurrentTurn) should stop, either because the actor
   * was stunned or because a tick ended the battle or defeated the actor.
   */
  private tickStatusEffectsAndMaybeStun(actor: TurnActor): boolean {
    const effects = this.getActorStatusEffects(actor);
    if (effects.length === 0) {
      return false;
    }

    const messages: string[] = [];
    let stunned = false;
    const remaining: ActiveStatusEffect[] = [];

    for (const effect of effects) {
      if (isDamageTickStatus(effect.type)) {
        const applied = this.applyStatusTickDamage(actor, effect.type);
        if (applied.battleEnded) {
          return true;
        }
        if (applied.message) {
          messages.push(applied.message);
        }
      } else if (isStunStatus(effect.type)) {
        stunned = true;
        messages.push(`${this.actorDisplayName(actor)}は${getStatusEffectName(effect.type)}で動けない。`);
      }

      const remainingTurns = effect.remainingTurns - 1;
      if (remainingTurns > 0) {
        remaining.push({ type: effect.type, remainingTurns });
      }
    }

    if (remaining.length > 0) {
      this.statusEffects.set(actor, remaining);
    } else {
      this.statusEffects.delete(actor);
    }

    this.refreshHud();
    if (messages.length > 0) {
      this.setLog(messages.join(" "));
    }

    if (stunned) {
      this.advanceTurn(700);
      return true;
    }

    // A damage tick may have defeated this actor without ending the whole
    // battle (e.g. burn kills one enemy in a group). Skip straight to the
    // next turn instead of letting a dead actor act.
    const enemyIndex = this.enemySlotIndexFromActor(actor);
    const actorNowDead =
      (enemyIndex !== undefined && !this.enemySlots[enemyIndex]?.alive) ||
      (isCompanionId(actor) && getCompanionHp(actor) <= 0);
    if (actorNowDead) {
      this.advanceTurn(300);
      return true;
    }

    return false;
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
          if (
            this.allies.length > 0 &&
            (canItemHealHp(itemId) || canItemRestoreMp(itemId) || canItemCureStatus(itemId))
          ) {
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

    const options = this.getAllyTargetOptions(
      this.playerBenefitsFromItem(itemId),
      (target) => this.useBattleItem(itemId, target),
      (id) => this.companionBenefitsFromItem(id, itemId)
    );
    options.forEach((option, index) => {
      this.createBattleButton(option.label, index, option.run, option.enabled, true);
    });
    this.createBattleButton("戻る", options.length, () => this.showItemActions(), true, true);
  }

  /**
   * Builds the self/ally target button list for the item- and skill-heal
   * target menus, one button per companion actually in the party — works
   * unchanged for 0, 1, 2, or more allies.
   */
  private getAllyTargetOptions(
    selfEnabled: boolean,
    run: (target: "self" | CompanionId) => void,
    allyEnabled: (id: CompanionId) => boolean
  ): Array<{ label: string; enabled: boolean; run: () => void }> {
    const options: Array<{ label: string; enabled: boolean; run: () => void }> = [
      { label: "自分", enabled: selfEnabled, run: () => run("self") }
    ];
    this.allies.forEach((ally) => {
      options.push({
        label: COMPANIONS[ally.id].name,
        enabled: allyEnabled(ally.id),
        run: () => run(ally.id)
      });
    });
    return options;
  }

  private getAliveEnemyIndices(): number[] {
    return this.enemySlots.reduce<number[]>((indices, slot, index) => {
      if (slot.alive) {
        indices.push(index);
      }
      return indices;
    }, []);
  }

  /**
   * With one enemy left standing there's nothing to choose, so the attack
   * resolves immediately just like before groups existed. With more than
   * one alive, show a target picker before resolving.
   */
  private chooseEnemyTargetForPlayer(run: (index: number) => void): void {
    const alive = this.getAliveEnemyIndices();
    if (alive.length === 0) {
      return;
    }
    if (alive.length === 1) {
      run(alive[0]);
      return;
    }

    this.clearButtons();
    this.setLog("どの敵を狙いますか?");
    alive.forEach((enemyIndex, buttonIndex) => {
      const slot = this.enemySlots[enemyIndex];
      this.createBattleButton(slot.definition.name, buttonIndex, () => run(enemyIndex), true, true);
    });
    this.createBattleButton("戻る", alive.length, () => {
      this.renderMainActions();
      this.setLog("あなたの番だ。");
    }, true, true);
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
          if (skill.effect.type === "heal" && this.allies.length > 0) {
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

    const options = this.getAllyTargetOptions(
      getSave().hp < getPlayerMaxHp(),
      (target) => this.useSkill(skill, target),
      (id) => getCompanionHp(id) < getCompanionMaxHp(id)
    );
    options.forEach((option, index) => {
      this.createBattleButton(option.label, index, option.run, option.enabled, true);
    });
    this.createBattleButton("戻る", options.length, () => this.showSkillActions(), true, true);
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

  /**
   * Applies damage to one enemy slot and reports back what happened, so
   * every attacker (player attack, player skill, ally turn) can render its
   * own flavor of log line around the same bookkeeping.
   */
  private dealDamageToEnemy(
    index: number,
    damage: number,
    color: string
  ): { justDefeated: boolean; allDefeated: boolean } {
    const slot = this.enemySlots[index];
    slot.hp = Math.max(0, slot.hp - damage);
    let justDefeated = false;
    if (slot.hp <= 0 && slot.alive) {
      slot.alive = false;
      justDefeated = true;
      this.markEnemySlotDefeated(slot);
      this.clearActorStatusEffects(`enemy-${index}`);
    }

    this.refreshHud();
    this.flashTarget(slot.sprite);
    this.showDamageNumber(damage, slot.x, 146, color);

    return { justDefeated, allDefeated: this.enemySlots.every((other) => !other.alive) };
  }

  private markEnemySlotDefeated(slot: EnemySlot): void {
    slot.sprite?.setTint(0x33363b);
    slot.sprite?.setAlpha(0.35);
  }

  private describeEnemyGroupNames(): string {
    const nameCounts = new Map<string, number>();
    this.enemySlots.forEach((slot) => {
      nameCounts.set(slot.definition.name, (nameCounts.get(slot.definition.name) ?? 0) + 1);
    });
    return Array.from(nameCounts.entries())
      .map(([name, count]) => (count > 1 ? `${name}×${count}` : name))
      .join("、");
  }

  private attack(): void {
    if (!this.playerTurn) {
      return;
    }

    this.chooseEnemyTargetForPlayer((index) => {
      const attack = getPlayerAttack();
      const damage = Phaser.Math.Between(Math.max(2, attack - 2), attack + 3);
      const { justDefeated, allDefeated } = this.dealDamageToEnemy(index, damage, "#ffe08a");

      if (allDefeated) {
        this.winBattle(damage);
        return;
      }

      const defeatedNote = justDefeated ? `${this.enemySlots[index].definition.name}を倒した!` : "";
      this.setLog(`${damage}のダメージを与えた。${defeatedNote}`);
      this.endPlayerTurn();
    });
  }

  private useBattleItem(itemId: ItemId, target: "self" | CompanionId = "self"): void {
    if (!this.playerTurn) {
      return;
    }

    const item = ITEMS[itemId];
    const curedTypes = getItemCuresStatus(itemId);
    if (curedTypes.length > 0) {
      this.useCureItem(itemId, curedTypes, target);
      return;
    }

    if (isCompanionId(target)) {
      const result = useItemOnCompanion(target, itemId);
      if (!result.used) {
        this.setLog(this.getItemFailureMessage(item.name, result.reason));
        this.refreshHud();
        return;
      }

      const ally = this.getAlly(target);
      const name = COMPANIONS[target].name;
      this.refreshHud();
      if (result.healed > 0) {
        this.pulseTarget(ally?.sprite);
        this.showDamageNumber(result.healed, ally?.x ?? this.playerX, 164, "#a5ffb2", "+");
      } else if (result.restoredMp > 0) {
        this.pulseTarget(ally?.sprite);
        this.showDamageNumber(result.restoredMp, ally?.x ?? this.playerX, 164, "#8fc6ff", "+");
      }
      this.setLog(`${item.name}を${name}に使った。${this.describeHealResult(result.healed, result.restoredMp)}`);
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

  private itemCuresActorStatus(itemId: ItemId, actor: TurnActor): boolean {
    const curedTypes = getItemCuresStatus(itemId);
    if (curedTypes.length === 0) {
      return false;
    }
    return this.getActorStatusEffects(actor).some((effect) => curedTypes.includes(effect.type));
  }

  private useCureItem(itemId: ItemId, curedTypes: StatusEffectType[], target: "self" | CompanionId): void {
    const item = ITEMS[itemId];
    const actor: TurnActor = isCompanionId(target) ? target : "player";
    const before = this.getActorStatusEffects(actor);
    const cured = before.filter((effect) => curedTypes.includes(effect.type));

    if (cured.length === 0) {
      this.setLog(`${item.name}を使ったが、治す状態異常がなかった。`);
      return;
    }

    if (!consumeItem(itemId)) {
      this.setLog(this.getItemFailureMessage(item.name, "no-item"));
      return;
    }

    const remaining = before.filter((effect) => !curedTypes.includes(effect.type));
    if (remaining.length > 0) {
      this.statusEffects.set(actor, remaining);
    } else {
      this.statusEffects.delete(actor);
    }

    this.refreshHud();
    const curedNames = cured.map((effect) => getStatusEffectName(effect.type)).join("、");
    this.setLog(
      isCompanionId(target)
        ? `${item.name}を${this.actorDisplayName(actor)}に使った。${curedNames}が治った。`
        : `${item.name}を使った。${curedNames}が治った。`
    );
    this.endPlayerTurn();
  }

  private useSkill(skill: SkillDefinition, healTarget: "self" | CompanionId = "self"): void {
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
      if (isCompanionId(healTarget)) {
        const result = useHealingSkillOnCompanion(healTarget, skill.id);
        const name = COMPANIONS[healTarget].name;
        if (!result.used) {
          this.setLog(result.reason === "full-hp" ? `${name}のHPは満タンだ。` : `${skill.name}を使えなかった。`);
          this.refreshHud();
          return;
        }

        const ally = this.getAlly(healTarget);
        this.refreshHud();
        this.pulseTarget(ally?.sprite);
        this.showDamageNumber(result.healed, ally?.x ?? this.playerX, 164, "#a5ffb2", "+");
        this.setLog(`${skill.name}で${name}のHPを${result.healed}回復した。`);
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

    this.chooseEnemyTargetForPlayer((index) => {
      const damage = this.calculateSkillDamage(skill);
      const { justDefeated, allDefeated } = this.dealDamageToEnemy(index, damage, "#ffe08a");

      if (allDefeated) {
        this.winBattle(damage);
        return;
      }

      const defeatedNote = justDefeated ? `${this.enemySlots[index].definition.name}を倒した!` : "";
      const statusNote = justDefeated
        ? ""
        : this.maybeInflictStatus(`enemy-${index}`, skill.effect.type === "damage" ? skill.effect.status : undefined);
      this.setLog(`${skill.name}！${damage}のダメージを与えた。${defeatedNote}${statusNote}`);
      this.endPlayerTurn();
    });
  }

  private flee(): void {
    if (!this.playerTurn) {
      return;
    }

    if (this.enemySlots.some((slot) => slot.definition.boss)) {
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

  private runAllyTurn(id: CompanionId): void {
    try {
      this.allyTurn(id);
    } catch (error) {
      console.error(error);
      this.advanceTurn(200);
    }
  }

  /**
   * Shared AI for every companion: decideCompanionAction picks the
   * strongest skill that's both affordable and (for heals) actually
   * needed, from that companion's own skill table. Luna's heal-priority
   * behavior and Geist's attack-priority behavior fall out of what kinds
   * of skills each table contains, not from separate code paths here.
   */
  private allyTurn(id: CompanionId): void {
    if (!this.isAllyActive(id) || getCompanionHp(id) <= 0) {
      this.advanceTurn(300);
      return;
    }

    const definition = COMPANIONS[id];
    const skills = definition.getSkills(getSave().level);
    const action = decideCompanionAction(skills, getCompanionMp(id), {
      playerHp: getSave().hp,
      playerMaxHp: getPlayerMaxHp()
    });

    spendCompanionMp(id, action.skill.mpCost);

    if (action.skill.effect.type === "heal") {
      const healed = healPlayer(Math.round(getPlayerMaxHp() * action.skill.effect.healRatio));
      this.refreshHud();
      this.pulseTarget(this.playerSprite);
      this.showDamageNumber(healed, this.playerX, 190, "#c6ffd8", "+");
      this.setLog(`${definition.name}の${action.skill.name}！HPを${healed}回復した。`);
      this.advanceTurn(700);
      return;
    }

    const targetIndex = this.getAliveEnemyIndices()[0];
    if (targetIndex === undefined) {
      this.advanceTurn(300);
      return;
    }

    const baseDamage = Math.round(getCompanionAttack(id) * action.skill.effect.multiplier);
    const damage = Phaser.Math.Between(Math.max(1, baseDamage - 2), baseDamage + 3);
    const { justDefeated, allDefeated } = this.dealDamageToEnemy(targetIndex, damage, definition.hpBarColorHex);

    if (allDefeated) {
      this.winBattle(damage);
      return;
    }

    const defeatedNote = justDefeated ? `${this.enemySlots[targetIndex].definition.name}を倒した!` : "";
    const statusNote = justDefeated
      ? ""
      : this.maybeInflictStatus(`enemy-${targetIndex}`, action.skill.effect.status);
    this.setLog(`${definition.name}の${action.skill.name}！${damage}のダメージを与えた。${defeatedNote}${statusNote}`);
    this.advanceTurn(700);
  }

  private runEnemyTurn(index: number): void {
    try {
      this.enemyTurn(index);
    } catch (error) {
      console.error(error);
      this.pendingAdvanceAt = undefined;
      this.playerTurn = true;
      this.renderMainActions();
      this.setLog("ターン処理を復旧しました。もう一度行動できます。");
    }
  }

  private chooseEnemyTarget(): CompanionId | "player" {
    const activeAllies = this.allies.filter((ally) => getCompanionHp(ally.id) > 0);
    if (activeAllies.length === 0) {
      return "player";
    }

    // Allies share a combined 30% chance to be targeted (matching the
    // original single-companion odds), split evenly across however many
    // are currently in the fight.
    const allyShare = 30 / activeAllies.length;
    const playerShare = 100 - allyShare * activeAllies.length;
    const roll = Phaser.Math.Between(1, 100);
    if (roll <= playerShare) {
      return "player";
    }

    const index = Math.min(activeAllies.length - 1, Math.floor((roll - playerShare) / allyShare));
    return activeAllies[index].id;
  }

  /**
   * Shared AI for every enemy, reusing the exact same priority search as
   * companions (decideCompanionAction): try skills strongest-first, use the
   * strongest one whose MP cost fits the enemy's remaining pool. Most
   * enemies only ever have the free basic attack; bosses and a few elite
   * dungeon enemies (see data/enemySkills.ts) also have a signature move
   * that can inflict a status effect, so they read as an actual opponent
   * rather than a bigger stat block. Enemy MP never regenerates mid-battle,
   * so a boss's special naturally tapers off into basic attacks over a long
   * fight instead of being spammable forever.
   */
  private enemyTurn(index: number): void {
    const slot = this.enemySlots[index];
    const definition = slot.definition;
    const action = decideCompanionAction(getEnemySkills(definition.key), slot.mp, {
      playerHp: getSave().hp,
      playerMaxHp: getPlayerMaxHp()
    });
    slot.mp = Math.max(0, slot.mp - action.skill.mpCost);

    const multiplier = action.skill.effect.type === "attack" ? action.skill.effect.multiplier : 1;
    const status = action.skill.effect.type === "attack" ? action.skill.effect.status : undefined;
    const baseDamage = Math.round(definition.attack * multiplier);
    const rawDamage = Phaser.Math.Between(Math.max(1, baseDamage - 2), baseDamage + 2);
    const attackPrefix =
      action.skill.id === "basicAttack"
        ? `${definition.name}の攻撃。`
        : `${definition.name}の${action.skill.name}！`;
    const target = this.chooseEnemyTarget();

    if (isCompanionId(target)) {
      const ally = this.getAlly(target);
      const allyDefinition = COMPANIONS[target];
      const damage = Math.max(1, rawDamage - getCompanionDefense(target));
      damageCompanion(target, damage);
      const hpLeft = getCompanionHp(target);
      const statusNote = hpLeft > 0 ? this.maybeInflictStatus(target, status) : "";
      this.refreshHud();
      this.flashTarget(ally?.sprite);
      this.showDamageNumber(damage, ally?.x ?? this.playerX, 164, "#ff9a7a");
      this.setLog(
        hpLeft <= 0
          ? `${attackPrefix}${allyDefinition.name}は倒れてしまった。`
          : `${attackPrefix}${allyDefinition.name}が${damage}のダメージを受けた。${statusNote}`
      );
      this.advanceTurn(700);
      return;
    }

    const damage = Math.max(1, rawDamage - getPlayerDefense());
    damagePlayer(damage);
    this.flashTarget(this.playerSprite);
    this.showDamageNumber(damage, this.playerX, 190, "#ff9a7a");

    if (getSave().hp <= 0) {
      this.refreshHud();
      this.loseBattle(definition.name, damage);
      return;
    }

    const statusNote = this.maybeInflictStatus("player", status);
    this.refreshHud();
    this.setLog(`${attackPrefix}${damage}のダメージを受けた。${statusNote}`);
    this.advanceTurn(700);
  }

  private winBattle(lastDamage: number): void {
    this.battleOver = true;
    this.pendingAdvanceAt = undefined;
    markEnemyDefeated(this.enemyInstanceId);
    const totalExp = this.enemySlots.reduce((sum, slot) => sum + slot.definition.exp, 0);
    const totalGold = this.enemySlots.reduce((sum, slot) => sum + slot.definition.gold, 0);
    const reward = grantReward(totalExp, totalGold);
    const learnedText =
      reward.learnedSkillIds.length > 0
        ? ` ${reward.learnedSkillIds.map((skillId) => SKILLS[skillId].name).join("、")}を覚えた！`
        : "";
    const levelText = reward.leveledUp ? ` レベルアップ！${learnedText}` : "";
    this.setLog(
      `${lastDamage}のダメージを与えた。${this.describeEnemyGroupNames()}を倒した。EXP +${totalExp}、G +${totalGold}。${levelText}`
    );
    this.refreshHud();
    this.game.events.emit(GAME_EVENTS.stateChanged);
    this.setButtonsEnabled(false);
    this.time.delayedCall(1200, () => this.closeBattle("勝利"));
  }

  private loseBattle(attackerName: string, lastDamage: number): void {
    this.battleOver = true;
    this.pendingAdvanceAt = undefined;
    const save = getSave();
    save.hp = Math.ceil(getPlayerMaxHp() * 0.6);
    save.mp = Math.ceil(getPlayerMaxMp() * 0.5);
    save.gold = Math.floor(save.gold * 0.8);
    persistSave();
    this.setLog(
      `${attackerName}の攻撃。${lastDamage}のダメージを受けた。気がつくとストーンブルック村に戻っていた。`
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

  private getEnemyHpColor(slot: EnemySlot): string {
    const ratio = slot.hp / slot.definition.maxHp;
    if (ratio > 0.6) {
      return ENEMY_HP_COLOR_HEALTHY;
    }
    if (ratio > 0.3) {
      return ENEMY_HP_COLOR_HURT;
    }
    return ENEMY_HP_COLOR_CRITICAL;
  }

  private refreshHud(): void {
    const save = getSave();
    const maxHp = getPlayerMaxHp();
    const maxMp = getPlayerMaxMp();
    this.playerHpText?.setText(
      `勇者 HP ${save.hp}/${maxHp}  MP ${save.mp}/${maxMp}  道具 ${getTotalItemCount()}${this.describeActorStatusSuffix("player")}`
    );
    this.playerHpFill?.setDisplaySize(184 * Phaser.Math.Clamp(save.hp / maxHp, 0, 1), 6);

    this.enemySlots.forEach((slot, index) => {
      const suffix = this.describeActorStatusSuffix(`enemy-${index}`);
      slot.hpText?.setText(`${slot.definition.name}${suffix}`).setColor(this.getEnemyHpColor(slot));
    });

    this.allies.forEach((ally) => {
      const definition = COMPANIONS[ally.id];
      const allyMaxHp = getCompanionMaxHp(ally.id);
      const allyMaxMp = getCompanionMaxMp(ally.id);
      const allyHp = getCompanionHp(ally.id);
      const allyMp = getCompanionMp(ally.id);
      const suffix = this.describeActorStatusSuffix(ally.id);
      ally.hpText?.setText(`${definition.name} HP ${allyHp}/${allyMaxHp}  MP ${allyMp}/${allyMaxMp}${suffix}`);
      ally.hpFill?.setDisplaySize(184 * Phaser.Math.Clamp(allyHp / allyMaxHp, 0, 1), 6);
    });
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

    const baseDamage = Math.round(getPlayerAttack() * skill.effect.multiplier + skill.effect.bonus);
    return Phaser.Math.Between(Math.max(2, baseDamage - 3), baseDamage + 4);
  }

  private canUseBattleItem(itemId: ItemId): boolean {
    if (getItemCount(itemId) <= 0) {
      return false;
    }

    return (
      this.playerBenefitsFromItem(itemId) ||
      this.allies.some((ally) => this.companionBenefitsFromItem(ally.id, itemId))
    );
  }

  private playerBenefitsFromItem(itemId: ItemId): boolean {
    const save = getSave();
    return (
      (canItemHealHp(itemId) && save.hp < getPlayerMaxHp()) ||
      (canItemRestoreMp(itemId) && save.mp < getPlayerMaxMp()) ||
      this.itemCuresActorStatus(itemId, "player")
    );
  }

  private companionBenefitsFromItem(id: CompanionId, itemId: ItemId): boolean {
    return (
      (canItemHealHp(itemId) && getCompanionHp(id) < getCompanionMaxHp(id)) ||
      (canItemRestoreMp(itemId) && getCompanionMp(id) < getCompanionMaxMp(id)) ||
      this.itemCuresActorStatus(itemId, id)
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
