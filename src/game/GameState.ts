import { getItemHealAmount, isItemId, ITEM_ORDER } from "../data/items";
import { SAVE_KEY } from "./constants";
import type { GameSave, Inventory, ItemId, MapDefinition, MapId } from "./types";

const MIN_DUNGEON_FLOORS = 3;
const MAX_DUNGEON_FLOORS = 5;

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
  items: { herb: 2 },
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
    const items = normalizeInventory(parsed.items, parsed.potions);
    return {
      ...initialSave(),
      ...parsed,
      items,
      potions: items.herb ?? 0,
      flags: parsed.flags ?? {},
      defeatedEnemies: parsed.defeatedEnemies ?? [],
      generatedDungeonFloors: parsed.generatedDungeonFloors ?? undefined
    };
  } catch {
    return initialSave();
  }
}

export function getSave(): GameSave {
  return save;
}

export function persistSave(): void {
  syncLegacyPotionCount();
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

export function ensureDungeonProgress(): { floorCount: number; currentFloor: number } {
  if (!save.dungeonFloorCount) {
    save.dungeonFloorCount = randomInt(MIN_DUNGEON_FLOORS, MAX_DUNGEON_FLOORS);
  }

  if (!save.currentDungeonFloor) {
    save.currentDungeonFloor = 1;
  }

  if (!save.generatedDungeonFloors) {
    save.generatedDungeonFloors = {};
  }

  save.currentDungeonFloor = clampFloor(save.currentDungeonFloor, save.dungeonFloorCount);
  persistSave();
  return {
    floorCount: save.dungeonFloorCount,
    currentFloor: save.currentDungeonFloor
  };
}

export function getCurrentDungeonFloor(): number {
  return save.currentDungeonFloor ?? 1;
}

export function getDungeonFloorCount(): number | undefined {
  return save.dungeonFloorCount;
}

export function setCurrentDungeonFloor(floor: number): void {
  const floorCount = save.dungeonFloorCount ?? MAX_DUNGEON_FLOORS;
  save.currentDungeonFloor = clampFloor(floor, floorCount);
  persistSave();
}

export function getGeneratedDungeonFloor(floor: number): MapDefinition | undefined {
  return save.generatedDungeonFloors?.[String(floor)];
}

export function setGeneratedDungeonFloor(floor: number, dungeon: MapDefinition): void {
  save.generatedDungeonFloors = save.generatedDungeonFloors ?? {};
  save.generatedDungeonFloors[String(floor)] = dungeon;
  if (floor === 1) {
    save.generatedDungeon = dungeon;
  }
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

export interface UseItemResult {
  used: boolean;
  healed: number;
  reason?: "full-hp" | "no-item" | "unknown-item";
}

export function getItemCount(itemId: ItemId): number {
  ensureInventory();
  return save.items[itemId] ?? 0;
}

export function getTotalItemCount(): number {
  ensureInventory();
  return ITEM_ORDER.reduce((total, itemId) => total + (save.items[itemId] ?? 0), 0);
}

export function addItem(itemId: ItemId, quantity = 1): number {
  ensureInventory();
  const nextCount = Math.max(0, (save.items[itemId] ?? 0) + quantity);
  save.items[itemId] = nextCount;
  persistSave();
  return nextCount;
}

export function useItem(itemId: ItemId): UseItemResult {
  if (!isItemId(itemId)) {
    return { used: false, healed: 0, reason: "unknown-item" };
  }

  ensureInventory();
  if ((save.items[itemId] ?? 0) <= 0) {
    return { used: false, healed: 0, reason: "no-item" };
  }

  if (save.hp >= save.maxHp) {
    return { used: false, healed: 0, reason: "full-hp" };
  }

  const before = save.hp;
  save.hp = Math.min(save.maxHp, save.hp + getItemHealAmount(itemId, save.maxHp));
  save.items[itemId] = Math.max(0, (save.items[itemId] ?? 0) - 1);
  persistSave();
  return { used: true, healed: save.hp - before };
}

export function usePotion(): boolean {
  return useItem("herb").used;
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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clampFloor(floor: number, floorCount: number): number {
  return Math.min(floorCount, Math.max(1, floor));
}

function ensureInventory(): void {
  if (!save.items) {
    save.items = normalizeInventory(undefined, save.potions);
  }
}

function normalizeInventory(items: unknown, legacyPotions?: number): Inventory {
  const inventory: Inventory = {};
  if (items && typeof items === "object") {
    const rawItems = items as Record<string, unknown>;
    ITEM_ORDER.forEach((itemId) => {
      const count = rawItems[itemId];
      if (typeof count === "number" && Number.isFinite(count) && count > 0) {
        inventory[itemId] = Math.floor(count);
      }
    });
  }

  if (inventory.herb === undefined && typeof legacyPotions === "number" && legacyPotions > 0) {
    inventory.herb = Math.floor(legacyPotions);
  }

  return inventory;
}

function syncLegacyPotionCount(): void {
  ensureInventory();
  save.potions = save.items.herb ?? 0;
}
