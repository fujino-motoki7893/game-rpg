import type { EnemyDefinition } from "../game/types";

export const DUNGEON_ENEMY_KEYS = [
  "goblin",
  "bat",
  "skeleton",
  "wolf",
  "mage",
  "mimic",
  "orc",
  "direWolf",
  "darkMage",
  "stoneGolem"
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
    speed: 4,
    exp: 4,
    gold: 3,
    texture: "enemy-slime"
  },
  goblin: {
    key: "goblin",
    name: "洞窟ゴブリン",
    maxHp: 24,
    attack: 6,
    speed: 7,
    exp: 7,
    gold: 6,
    texture: "enemy-goblin"
  },
  bat: {
    key: "bat",
    name: "影コウモリ",
    maxHp: 18,
    attack: 5,
    speed: 12,
    exp: 5,
    gold: 4,
    texture: "enemy-bat"
  },
  skeleton: {
    key: "skeleton",
    name: "古びた骸骨兵",
    maxHp: 28,
    attack: 7,
    speed: 5,
    exp: 8,
    gold: 7,
    texture: "enemy-skeleton"
  },
  wolf: {
    key: "wolf",
    name: "洞窟狼",
    maxHp: 22,
    attack: 8,
    speed: 11,
    exp: 8,
    gold: 5,
    texture: "enemy-wolf"
  },
  mage: {
    key: "mage",
    name: "見習い呪術師",
    maxHp: 20,
    attack: 9,
    speed: 6,
    exp: 10,
    gold: 9,
    texture: "enemy-mage"
  },
  mimic: {
    key: "mimic",
    name: "宝箱ミミック",
    maxHp: 32,
    attack: 8,
    speed: 3,
    exp: 12,
    gold: 14,
    texture: "enemy-mimic"
  },
  orc: {
    key: "orc",
    name: "草原オーク",
    maxHp: 36,
    attack: 10,
    speed: 6,
    exp: 14,
    gold: 10,
    texture: "enemy-goblin"
  },
  direWolf: {
    key: "direWolf",
    name: "牙狼",
    maxHp: 34,
    attack: 12,
    speed: 13,
    exp: 15,
    gold: 11,
    texture: "enemy-wolf"
  },
  darkMage: {
    key: "darkMage",
    name: "黒衣の呪術師",
    maxHp: 30,
    attack: 13,
    speed: 7,
    exp: 17,
    gold: 14,
    texture: "enemy-mage"
  },
  stoneGolem: {
    key: "stoneGolem",
    name: "石甲ゴーレム",
    maxHp: 46,
    attack: 11,
    speed: 3,
    exp: 18,
    gold: 15,
    texture: "enemy-guardian"
  },
  guardian: {
    key: "guardian",
    name: "太陽石の守護者",
    maxHp: 38,
    attack: 8,
    speed: 8,
    exp: 14,
    gold: 16,
    texture: "enemy-guardian",
    boss: true
  },
  deepGuardian: {
    key: "deepGuardian",
    name: "月影石の守護者",
    maxHp: 64,
    attack: 13,
    speed: 9,
    exp: 28,
    gold: 32,
    texture: "enemy-guardian",
    boss: true
  },
  eclipseBeast: {
    key: "eclipseBeast",
    name: "月蝕の魔獣",
    maxHp: 95,
    attack: 17,
    speed: 12,
    exp: 45,
    gold: 60,
    texture: "enemy-guardian",
    boss: true
  }
};
