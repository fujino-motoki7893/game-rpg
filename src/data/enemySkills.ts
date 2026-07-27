import type { CompanionSkillEffect } from "./companions";

export interface EnemySkillDefinition {
  id: string;
  name: string;
  mpCost: number;
  effect: CompanionSkillEffect;
}

// Every enemy implicitly has this free basic attack as a fallback, so
// decideCompanionAction always has something affordable once an enemy's MP
// (see ENEMIES[key].maxMp) runs out.
const BASIC_ATTACK: EnemySkillDefinition = {
  id: "basicAttack",
  name: "攻撃",
  mpCost: 0,
  effect: { type: "attack", multiplier: 1 }
};

/**
 * Only the enemies worth making tactically distinct get a signature skill
 * on top of the basic attack — the four tier bosses (themed to match their
 * dungeon's wall accent: ember/crystal/rune/mist, see dungeonGenerator.ts)
 * and the tier 1-3 "elite" dungeon enemies. Common trash mobs (slime,
 * goblin, bat, skeleton, wolf, mage, mimic) are left with only the basic
 * attack — this is deliberately not "every enemy gets a kit", just enough
 * to turn the fights that matter into more than a bigger stat block.
 */
const ENEMY_SKILLS: Partial<Record<string, EnemySkillDefinition[]>> = {
  orc: [
    BASIC_ATTACK,
    {
      id: "recklessCharge",
      name: "猛進突撃",
      mpCost: 4,
      effect: { type: "attack", multiplier: 1.4, status: { type: "stun", chance: 0.35, duration: 1 } }
    }
  ],
  direWolf: [
    BASIC_ATTACK,
    {
      id: "fangFlurry",
      name: "牙の連撃",
      mpCost: 4,
      effect: { type: "attack", multiplier: 1.4, status: { type: "poison", chance: 0.4, duration: 2 } }
    }
  ],
  darkMage: [
    BASIC_ATTACK,
    {
      id: "darkCurse",
      name: "闇の呪詛",
      mpCost: 5,
      effect: { type: "attack", multiplier: 1.35, status: { type: "poison", chance: 0.45, duration: 2 } }
    }
  ],
  stoneGolem: [
    BASIC_ATTACK,
    {
      id: "crushingBlow",
      name: "岩砕の一撃",
      mpCost: 5,
      effect: { type: "attack", multiplier: 1.5, status: { type: "stun", chance: 0.4, duration: 1 } }
    }
  ],
  guardian: [
    BASIC_ATTACK,
    {
      id: "scorchingStrike",
      name: "灼熱の一撃",
      mpCost: 6,
      effect: { type: "attack", multiplier: 1.5, status: { type: "burn", chance: 0.5, duration: 3 } }
    }
  ],
  deepGuardian: [
    BASIC_ATTACK,
    {
      id: "freezingStrike",
      name: "凍結の一撃",
      mpCost: 7,
      effect: { type: "attack", multiplier: 1.5, status: { type: "stun", chance: 0.4, duration: 1 } }
    }
  ],
  eclipseBeast: [
    BASIC_ATTACK,
    {
      id: "cursedClaw",
      name: "呪縛の爪",
      mpCost: 8,
      effect: { type: "attack", multiplier: 1.6, status: { type: "poison", chance: 0.5, duration: 3 } }
    }
  ],
  mistSovereign: [
    BASIC_ATTACK,
    {
      id: "miasmaBlast",
      name: "深霧の一撃",
      mpCost: 10,
      effect: { type: "attack", multiplier: 1.8, status: { type: "poison", chance: 0.55, duration: 3 } }
    }
  ]
};

export function getEnemySkills(key: string): EnemySkillDefinition[] {
  return ENEMY_SKILLS[key] ?? [BASIC_ATTACK];
}
