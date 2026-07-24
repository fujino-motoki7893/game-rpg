import {
  canItemHealHp,
  canItemRestoreMp,
  getItemBuyPrice,
  getItemHealAmount,
  getItemMpRestoreAmount,
  getItemSellPrice,
  isItemBuyable,
  isItemId,
  ITEM_ORDER
} from "../data/items";
import {
  canEquipToSlot,
  createEmptyEquipmentStats,
  EQUIPMENT,
  EQUIPMENT_ORDER,
  getEquipmentBuyPrice,
  getEquipmentSellPrice,
  isEquipmentBuyable,
  isEquipmentId
} from "../data/equipment";
import {
  getSkillHealAmount,
  getSkillIdsLearnedAtLevel,
  getSkillsForLevel,
  isSkillId,
  SKILLS
} from "../data/skills";
import { COMPANION_ORDER, COMPANIONS } from "../data/companions";
import { SAVE_KEY } from "./constants";
import type { EquipmentStats } from "../data/equipment";
import type { SkillDefinition, SkillId } from "../data/skills";
import type { CompanionId } from "../data/companions";
import type {
  CompanionSaveState,
  DungeonTierProgress,
  EquipmentId,
  EquipmentInventory,
  EquipmentLoadout,
  EquipmentSlot,
  GameSave,
  Inventory,
  ItemId,
  MapDefinition,
  MapId
} from "./types";

const DUNGEON_FLOOR_RANGES: Record<number, { min: number; max: number }> = {
  1: { min: 3, max: 5 },
  2: { min: 5, max: 7 },
  3: { min: 6, max: 8 },
  4: { min: 7, max: 8 }
};
const FIELD_ENEMY_ID_PREFIX = "field-";
const DUNGEON_ENEMY_ID_PREFIX = "dungeon-";

/**
 * Saves before the multi-companion refactor stored Luna and Geist as flat
 * companionHp/companion2Hp-style fields instead of a `companions` map.
 * Kept only so loadSave() can migrate old saves into the new shape once.
 */
interface LegacyCompanionFields {
  companionHp?: number;
  companionMp?: number;
  companionEquipment?: EquipmentLoadout;
  companion2Hp?: number;
  companion2Mp?: number;
  companion2Equipment?: EquipmentLoadout;
}

