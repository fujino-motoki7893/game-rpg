import { SAVE_KEY } from "./constants";
import type { GameSave, MapDefinition, MapId } from "./types";

export const initialSave = (): GameSave => ({
  mapId: "village",
  x: 9,
  y: 6,
  hp: 30,
  maxHp: 30,
  attack: 7,
  level: 1,
  exp: 0,
  gold: 0,
  potions: 2,
  flags: {},
  defeatedEnemies: []
});

let save: GameSave = loadSave();

function loadSave(): GameSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return initialSave();
    }

    const parsed = JSON.parse(raw) as Partial<GameSave>;
    return {
      ...initialSave(),
      ...parsed,
      flags: parsed.flags ?? {},
      defeatedEnemies: parsed.defeatedEnemies ?? []
    };
  } catch {
    return initialSave();
  }
}

export function getSave(): GameSave {
  return save;
}

export function persistSave(): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function resetSave(): GameSave {
  save = initialSave();
  persistSave();
  return save;
}

export function getGeneratedDungeon(): MapDefinition | undefined {
  return save.generatedDungeon;
}

export function setGeneratedDungeon(dungeon: MapDefinition): void {
  save.generatedDungeon = dungeon;
  persistSave();
}

export function setPlayerPosition(mapId: MapId, x: number, y: number): void {
  save.mapId = mapId;
  save.x = x;
  save.y = y;
  persistSave();
}

export function healPlayer(amount: number): number {
  const before = save.hp;
  save.hp = Math.min(save.maxHp, save.hp + amount);
  persistSave();
  return save.hp - before;
}

export function damagePlayer(amount: number): void {
  save.hp = Math.max(0, save.hp - amount);
  persistSave();
}

export function usePotion(): boolean {
  if (save.potions <= 0 || save.hp >= save.maxHp) {
    return false;
  }

  save.potions -= 1;
  healPlayer(16);
  persistSave();
  return true;
}

export function markFlag(flag: string): void {
  save.flags[flag] = true;
  persistSave();
}

export function hasFlag(flag: string): boolean {
  return Boolean(save.flags[flag]);
}

export function markEnemyDefeated(enemyId: string): void {
  if (!save.defeatedEnemies.includes(enemyId)) {
    save.defeatedEnemies.push(enemyId);
  }
  persistSave();
}

export function isEnemyDefeated(enemyId: string): boolean {
  return save.defeatedEnemies.includes(enemyId);
}

export function grantReward(exp: number, gold: number): { leveledUp: boolean } {
  save.exp += exp;
  save.gold += gold;

  let leveledUp = false;
  while (save.exp >= save.level * 12) {
    save.exp -= save.level * 12;
    save.level += 1;
    save.maxHp += 6;
    save.attack += 2;
    save.hp = save.maxHp;
    leveledUp = true;
  }

  persistSave();
  return { leveledUp };
}
