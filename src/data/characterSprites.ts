import type { Direction } from "../game/types";

export type CharacterSpriteRole = "humanoid" | "creature";

export interface CharacterSpriteDefinition {
  key: string;
  path: string;
  frameWidth: 32 | 48;
  frameHeight: 32 | 48;
  role: CharacterSpriteRole;
  battleScale: number;
}

export const CHARACTER_DIRECTIONS: Direction[] = ["down", "left", "right", "up"];

export const CHARACTER_DIRECTION_ROWS: Record<Direction, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3
};

export const CHARACTER_SPRITES: CharacterSpriteDefinition[] = [
  {
    key: "player",
    path: "assets/characters/player.png",
    frameWidth: 48,
    frameHeight: 48,
    role: "humanoid",
    battleScale: 1.9
  },
  {
    key: "npc-elder",
    path: "assets/characters/npc-elder.png",
    frameWidth: 48,
    frameHeight: 48,
    role: "humanoid",
    battleScale: 1.9
  },
  {
    key: "npc-healer",
    path: "assets/characters/npc-healer.png",
    frameWidth: 48,
    frameHeight: 48,
    role: "humanoid",
    battleScale: 1.9
  },
  {
    key: "npc-shopkeeper",
    path: "assets/characters/npc-shopkeeper.png",
    frameWidth: 48,
    frameHeight: 48,
    role: "humanoid",
    battleScale: 1.9
  },
  {
    key: "npc-armorer",
    path: "assets/characters/npc-armorer.png",
    frameWidth: 48,
    frameHeight: 48,
    role: "humanoid",
    battleScale: 1.9
  },
  {
    key: "enemy-slime",
    path: "assets/characters/enemy-slime.png",
    frameWidth: 32,
    frameHeight: 32,
    role: "creature",
    battleScale: 3
  },
  {
    key: "enemy-goblin",
    path: "assets/characters/enemy-goblin.png",
    frameWidth: 32,
    frameHeight: 32,
    role: "creature",
    battleScale: 3
  },
  {
    key: "enemy-bat",
    path: "assets/characters/enemy-bat.png",
    frameWidth: 32,
    frameHeight: 32,
    role: "creature",
    battleScale: 3
  },
  {
    key: "enemy-skeleton",
    path: "assets/characters/enemy-skeleton.png",
    frameWidth: 32,
    frameHeight: 32,
    role: "creature",
    battleScale: 3
  },
  {
    key: "enemy-wolf",
    path: "assets/characters/enemy-wolf.png",
    frameWidth: 32,
    frameHeight: 32,
    role: "creature",
    battleScale: 3
  },
  {
    key: "enemy-mage",
    path: "assets/characters/enemy-mage.png",
    frameWidth: 32,
    frameHeight: 32,
    role: "creature",
    battleScale: 3
  },
  {
    key: "enemy-mimic",
    path: "assets/characters/enemy-mimic.png",
    frameWidth: 32,
    frameHeight: 32,
    role: "creature",
    battleScale: 3
  },
  {
    key: "enemy-guardian",
    path: "assets/characters/enemy-guardian.png",
    frameWidth: 48,
    frameHeight: 48,
    role: "creature",
    battleScale: 2.15
  },
  {
    key: "enemy-deep-guardian",
    path: "assets/characters/enemy-deep-guardian.png",
    frameWidth: 48,
    frameHeight: 48,
    role: "creature",
    battleScale: 2.15
  },
  {
    key: "enemy-eclipse-beast",
    path: "assets/characters/enemy-eclipse-beast.png",
    frameWidth: 48,
    frameHeight: 48,
    role: "creature",
    battleScale: 2.15
  },
  {
    key: "enemy-mist-sovereign",
    path: "assets/characters/enemy-mist-sovereign.png",
    frameWidth: 48,
    frameHeight: 48,
    role: "creature",
    battleScale: 2.15
  },
  {
    key: "companion-luna",
    path: "assets/characters/companion-luna.png",
    frameWidth: 48,
    frameHeight: 48,
    role: "humanoid",
    battleScale: 1.9
  },
  {
    key: "companion-geist",
    path: "assets/characters/companion-geist.png",
    frameWidth: 48,
    frameHeight: 48,
    role: "humanoid",
    battleScale: 1.9
  }
];

export function getCharacterSpriteDefinition(
  key: string
): CharacterSpriteDefinition | undefined {
  return CHARACTER_SPRITES.find((sprite) => sprite.key === key);
}

export function getCharacterIdleAnimationKey(key: string, direction: Direction = "down"): string {
  return `${key}-idle-${direction}`;
}

export function getCharacterWalkAnimationKey(key: string, direction: Direction): string {
  return `${key}-walk-${direction}`;
}

export function getCharacterBattleScale(key: string, fallback: number): number {
  return getCharacterSpriteDefinition(key)?.battleScale ?? fallback;
}

export function getCharacterOriginY(key: string): number {
  return (getCharacterSpriteDefinition(key)?.frameHeight ?? 32) > 32 ? 0.68 : 0.5;
}
