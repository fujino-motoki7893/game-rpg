import type { ItemId } from "../game/types";

export interface ItemDefinition {
  id: ItemId;
  name: string;
  description: string;
  buyPrice: number;
  healAmount?: number;
  healRatio?: number;
  mpRestoreAmount?: number;
  mpRestoreRatio?: number;
}

export const ITEM_ORDER: ItemId[] = ["herb", "strongHerb", "magicWater", "manaWater"];

export const ITEMS: Record<ItemId, ItemDefinition> = {
  herb: {
    id: "herb",
    name: "薬草",
    description: "HPを16回復",
    buyPrice: 8,
    healAmount: 16
  },
  strongHerb: {
    id: "strongHerb",
    name: "上薬草",
    description: "HPを32回復",
    buyPrice: 18,
    healAmount: 32
  },
  magicWater: {
    id: "magicWater",
    name: "まほうの水",
    description: "HPを最大値の半分回復",
    buyPrice: 28,
    healRatio: 0.5
  },
  manaWater: {
    id: "manaWater",
    name: "魔力の水",
    description: "MPを10回復",
    buyPrice: 16,
    mpRestoreAmount: 10
  }
};

export function isItemId(value: unknown): value is ItemId {
  return typeof value === "string" && ITEM_ORDER.includes(value as ItemId);
}

export function getItemHealAmount(itemId: ItemId, maxHp: number): number {
  const item = ITEMS[itemId];
  if (item.healAmount !== undefined) {
    return item.healAmount;
  }
  return Math.ceil(maxHp * (item.healRatio ?? 0));
}

export function getItemMpRestoreAmount(itemId: ItemId, maxMp: number): number {
  const item = ITEMS[itemId];
  if (item.mpRestoreAmount !== undefined) {
    return item.mpRestoreAmount;
  }
  return Math.ceil(maxMp * (item.mpRestoreRatio ?? 0));
}

export function canItemHealHp(itemId: ItemId): boolean {
  const item = ITEMS[itemId];
  return item.healAmount !== undefined || item.healRatio !== undefined;
}

export function canItemRestoreMp(itemId: ItemId): boolean {
  const item = ITEMS[itemId];
  return item.mpRestoreAmount !== undefined || item.mpRestoreRatio !== undefined;
}

export function getItemBuyPrice(itemId: ItemId): number {
  return ITEMS[itemId].buyPrice;
}

export function getItemSellPrice(itemId: ItemId): number {
  return Math.floor(ITEMS[itemId].buyPrice / 2);
}
