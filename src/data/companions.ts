import { COMPANION_SKILL_ORDER, COMPANION_SKILLS, getCompanionSkillsForLevel } from "./companionSkills";
import { COMPANION2_SKILL_ORDER, COMPANION2_SKILLS, getCompanion2SkillsForLevel } from "./companion2Skills";
import type { StatusInflict } from "./statusEffects";

/**
 * Adding a new companion means: add its id here, add one entry to
 * COMPANIONS below, and give it a skill table (a heal-type kit like
 * companionSkills.ts, an attack-type kit like companion2Skills.ts, or a
 * new shape entirely — decideCompanionAction only cares about "heal" vs
 * "attack" effects). Everything else (save data, battle turn/HUD/targeting,
 * menu tabs, shop comparisons, world-map following) is driven off this list
 * generically.
 */
export type CompanionId = "luna" | "geist";
export const COMPANION_ORDER: CompanionId[] = ["luna", "geist"];

export function isCompanionId(value: unknown): value is CompanionId {
  return value === "luna" || value === "geist";
}

export type CompanionSkillEffect =
  | { type: "heal"; healRatio: number; triggerRatio: number }
  | { type: "attack"; multiplier: number; status?: StatusInflict };

export interface CompanionSkillDefinition {
  id: string;
  name: string;
  requiredLevel: number;
  mpCost: number;
  description: string;
  effect: CompanionSkillEffect;
}

export interface CompanionStatFormulas {
  maxHp: (level: number) => number;
  maxMp: (level: number) => number;
  attack: (level: number) => number;
  defense: (level: number) => number;
  speed: (level: number) => number;
}

export interface CompanionDefinition {
  id: CompanionId;
  name: string;
  texture: string;
  /** Save flag that gates hasCompanion()/party membership. */
  joinedFlag: string;
  /** HP bar fill color (Phaser numeric) and matching text color (CSS hex). */
  hpBarColor: number;
  hpBarColorHex: string;
  battleScale: number;
  formulas: CompanionStatFormulas;
  /** Shown on the menu's per-companion skill tab, under the skill list. */
  behaviorDescription: string;
  /** Skills currently usable in battle at this level (used by the AI). */
  getSkills: (level: number) => CompanionSkillDefinition[];
  /** The full skill list regardless of level, for the menu's skill tab (locked ones show their unlock level). */
  getAllSkills: () => CompanionSkillDefinition[];
}

export const COMPANIONS: Record<CompanionId, CompanionDefinition> = {
  luna: {
    id: "luna",
    name: "ルナ",
    texture: "companion-luna",
    joinedFlag: "companionJoined",
    hpBarColor: 0xb28aff,
    hpBarColorHex: "#b28aff",
    battleScale: 2.3,
    formulas: {
      maxHp: (level) => 20 + level * 5,
      maxMp: (level) => 14 + level * 4,
      attack: (level) => 3 + level * 2,
      defense: () => 0,
      speed: (level) => 6 + level
    },
    behaviorDescription: "ルナは戦闘中、状況に応じて自動でこれらの行動を行う。",
    getSkills: getCompanionSkillsForLevel,
    getAllSkills: () => COMPANION_SKILL_ORDER.map((id) => COMPANION_SKILLS[id])
  },
  geist: {
    id: "geist",
    name: "ガイスト",
    texture: "companion-geist",
    joinedFlag: "companion2Joined",
    hpBarColor: 0xd6a15a,
    hpBarColorHex: "#d6a15a",
    battleScale: 2.15,
    formulas: {
      maxHp: (level) => 28 + level * 6,
      maxMp: (level) => 6 + level,
      attack: (level) => 6 + level * 3,
      defense: (level) => 4 + level * 2,
      speed: (level) => 4 + level
    },
    behaviorDescription: "ガイストは戦闘中、MPが十分なときほど強力な一撃を選んで放つ。",
    getSkills: getCompanion2SkillsForLevel,
    getAllSkills: () => COMPANION2_SKILL_ORDER.map((id) => COMPANION2_SKILLS[id])
  }
};

export function getCompanionDefinition(id: CompanionId): CompanionDefinition {
  return COMPANIONS[id];
}

export interface CompanionActionContext {
  playerHp: number;
  playerMaxHp: number;
}

/** The minimal shape decideCompanionAction's search actually needs — kept
 * separate from CompanionSkillDefinition so enemies can reuse the same AI
 * with their own skill definition type (see data/enemySkills.ts) without
 * having to fake companion-specific fields like requiredLevel. */
export interface BattleSkillLike {
  mpCost: number;
  effect: CompanionSkillEffect;
}

export type CompanionAction<T extends BattleSkillLike = CompanionSkillDefinition> =
  | { kind: "heal"; skill: T }
  | { kind: "attack"; skill: T };

/**
 * Shared battle AI for every companion (and, via the same function, every
 * enemy — see BattleScene's enemyTurn): try skills strongest-first. A heal
 * fires once its MP cost is affordable and its trigger condition is met;
 * otherwise fall through to the strongest affordable attack skill. This
 * covers Luna ("heal unless the player doesn't need it"), Geist ("always
 * attack, favor the strongest affordable hit"), and enemies ("always
 * attack, favor the strongest affordable hit") as one priority search,
 * since the difference is entirely in which effect types a skill table
 * contains.
 */
export function decideCompanionAction<T extends BattleSkillLike>(
  skillsWeakestFirst: T[],
  currentMp: number,
  context: CompanionActionContext
): CompanionAction<T> {
  const skillsStrongestFirst = [...skillsWeakestFirst].reverse();
  for (const skill of skillsStrongestFirst) {
    if (skill.effect.type === "heal") {
      if (
        currentMp >= skill.mpCost &&
        context.playerHp > 0 &&
        context.playerHp < context.playerMaxHp * skill.effect.triggerRatio
      ) {
        return { kind: "heal", skill };
      }
    } else if (currentMp >= skill.mpCost) {
      return { kind: "attack", skill };
    }
  }

  // Every companion's cheapest skill costs 0 MP, so this path is
  // unreachable in practice; kept as a defensive fallback.
  return { kind: "attack", skill: skillsWeakestFirst[0] };
}
