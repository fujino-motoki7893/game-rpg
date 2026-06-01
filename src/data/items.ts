import type { ItemId } from "../game/types";

export interface ItemDefinition {
  id: ItemId;
  name: string;
  description: string;
  healAmount?: number;
  healRatio?: number;
}

export const ITEM_ORDER: ItemId[] = ["herb", "strongHerb", "magicWater"];

export const ITEMS: Record<ItemId, ItemDefinition> = {
  herb: {
    id: "herb",
    name: "薬草",
    description: "HPを16回復",
    healAmount: 16
  },
  strongHerb: {
    id: "strongHerb",
    name: "上薬草",
    description: "HPを32回復",
    healAmount: 32
  },
  magicWater: {
    id: "magicWater",
    name: "まほうの水",
    description: "HPを最大値の半分回復",
    healRatio: 0.5
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
