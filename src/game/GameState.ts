import {
  canItemHealHp,
  canItemRestoreMp,
  getItemBuyPrice,
  getItemHealAmount,
  getItemMpRestoreAmount,
  getItemSellPrice,
  isItemId,
  ITEM_ORDER
} from "../data/items";
import {
  getSkillHealAmount,
  getSkillIdsLearnedAtLevel,
  getSkillsForLevel,
  isSkillId,
  SKILLS
} from "../data/skills";
import { SAVE_KEY } from "./constants";
import type { SkillDefinition, SkillId } from "../data/skills";
import type { GameSave, Inventory, ItemId, MapDefinition, MapId } from "./types";

const MIN_DUNGEON_FLOORS = 3;
const MAX_DUNGEON_FLOORS = 5;
const FIELD_ENEMY_ID_PREFIX = "field-";
const DUNGEON_ENEMY_ID_PREFIX = "dungeon-";

export const initialSave = (): GameSave => ({
  mapId: "village",
  x: 9,
  y: 6,
  hp: 30,
  maxHp: 30,
  mp: getBaseMaxMpForLevel(1),
  maxMp: getBaseMaxMpForLevel(1),
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
    const base = initialSave();
    const items = normalizeInventory(parsed.items, parsed.potions);
    const level = normalizePositiveInteger(parsed.level, base.level);
    const maxMp = normalizeMaxMp(parsed.maxMp, level);
    const mp = normalizeMp(parsed.mp, maxMp);
    return {
      ...base,
      ...parsed,
      level,
      maxMp,
      mp,
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

export function restorePlayerMp(amount: number): number {
  const before = save.mp;
  save.mp = Math.min(save.maxMp, save.mp + amount);
  persistSave();
  return save.mp - before;
}

export function damagePlayer(amount: number): void {
  save.hp = Math.max(0, save.hp - amount);
  persistSave();
}

export interface UseItemResult {
  used: boolean;
  healed: number;
  restoredMp: number;
  reason?: "full-hp" | "full-mp" | "no-effect" | "no-item" | "unknown-item";
}

export interface BuyItemResult {
  bought: boolean;
  price: number;
  reason?: "not-enough-gold" | "unknown-item";
}

export interface SellItemResult {
  sold: boolean;
  price: number;
  reason?: "no-item" | "unknown-item";
}

export interface UseSkillResult {
  used: boolean;
  healed: number;
  reason?: "unknown-skill" | "not-learned" | "not-healing" | "not-enough-mp" | "full-hp";
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

export function buyItem(itemId: ItemId): BuyItemResult {
  if (!isItemId(itemId)) {
    return { bought: false, price: 0, reason: "unknown-item" };
  }

  const price = getItemBuyPrice(itemId);
  if (save.gold < price) {
    return { bought: false, price, reason: "not-enough-gold" };
  }

  ensureInventory();
  save.gold -= price;
  save.items[itemId] = (save.items[itemId] ?? 0) + 1;
  persistSave();
  return { bought: true, price };
}

export function sellItem(itemId: ItemId): SellItemResult {
  if (!isItemId(itemId)) {
    return { sold: false, price: 0, reason: "unknown-item" };
  }

  ensureInventory();
  if ((save.items[itemId] ?? 0) <= 0) {
    return { sold: false, price: getItemSellPrice(itemId), reason: "no-item" };
  }

  const price = getItemSellPrice(itemId);
  save.items[itemId] = Math.max(0, (save.items[itemId] ?? 0) - 1);
  save.gold += price;
  persistSave();
  return { sold: true, price };
}

export function useItem(itemId: ItemId): UseItemResult {
  if (!isItemId(itemId)) {
    return { used: false, healed: 0, restoredMp: 0, reason: "unknown-item" };
  }

  ensureInventory();
  if ((save.items[itemId] ?? 0) <= 0) {
    return { used: false, healed: 0, restoredMp: 0, reason: "no-item" };
  }

  const healsHp = canItemHealHp(itemId);
  const restoresMp = canItemRestoreMp(itemId);
  if (!healsHp && !restoresMp) {
    return { used: false, healed: 0, restoredMp: 0, reason: "no-effect" };
  }

  const hpFull = !healsHp || save.hp >= save.maxHp;
  const mpFull = !restoresMp || save.mp >= save.maxMp;
  if (hpFull && mpFull) {
    return {
      used: false,
      healed: 0,
      restoredMp: 0,
      reason: restoresMp && !healsHp ? "full-mp" : "full-hp"
    };
  }

  const beforeHp = save.hp;
  const beforeMp = save.mp;
  if (healsHp) {
    save.hp = Math.min(save.maxHp, save.hp + getItemHealAmount(itemId, save.maxHp));
  }
  if (restoresMp) {
    save.mp = Math.min(save.maxMp, save.mp + getItemMpRestoreAmount(itemId, save.maxMp));
  }
  save.items[itemId] = Math.max(0, (save.items[itemId] ?? 0) - 1);
  persistSave();
  return { used: true, healed: save.hp - beforeHp, restoredMp: save.mp - beforeMp };
}

export function usePotion(): boolean {
  return useItem("herb").used;
}

export function getKnownSkills(): SkillDefinition[] {
  return getSkillsForLevel(save.level);
}

export function hasLearnedSkill(skillId: SkillId): boolean {
  return SKILLS[skillId].requiredLevel <= save.level;
}

export function spendMp(amount: number): boolean {
  if (amount <= 0) {
    return true;
  }

  if (save.mp < amount) {
    return false;
  }

  save.mp = Math.max(0, save.mp - amount);
  persistSave();
  return true;
}

export function useHealingSkill(skillId: SkillId): UseSkillResult {
  if (!isSkillId(skillId)) {
    return { used: false, healed: 0, reason: "unknown-skill" };
  }

  const skill = SKILLS[skillId];
  if (!hasLearnedSkill(skillId)) {
    return { used: false, healed: 0, reason: "not-learned" };
  }

  if (skill.effect.type !== "heal") {
    return { used: false, healed: 0, reason: "not-healing" };
  }

  if (save.hp >= save.maxHp) {
    return { used: false, healed: 0, reason: "full-hp" };
  }

  if (save.mp < skill.mpCost) {
    return { used: false, healed: 0, reason: "not-enough-mp" };
  }

  const before = save.hp;
  save.mp = Math.max(0, save.mp - skill.mpCost);
  save.hp = Math.min(save.maxHp, save.hp + getSkillHealAmount(skill, save.maxHp));
  persistSave();
  return { used: true, healed: save.hp - before };
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

export function resetFieldEnemyDefeats(): boolean {
  return removeDefeatedEnemiesByPrefix(FIELD_ENEMY_ID_PREFIX);
}

export function resetDungeonEnemyDefeats(): boolean {
  return removeDefeatedEnemiesByPrefix(DUNGEON_ENEMY_ID_PREFIX);
}

export function grantReward(exp: number, gold: number): { leveledUp: boolean; learnedSkillIds: SkillId[] } {
  save.exp += exp;
  save.gold += gold;

  let leveledUp = false;
  const learnedSkillIds: SkillId[] = [];
  while (save.exp >= save.level * 12) {
    save.exp -= save.level * 12;
    save.level += 1;
    save.maxHp += 6;
    save.maxMp = Math.max(save.maxMp + 4, getBaseMaxMpForLevel(save.level));
    save.attack += 2;
    save.hp = save.maxHp;
    save.mp = save.maxMp;
    learnedSkillIds.push(...getSkillIdsLearnedAtLevel(save.level));
    leveledUp = true;
  }

  persistSave();
  return { leveledUp, learnedSkillIds };
}

function getBaseMaxMpForLevel(level: number): number {
  return 8 + Math.max(0, level - 1) * 4;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clampFloor(floor: number, floorCount: number): number {
  return Math.min(floorCount, Math.max(1, floor));
}

function removeDefeatedEnemiesByPrefix(prefix: string): boolean {
  const before = save.defeatedEnemies.length;
  save.defeatedEnemies = save.defeatedEnemies.filter((enemyId) => !enemyId.startsWith(prefix));
  if (save.defeatedEnemies.length === before) {
    return false;
  }

  persistSave();
  return true;
}

function ensureInventory(): void {
  if (!save.items) {
    save.items = normalizeInventory(undefined, save.potions);
  }
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return fallback;
  }

  return Math.floor(value);
}

function normalizeMaxMp(value: unknown, level: number): number {
  const expectedMaxMp = getBaseMaxMpForLevel(level);
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return expectedMaxMp;
  }

  return Math.max(Math.floor(value), expectedMaxMp);
}

function normalizeMp(value: unknown, maxMp: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return maxMp;
  }

  return Math.min(maxMp, Math.floor(value));
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
