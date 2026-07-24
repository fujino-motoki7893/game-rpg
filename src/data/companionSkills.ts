import type { CompanionSkillEffect } from "./companions";

export type CompanionSkillId = "magicBolt" | "healingLight" | "greaterHealingLight";

export interface CompanionSkillDefinition {
  id: CompanionSkillId;
  name: string;
  requiredLevel: number;
  mpCost: number;
  description: string;
  effect: CompanionSkillEffect;
}

export const COMPANION_SKILL_ORDER: CompanionSkillId[] = [
  "magicBolt",
  "healingLight",
  "greaterHealingLight"
];

export const COMPANION_SKILLS: Record<CompanionSkillId, CompanionSkillDefinition> = {
  magicBolt: {
    id: "magicBolt",
    name: "魔法弾",
    requiredLevel: 1,
    mpCost: 0,
    description: "通常攻撃として敵にダメージを与える",
    effect: { type: "attack", multiplier: 1 }
  },
  healingLight: {
    id: "healingLight",
    name: "回復魔法",
    requiredLevel: 3,
    mpCost: 4,
    description: "仲間のHPが40%未満のとき自動で発動する",
    effect: { type: "heal", healRatio: 0.35, triggerRatio: 0.4 }
  },
  greaterHealingLight: {
    id: "greaterHealingLight",
    name: "大回復魔法",
    requiredLevel: 5,
    mpCost: 8,
    description: "仲間のHPが50%未満のとき自動で発動する強力な回復",
    effect: { type: "heal", healRatio: 0.55, triggerRatio: 0.5 }
  }
};

export function getCompanionSkillsForLevel(level: number): CompanionSkillDefinition[] {
  return COMPANION_SKILL_ORDER.filter(
    (skillId) => COMPANION_SKILLS[skillId].requiredLevel <= level
  ).map((skillId) => COMPANION_SKILLS[skillId]);
}