export const initialSave = (): GameSave => ({
  mapId: "village",
  x: 20,
  y: 15,
  hp: 30,
  maxHp: 30,
  mp: getBaseMaxMpForLevel(1),
  maxMp: getBaseMaxMpForLevel(1),
  attack: 7,
  speed: 8,
  level: 1,
  exp: 0,
  gold: 0,
  potions: 2,
  items: { herb: 2 },
  equipmentInventory: {},
  equipment: {},
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

    const rawParsed = JSON.parse(raw) as Partial<GameSave> & LegacyCompanionFields;
    // Drop the pre-refactor flat companion fields once migrated below, so a
    // save round-trip doesn't carry the old shape forward indefinitely.
    const {
      companionHp: _legacyCompanionHp,
      companionMp: _legacyCompanionMp,
      companionEquipment: _legacyCompanionEquipment,
      companion2Hp: _legacyCompanion2Hp,
      companion2Mp: _legacyCompanion2Mp,
      companion2Equipment: _legacyCompanion2Equipment,
      ...parsed
    } = rawParsed;
    const base = initialSave();
    const items = normalizeInventory(parsed.items, parsed.potions);
    const equipmentInventory = normalizeEquipmentInventory(parsed.equipmentInventory);
    const equipment = normalizeEquipmentLoadout(parsed.equipment);
    const level = normalizePositiveInteger(parsed.level, base.level);
    const maxHp = normalizePositiveInteger(parsed.maxHp, base.maxHp);
    const maxMp = normalizeMaxMp(parsed.maxMp, level);
    const attack = normalizePositiveInteger(parsed.attack, base.attack);
    const speed = normalizePositiveInteger(parsed.speed, base.speed);
    const equipmentStats = calculateEquipmentStats(equipment);
    const hp = normalizeHp(parsed.hp, maxHp + equipmentStats.maxHpBonus);
    const mp = normalizeMp(parsed.mp, maxMp + equipmentStats.maxMpBonus);
    const companions = normalizeCompanions(rawParsed, level);

    return {
      ...base,
      ...parsed,
      level,
      maxHp,
      maxMp,
      hp,
      mp,
      attack,
      speed,
      items,
      equipmentInventory,
      equipment,
      companions,
      potions: items.herb ?? 0,
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
  ensureEquipment();
  COMPANION_ORDER.forEach((id) => ensureCompanionSlot(id));
  clampVitalsToCurrentMax();
  syncLegacyPotionCount();
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function resetSave(): GameSave {
  save = initialSave();
  persistSave();
  return save;
}

export function getActiveDungeonTier(): number {
  return save.activeDungeonTier ?? getDungeonTier();
}

export function setActiveDungeonTier(tier: number): void {
  save.activeDungeonTier = tier;
  persistSave();
}

function ensureTierProgress(tier: number): DungeonTierProgress {
  save.dungeonProgressByTier = save.dungeonProgressByTier ?? {};
  const existing = save.dungeonProgressByTier[tier];
  if (existing) {
    return existing;
  }

  const created: DungeonTierProgress = {};
  save.dungeonProgressByTier[tier] = created;
  return created;
}

export function ensureDungeonProgress(
  tier = getActiveDungeonTier()
): { floorCount: number; currentFloor: number } {
  const progress = ensureTierProgress(tier);
  const range = getDungeonFloorRange(tier);

  if (
    !progress.floorCount ||
    progress.floorCount < range.min ||
    progress.floorCount > range.max
  ) {
    progress.floorCount = randomInt(range.min, range.max);
  }

  if (!progress.currentFloor) {
    progress.currentFloor = 1;
  }

  progress.currentFloor = clampFloor(progress.currentFloor, progress.floorCount);
  persistSave();
  return {
    floorCount: progress.floorCount,
    currentFloor: progress.currentFloor
  };
}

export function getCurrentDungeonFloor(tier = getActiveDungeonTier()): number {
  return save.dungeonProgressByTier?.[tier]?.currentFloor ?? 1;
}

export function getDungeonFloorCount(tier = getActiveDungeonTier()): number | undefined {
  return save.dungeonProgressByTier?.[tier]?.floorCount;
}

export function getDungeonTier(): number {
  if (hasFlag("finalBeastDefeated")) {
    return 4;
  }
  if (hasFlag("secondQuestComplete")) {
    return 3;
  }
  return hasFlag("questComplete") ? 2 : 1;
}

export function isExpandedWorldUnlocked(): boolean {
  return getDungeonTier() >= 2;
}

export function setCurrentDungeonFloor(floor: number, tier = getActiveDungeonTier()): void {
  const progress = ensureTierProgress(tier);
  const floorCount = progress.floorCount ?? getDungeonFloorRange(tier).max;
  progress.currentFloor = clampFloor(floor, floorCount);
  persistSave();
}

export function getGeneratedDungeonFloor(
  floor: number,
  tier = getActiveDungeonTier()
): MapDefinition | undefined {
  return save.dungeonProgressByTier?.[tier]?.generatedFloors?.[String(floor)];
}

export function setGeneratedDungeonFloor(
  floor: number,
  dungeon: MapDefinition,
  tier = getActiveDungeonTier()
): void {
  const progress = ensureTierProgress(tier);
  progress.generatedFloors = progress.generatedFloors ?? {};
  progress.generatedFloors[String(floor)] = dungeon;
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
  save.hp = Math.min(getPlayerMaxHp(), save.hp + amount);
  persistSave();
  return save.hp - before;
}

export function restorePlayerMp(amount: number): number {
  const before = save.mp;
  save.mp = Math.min(getPlayerMaxMp(), save.mp + amount);
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
  reason?: "not-enough-gold" | "not-for-sale" | "unknown-item";
}

export interface SellItemResult {
  sold: boolean;
  price: number;
  reason?: "no-item" | "unknown-item";
}

export interface BuyEquipmentResult {
  bought: boolean;
  price: number;
  reason?: "not-enough-gold" | "not-for-sale" | "unknown-equipment";
}

export interface SellEquipmentResult {
  sold: boolean;
  price: number;
  reason?: "no-equipment" | "unknown-equipment";
}

export interface EquipEquipmentResult {
  equipped: boolean;
  slot?: EquipmentSlot;
  previousEquipmentId?: EquipmentId;
  reason?: "no-equipment" | "unknown-equipment" | "incompatible-slot";
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

export function getEquipmentCount(equipmentId: EquipmentId): number {
  ensureEquipment();
  return save.equipmentInventory[equipmentId] ?? 0;
}

export function getTotalEquipmentCount(): number {
  ensureEquipment();
  return EQUIPMENT_ORDER.reduce(
    (total, equipmentId) => total + (save.equipmentInventory[equipmentId] ?? 0),
    0
  );
}

export function addEquipment(equipmentId: EquipmentId, quantity = 1): number {
  ensureEquipment();
  const nextCount = Math.max(0, (save.equipmentInventory[equipmentId] ?? 0) + quantity);
  save.equipmentInventory[equipmentId] = nextCount;
  persistSave();
  return nextCount;
}

export function getEquippedEquipment(slot: EquipmentSlot): EquipmentId | undefined {
  ensureEquipment();
  return save.equipment[slot];
}

export function previewEquipmentSlot(equipmentId: EquipmentId): EquipmentSlot | undefined {
  ensureEquipment();
  return getDefaultEquipmentSlot(equipmentId);
}

export function getEquipmentStatTotals(): EquipmentStats {
  ensureEquipment();
  return calculateEquipmentStats(save.equipment);
}

export function getPlayerMaxHp(): number {
  return save.maxHp + getEquipmentStatTotals().maxHpBonus;
}

export function getPlayerMaxMp(): number {
  return save.maxMp + getEquipmentStatTotals().maxMpBonus;
}

export function getPlayerAttack(): number {
  return save.attack + getEquipmentStatTotals().attackBonus;
}

export function getPlayerDefense(): number {
  return getEquipmentStatTotals().defenseBonus;
}

export function getPlayerSpeed(): number {
  return save.speed + getEquipmentStatTotals().speedBonus;
}

// ---------------------------------------------------------------------------
// Companions (Luna, Geist, ...) — every function below is generic over
// CompanionId; adding a new companion needs no new functions here, only a
// new entry in data/companions.ts.
// ---------------------------------------------------------------------------

export function hasCompanion(id: CompanionId): boolean {
  return hasFlag(COMPANIONS[id].joinedFlag);
}

export function getCompanionEquippedEquipment(id: CompanionId, slot: EquipmentSlot): EquipmentId | undefined {
  return ensureCompanionSlot(id).equipment?.[slot];
}

export function getCompanionEquipmentStatTotals(id: CompanionId): EquipmentStats {
  return calculateEquipmentStats(ensureCompanionSlot(id).equipment ?? {});
}

export function getCompanionMaxHp(id: CompanionId): number {
  return COMPANIONS[id].formulas.maxHp(save.level) + getCompanionEquipmentStatTotals(id).maxHpBonus;
}

export function getCompanionMaxMp(id: CompanionId): number {
  return COMPANIONS[id].formulas.maxMp(save.level) + getCompanionEquipmentStatTotals(id).maxMpBonus;
}

export function getCompanionAttack(id: CompanionId): number {
  return COMPANIONS[id].formulas.attack(save.level) + getCompanionEquipmentStatTotals(id).attackBonus;
}

export function getCompanionDefense(id: CompanionId): number {
  return COMPANIONS[id].formulas.defense(save.level) + getCompanionEquipmentStatTotals(id).defenseBonus;
}

export function getCompanionSpeed(id: CompanionId): number {
  return COMPANIONS[id].formulas.speed(save.level) + getCompanionEquipmentStatTotals(id).speedBonus;
}

export function getCompanionHp(id: CompanionId): number {
  ensureCompanionVitals(id);
  return ensureCompanionSlot(id).hp ?? getCompanionMaxHp(id);
}

export function getCompanionMp(id: CompanionId): number {
  ensureCompanionVitals(id);
  return ensureCompanionSlot(id).mp ?? getCompanionMaxMp(id);
}

export function recruitCompanion(id: CompanionId): void {
  markFlag(COMPANIONS[id].joinedFlag);
  const slot = ensureCompanionSlot(id);
  slot.hp = getCompanionMaxHp(id);
  slot.mp = getCompanionMaxMp(id);
  persistSave();
}

export function healCompanion(id: CompanionId, amount: number): number {
  ensureCompanionVitals(id);
  const slot = ensureCompanionSlot(id);
  const before = slot.hp ?? 0;
  slot.hp = Math.min(getCompanionMaxHp(id), before + amount);
  persistSave();
  return slot.hp - before;
}

export function restoreCompanionMp(id: CompanionId, amount: number): number {
  ensureCompanionVitals(id);
  const slot = ensureCompanionSlot(id);
  const before = slot.mp ?? 0;
  slot.mp = Math.min(getCompanionMaxMp(id), before + amount);
  persistSave();
  return slot.mp - before;
}

export function damageCompanion(id: CompanionId, amount: number): void {
  ensureCompanionVitals(id);
  const slot = ensureCompanionSlot(id);
  slot.hp = Math.max(0, (slot.hp ?? 0) - amount);
  persistSave();
}

export function spendCompanionMp(id: CompanionId, amount: number): boolean {
  ensureCompanionVitals(id);
  if (amount <= 0) {
    return true;
  }

  const slot = ensureCompanionSlot(id);
  if ((slot.mp ?? 0) < amount) {
    return false;
  }

  slot.mp = Math.max(0, (slot.mp ?? 0) - amount);
  persistSave();
  return true;
}

export function equipEquipmentToCompanion(
  id: CompanionId,
  equipmentId: EquipmentId,
  preferredSlot?: EquipmentSlot
): EquipEquipmentResult {
  if (!isEquipmentId(equipmentId)) {
    return { equipped: false, reason: "unknown-equipment" };
  }

  ensureEquipment();
  const companionSlot = ensureCompanionSlot(id);
  companionSlot.equipment = companionSlot.equipment ?? {};
  if ((save.equipmentInventory[equipmentId] ?? 0) <= 0) {
    return { equipped: false, reason: "no-equipment" };
  }

  const slot = preferredSlot ?? getDefaultCompanionEquipmentSlot(id, equipmentId);
  if (!slot || !canEquipToSlot(equipmentId, slot)) {
    return { equipped: false, reason: "incompatible-slot" };
  }

  const previousEquipmentId = companionSlot.equipment[slot];
  save.equipmentInventory[equipmentId] = Math.max(0, (save.equipmentInventory[equipmentId] ?? 0) - 1);
  if (previousEquipmentId) {
    save.equipmentInventory[previousEquipmentId] = (save.equipmentInventory[previousEquipmentId] ?? 0) + 1;
  }
  companionSlot.equipment[slot] = equipmentId;
  persistSave();
  return { equipped: true, slot, previousEquipmentId };
}

export function unequipCompanionEquipment(id: CompanionId, slot: EquipmentSlot): EquipEquipmentResult {
  const companionSlot = ensureCompanionSlot(id);
  const previousEquipmentId = companionSlot.equipment?.[slot];
  if (!previousEquipmentId) {
    return { equipped: false, reason: "no-equipment" };
  }

  delete companionSlot.equipment![slot];
  save.equipmentInventory[previousEquipmentId] = (save.equipmentInventory[previousEquipmentId] ?? 0) + 1;
  persistSave();
  return { equipped: true, slot, previousEquipmentId };
}

export function useItemOnCompanion(id: CompanionId, itemId: ItemId): UseItemResult {
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

  ensureCompanionVitals(id);
  const maxHp = getCompanionMaxHp(id);
  const maxMp = getCompanionMaxMp(id);
  const slot = ensureCompanionSlot(id);
  const currentHp = slot.hp ?? maxHp;
  const currentMp = slot.mp ?? maxMp;
  const hpFull = !healsHp || currentHp >= maxHp;
  const mpFull = !restoresMp || currentMp >= maxMp;
  if (hpFull && mpFull) {
    return {
      used: false,
      healed: 0,
      restoredMp: 0,
      reason: restoresMp && !healsHp ? "full-mp" : "full-hp"
    };
  }

  const beforeHp = currentHp;
  const beforeMp = currentMp;
  if (healsHp) {
    slot.hp = Math.min(maxHp, currentHp + getItemHealAmount(itemId, maxHp));
  }
  if (restoresMp) {
    slot.mp = Math.min(maxMp, currentMp + getItemMpRestoreAmount(itemId, maxMp));
  }
  save.items[itemId] = Math.max(0, (save.items[itemId] ?? 0) - 1);
  persistSave();
  return {
    used: true,
    healed: (slot.hp ?? beforeHp) - beforeHp,
    restoredMp: (slot.mp ?? beforeMp) - beforeMp
  };
}

export function useHealingSkillOnCompanion(id: CompanionId, skillId: SkillId): UseSkillResult {
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

  ensureCompanionVitals(id);
  const maxHp = getCompanionMaxHp(id);
  const slot = ensureCompanionSlot(id);
  const currentHp = slot.hp ?? maxHp;
  if (currentHp >= maxHp) {
    return { used: false, healed: 0, reason: "full-hp" };
  }

  if (save.mp < skill.mpCost) {
    return { used: false, healed: 0, reason: "not-enough-mp" };
  }

  const before = currentHp;
  save.mp = Math.max(0, save.mp - skill.mpCost);
  slot.hp = Math.min(maxHp, currentHp + getSkillHealAmount(skill, maxHp));
  persistSave();
  return { used: true, healed: slot.hp - before };
}

export function buyEquipment(equipmentId: EquipmentId): BuyEquipmentResult {
  if (!isEquipmentId(equipmentId)) {
    return { bought: false, price: 0, reason: "unknown-equipment" };
  }

  if (!isEquipmentBuyable(equipmentId)) {
    return { bought: false, price: 0, reason: "not-for-sale" };
  }

  const price = getEquipmentBuyPrice(equipmentId);
  if (save.gold < price) {
    return { bought: false, price, reason: "not-enough-gold" };
  }

  save.gold -= price;
  addEquipment(equipmentId, 1);
  return { bought: true, price };
}

export function sellEquipment(equipmentId: EquipmentId): SellEquipmentResult {
  if (!isEquipmentId(equipmentId)) {
    return { sold: false, price: 0, reason: "unknown-equipment" };
  }

  ensureEquipment();
  if ((save.equipmentInventory[equipmentId] ?? 0) <= 0) {
    return { sold: false, price: getEquipmentSellPrice(equipmentId), reason: "no-equipment" };
  }

  const price = getEquipmentSellPrice(equipmentId);
  save.equipmentInventory[equipmentId] = Math.max(0, (save.equipmentInventory[equipmentId] ?? 0) - 1);
  save.gold += price;
  persistSave();
  return { sold: true, price };
}

export function equipEquipment(equipmentId: EquipmentId, preferredSlot?: EquipmentSlot): EquipEquipmentResult {
  if (!isEquipmentId(equipmentId)) {
    return { equipped: false, reason: "unknown-equipment" };
  }

  ensureEquipment();
  if ((save.equipmentInventory[equipmentId] ?? 0) <= 0) {
    return { equipped: false, reason: "no-equipment" };
  }

  const slot = preferredSlot ?? getDefaultEquipmentSlot(equipmentId);
  if (!slot || !canEquipToSlot(equipmentId, slot)) {
    return { equipped: false, reason: "incompatible-slot" };
  }

  const previousEquipmentId = save.equipment[slot];
  save.equipmentInventory[equipmentId] = Math.max(0, (save.equipmentInventory[equipmentId] ?? 0) - 1);
  if (previousEquipmentId) {
    save.equipmentInventory[previousEquipmentId] = (save.equipmentInventory[previousEquipmentId] ?? 0) + 1;
  }
  save.equipment[slot] = equipmentId;
  persistSave();
  return { equipped: true, slot, previousEquipmentId };
}

export function unequipEquipment(slot: EquipmentSlot): EquipEquipmentResult {
  ensureEquipment();
  const previousEquipmentId = save.equipment[slot];
  if (!previousEquipmentId) {
    return { equipped: false, reason: "no-equipment" };
  }

  delete save.equipment[slot];
  save.equipmentInventory[previousEquipmentId] =
    (save.equipmentInventory[previousEquipmentId] ?? 0) + 1;
  persistSave();
  return { equipped: true, slot, previousEquipmentId };
}

export function buyItem(itemId: ItemId): BuyItemResult {
  if (!isItemId(itemId)) {
    return { bought: false, price: 0, reason: "unknown-item" };
  }

  if (!isItemBuyable(itemId)) {
    return { bought: false, price: 0, reason: "not-for-sale" };
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

export function consumeItem(itemId: ItemId): boolean {
  if (!isItemId(itemId)) {
    return false;
  }

  ensureInventory();
  if ((save.items[itemId] ?? 0) <= 0) {
    return false;
  }

  save.items[itemId] = Math.max(0, (save.items[itemId] ?? 0) - 1);
  persistSave();
  return true;
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

  const maxHp = getPlayerMaxHp();
  const maxMp = getPlayerMaxMp();
  const hpFull = !healsHp || save.hp >= maxHp;
  const mpFull = !restoresMp || save.mp >= maxMp;
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
    save.hp = Math.min(maxHp, save.hp + getItemHealAmount(itemId, maxHp));
  }
  if (restoresMp) {
    save.mp = Math.min(maxMp, save.mp + getItemMpRestoreAmount(itemId, maxMp));
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

  const maxHp = getPlayerMaxHp();
  if (save.hp >= maxHp) {
    return { used: false, healed: 0, reason: "full-hp" };
  }

  if (save.mp < skill.mpCost) {
    return { used: false, healed: 0, reason: "not-enough-mp" };
  }

  const before = save.hp;
  save.mp = Math.max(0, save.mp - skill.mpCost);
  save.hp = Math.min(maxHp, save.hp + getSkillHealAmount(skill, maxHp));
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
    save.speed += 1;
    save.hp = getPlayerMaxHp();
    save.mp = getPlayerMaxMp();
    COMPANION_ORDER.forEach((id) => {
      if (hasFlag(COMPANIONS[id].joinedFlag)) {
        const slot = ensureCompanionSlot(id);
        slot.hp = getCompanionMaxHp(id);
        slot.mp = getCompanionMaxMp(id);
      }
    });
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

function getDungeonFloorRange(tier: number): { min: number; max: number } {
  return DUNGEON_FLOOR_RANGES[tier] ?? DUNGEON_FLOOR_RANGES[1];
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

function ensureEquipment(): void {
  if (!save.equipmentInventory) {
    save.equipmentInventory = normalizeEquipmentInventory(undefined);
  }
  if (!save.equipment) {
    save.equipment = normalizeEquipmentLoadout(undefined);
  }
}

function ensureCompanionSlot(id: CompanionId): CompanionSaveState {
  save.companions = save.companions ?? {};
  const existing = save.companions[id];
  if (existing) {
    return existing;
  }

  const created: CompanionSaveState = {};
  save.companions[id] = created;
  return created;
}

function ensureCompanionVitals(id: CompanionId): void {
  if (!hasFlag(COMPANIONS[id].joinedFlag)) {
    return;
  }

  const slot = ensureCompanionSlot(id);
  if (slot.hp === undefined) {
    slot.hp = getCompanionMaxHp(id);
  }
  if (slot.mp === undefined) {
    slot.mp = getCompanionMaxMp(id);
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

function normalizeHp(value: unknown, maxHp: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return maxHp;
  }

  return Math.min(maxHp, Math.floor(value));
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

function normalizeEquipmentInventory(equipmentInventory: unknown): EquipmentInventory {
  const inventory: EquipmentInventory = {};
  if (equipmentInventory && typeof equipmentInventory === "object") {
    const rawEquipment = equipmentInventory as Record<string, unknown>;
    EQUIPMENT_ORDER.forEach((equipmentId) => {
      const count = rawEquipment[equipmentId];
      if (typeof count === "number" && Number.isFinite(count) && count > 0) {
        inventory[equipmentId] = Math.floor(count);
      }
    });
  }
  return inventory;
}

function normalizeEquipmentLoadout(equipment: unknown): EquipmentLoadout {
  const loadout: EquipmentLoadout = {};
  if (!equipment || typeof equipment !== "object") {
    return loadout;
  }

  const rawEquipment = equipment as Record<string, unknown>;
  (Object.keys(rawEquipment) as EquipmentSlot[]).forEach((slot) => {
    const equipmentId = rawEquipment[slot];
    if (isEquipmentSlot(slot) && isEquipmentId(equipmentId) && canEquipToSlot(equipmentId, slot)) {
      loadout[slot] = equipmentId;
    }
  });
  return loadout;
}

function normalizeCompanions(
  parsed: Partial<GameSave> & LegacyCompanionFields,
  level: number
): Partial<Record<CompanionId, CompanionSaveState>> {
  if (parsed.companions) {
    const normalized: Partial<Record<CompanionId, CompanionSaveState>> = {};
    COMPANION_ORDER.forEach((id) => {
      const state = parsed.companions?.[id];
      if (state) {
        normalized[id] = normalizeCompanionState(id, state, level);
      }
    });
    return normalized;
  }

  // Pre-refactor save: fold Luna's/Geist's old flat fields in, if present.
  const migrated: Partial<Record<CompanionId, CompanionSaveState>> = {};
  if (
    parsed.companionHp !== undefined ||
    parsed.companionMp !== undefined ||
    parsed.companionEquipment !== undefined
  ) {
    migrated.luna = normalizeCompanionState(
      "luna",
      { hp: parsed.companionHp, mp: parsed.companionMp, equipment: parsed.companionEquipment },
      level
    );
  }
  if (
    parsed.companion2Hp !== undefined ||
    parsed.companion2Mp !== undefined ||
    parsed.companion2Equipment !== undefined
  ) {
    migrated.geist = normalizeCompanionState(
      "geist",
      { hp: parsed.companion2Hp, mp: parsed.companion2Mp, equipment: parsed.companion2Equipment },
      level
    );
  }
  return migrated;
}

function normalizeCompanionState(id: CompanionId, state: CompanionSaveState, level: number): CompanionSaveState {
  const equipment = normalizeEquipmentLoadout(state.equipment);
  const stats = calculateEquipmentStats(equipment);
  const formulas = COMPANIONS[id].formulas;
  return {
    equipment,
    hp: state.hp !== undefined ? normalizeHp(state.hp, formulas.maxHp(level) + stats.maxHpBonus) : undefined,
    mp: state.mp !== undefined ? normalizeMp(state.mp, formulas.maxMp(level) + stats.maxMpBonus) : undefined
  };
}

function calculateEquipmentStats(equipment: EquipmentLoadout): EquipmentStats {
  const stats = createEmptyEquipmentStats();
  Object.values(equipment).forEach((equipmentId) => {
    if (!equipmentId || !isEquipmentId(equipmentId)) {
      return;
    }

    const definition = EQUIPMENT[equipmentId];
    stats.attackBonus += definition.attackBonus ?? 0;
    stats.defenseBonus += definition.defenseBonus ?? 0;
    stats.maxHpBonus += definition.maxHpBonus ?? 0;
    stats.maxMpBonus += definition.maxMpBonus ?? 0;
    stats.speedBonus += definition.speedBonus ?? 0;
  });
  return stats;
}

function getDefaultEquipmentSlot(equipmentId: EquipmentId): EquipmentSlot | undefined {
  const category = EQUIPMENT[equipmentId].category;
  if (category === "accessory") {
    if (!save.equipment.accessory1) {
      return "accessory1";
    }
    if (!save.equipment.accessory2) {
      return "accessory2";
    }
    return "accessory1";
  }
  return category;
}

function getDefaultCompanionEquipmentSlot(id: CompanionId, equipmentId: EquipmentId): EquipmentSlot | undefined {
  const category = EQUIPMENT[equipmentId].category;
  const equipment = ensureCompanionSlot(id).equipment ?? {};
  if (category === "accessory") {
    if (!equipment.accessory1) {
      return "accessory1";
    }
    if (!equipment.accessory2) {
      return "accessory2";
    }
    return "accessory1";
  }
  return category;
}

function isEquipmentSlot(value: unknown): value is EquipmentSlot {
  return (
    value === "weapon" ||
    value === "shield" ||
    value === "head" ||
    value === "bodyUpper" ||
    value === "bodyLower" ||
    value === "accessory1" ||
    value === "accessory2"
  );
}

function clampVitalsToCurrentMax(): void {
  save.hp = Math.min(save.hp, getPlayerMaxHp());
  save.mp = Math.min(save.mp, getPlayerMaxMp());
  COMPANION_ORDER.forEach((id) => {
    if (!hasFlag(COMPANIONS[id].joinedFlag)) {
      return;
    }

    const slot = ensureCompanionSlot(id);
    if (slot.hp !== undefined) {
      slot.hp = Math.min(slot.hp, getCompanionMaxHp(id));
    }
    if (slot.mp !== undefined) {
      slot.mp = Math.min(slot.mp, getCompanionMaxMp(id));
    }
  });
}

function syncLegacyPotionCount(): void {
  ensureInventory();
  save.potions = save.items.herb ?? 0;
}
