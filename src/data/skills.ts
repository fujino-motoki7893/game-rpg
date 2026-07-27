import type { StatusInflict } from "./statusEffects";

export type SkillId = "flameSlash" | "heal" | "thunderThrust" | "greaterHeal";

export type SkillEffect =
  | {
      type: "damage";
      multiplier: number;
      bonus: number;
      /** Chance to also inflict a status effect on the target. */
      status?: StatusInflict;
    }
  | {
      type: "heal";
      amount?: number;
      ratio?: number;
    };

export interface SkillDefinition {
  id: SkillId;
  name: string;
  requiredLevel: number;
  mpCost: number;
  description: string;
  effect: SkillEffect;
}

export const SKILL_ORDER: SkillId[] = ["flameSlash", "heal", "thunderThrust", "greaterHeal"];

export const SKILLS: Record<SkillId, SkillDefinition> = {
  flameSlash: {
    id: "flameSlash",
    name: "火炎切り",
    requiredLevel: 2,
    mpCost: 4,
    description: "炎をまとった斬撃で大ダメージ。時々火傷を負わせる",
    effect: {
      type: "damage",
      multiplier: 1.35,
      bonus: 4,
      status: { type: "burn", chance: 0.5, duration: 3 }
    }
  },
  heal: {
    id: "heal",
    name: "回復魔法",
    requiredLevel: 3,
    mpCost: 5,
    description: "HPを24回復",
    effect: { type: "heal", amount: 24 }
  },
  thunderThrust: {
    id: "thunderThrust",
    name: "雷鳴突き",
    requiredLevel: 4,
    mpCost: 7,
    description: "雷をまとった突きで大ダメージ。時々敵をしびれさせる",
    effect: {
      type: "damage",
      multiplier: 1.65,
      bonus: 6,
      status: { type: "stun", chance: 0.35, duration: 1 }
    }
  },
  greaterHeal: {
    id: "greaterHeal",
    name: "大回復魔法",
    requiredLevel: 5,
    mpCost: 10,
    description: "HPを最大値の60%回復",
    effect: { type: "heal", ratio: 0.6 }
  }
};

export function isSkillId(value: unknown): value is SkillId {
  return typeof value === "string" && SKILL_ORDER.includes(value as SkillId);
}

export function getSkillIdsForLevel(level: number): SkillId[] {
  return SKILL_ORDER.filter((skillId) => SKILLS[skillId].requiredLevel <= level);
}

export function getSkillsForLevel(level: number): SkillDefinition[] {
  return getSkillIdsForLevel(level).map((skillId) => SKILLS[skillId]);
}

export function getSkillIdsLearnedAtLevel(level: number): SkillId[] {
  return SKILL_ORDER.filter((skillId) => SKILLS[skillId].requiredLevel === level);
}

export function getSkillHealAmount(skill: SkillDefinition, maxHp: number): number {
  if (skill.effect.type !== "heal") {
    return 0;
  }

  if (skill.effect.amount !== undefined) {
    return skill.effect.amount;
  }

  return Math.ceil(maxHp * (skill.effect.ratio ?? 0));
}
