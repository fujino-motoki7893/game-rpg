export type Companion2SkillId = "ironFist" | "heavyBlow" | "crushingSlam";

export type Companion2SkillEffect = { type: "attack"; multiplier: number };

export interface Companion2SkillDefinition {
  id: Companion2SkillId;
  name: string;
  requiredLevel: number;
  mpCost: number;
  description: string;
  effect: Companion2SkillEffect;
}

export const COMPANION2_SKILL_ORDER: Companion2SkillId[] = ["ironFist", "heavyBlow", "crushingSlam"];

export const COMPANION2_SKILLS: Record<Companion2SkillId, Companion2SkillDefinition> = {
  ironFist: {
    id: "ironFist",
    name: "鉄拳",
    requiredLevel: 1,
    mpCost: 0,
    description: "通常攻撃として敵にダメージを与える",
    effect: { type: "attack", multiplier: 1 }
  },
  heavyBlow: {
    id: "heavyBlow",
    name: "重撃",
    requiredLevel: 3,
    mpCost: 3,
    description: "MPを消費して強力な一撃を放つ",
    effect: { type: "attack", multiplier: 1.6 }
  },
  crushingSlam: {
    id: "crushingSlam",
    name: "粉砕撃",
    requiredLevel: 5,
    mpCost: 6,
    description: "MPを消費してさらに強力な一撃を放つ",
    effect: { type: "attack", multiplier: 2.2 }
  }
};

export function getCompanion2SkillsForLevel(level: number): Companion2SkillDefinition[] {
  return COMPANION2_SKILL_ORDER.filter(
    (skillId) => COMPANION2_SKILLS[skillId].requiredLevel <= level
  ).map((skillId) => COMPANION2_SKILLS[skillId]);
}
