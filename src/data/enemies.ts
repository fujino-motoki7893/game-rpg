import type { EnemyDefinition } from "../game/types";

export const ENEMIES: Record<string, EnemyDefinition> = {
  slime: {
    key: "slime",
    name: "Meadow Slime",
    maxHp: 16,
    attack: 4,
    exp: 4,
    gold: 3,
    texture: "enemy-slime"
  },
  goblin: {
    key: "goblin",
    name: "Cave Goblin",
    maxHp: 24,
    attack: 6,
    exp: 7,
    gold: 6,
    texture: "enemy-goblin"
  },
  guardian: {
    key: "guardian",
    name: "Relic Guardian",
    maxHp: 38,
    attack: 8,
    exp: 14,
    gold: 16,
    texture: "enemy-guardian",
    boss: true
  }
};
