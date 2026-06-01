import type { EnemyDefinition } from "../game/types";

export const DUNGEON_ENEMY_KEYS = [
  "goblin",
  "bat",
  "skeleton",
  "wolf",
  "mage",
  "mimic"
] as const;

export type DungeonEnemyKey = (typeof DUNGEON_ENEMY_KEYS)[number];

export function isDungeonEnemyKey(value: unknown): value is DungeonEnemyKey {
  return typeof value === "string" && DUNGEON_ENEMY_KEYS.includes(value as DungeonEnemyKey);
}

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
  bat: {
    key: "bat",
    name: "影コウモリ",
    maxHp: 18,
    attack: 5,
    exp: 5,
    gold: 4,
    texture: "enemy-bat"
  },
  skeleton: {
    key: "skeleton",
    name: "古びた骸骨兵",
    maxHp: 28,
    attack: 7,
    exp: 8,
    gold: 7,
    texture: "enemy-skeleton"
  },
  wolf: {
    key: "wolf",
    name: "洞窟狼",
    maxHp: 22,
    attack: 8,
    exp: 8,
    gold: 5,
    texture: "enemy-wolf"
  },
  mage: {
    key: "mage",
    name: "見習い呪術師",
    maxHp: 20,
    attack: 9,
    exp: 10,
    gold: 9,
    texture: "enemy-mage"
  },
  mimic: {
    key: "mimic",
    name: "宝箱ミミック",
    maxHp: 32,
    attack: 8,
    exp: 12,
    gold: 14,
    texture: "enemy-mimic"
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
