import type { EnemyDefinition } from "../game/types";

export const ENEMIES: Record<string, EnemyDefinition> = {
  slime: {
    key: "slime",
    name: "草原スライム",
    maxHp: 16,
    attack: 4,
    exp: 4,
    gold: 3,
    texture: "enemy-slime"
  },
  goblin: {
    key: "goblin",
    name: "洞窟ゴブリン",
    maxHp: 24,
    attack: 6,
    exp: 7,
    gold: 6,
    texture: "enemy-goblin"
  },
  guardian: {
    key: "guardian",
    name: "太陽石の守護者",
    maxHp: 38,
    attack: 8,
    exp: 14,
    gold: 16,
    texture: "enemy-guardian",
    boss: true
  }
};
