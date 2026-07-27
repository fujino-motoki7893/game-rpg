import type { StatusEffectType } from "./statusEffects";
import type { ItemId } from "../game/types";

export type ItemRarity = 1 | 2 | 3 | 4 | 5;

export interface ItemDefinition {
  id: ItemId;
  name: string;
  description: string;
  rarity: ItemRarity;
  buyPrice?: number;
  sellPrice?: number;
  healAmount?: number;
  healRatio?: number;
  mpRestoreAmount?: number;
  mpRestoreRatio?: number;
  escapesDungeon?: boolean;
  /** Status effect types this cures when used in battle — battle-only,
   * since status effects themselves only ever exist mid-battle. */
  curesStatus?: StatusEffectType[];
}

export const ITEM_ORDER: ItemId[] = [
  "herb",
  "strongHerb",
  "magicWater",
  "manaWater",
  "returnFeather",
  "burnCure",
  "poisonCure",
  "stunCure",
  "panacea"
];

// Panacea is deliberately excluded — it's a dungeon-chest-only find (see
// dungeonGenerator.ts's pickSupplyChestReward), not something to buy.
export const SHOP_BUY_ITEM_ORDER: ItemId[] = [
  "herb",
  "strongHerb",
  "magicWater",
  "manaWater",
  "burnCure",
  "poisonCure",
  "stunCure"
];

export const ITEMS: Record<ItemId, ItemDefinition> = {
  herb: {
    id: "herb",
    name: "薬草",
    description: "HPを16回復",
    rarity: 1,
    buyPrice: 8,
    healAmount: 16
  },
  strongHerb: {
    id: "strongHerb",
    name: "上薬草",
    description: "HPを32回復",
    rarity: 2,
    buyPrice: 18,
    healAmount: 32
  },
  magicWater: {
    id: "magicWater",
    name: "まほうの水",
    description: "HPを最大値の半分回復",
    rarity: 3,
    buyPrice: 28,
    healRatio: 0.5
  },
  manaWater: {
    id: "manaWater",
    name: "魔力の水",
    description: "MPを10回復",
    rarity: 2,
    buyPrice: 16,
    mpRestoreAmount: 10
  },
  returnFeather: {
    id: "returnFeather",
    name: "帰還の羽",
    description: "洞窟から草原へ脱出",
    rarity: 2,
    sellPrice: 45,
    escapesDungeon: true
  },
  burnCure: {
    id: "burnCure",
    name: "やけど薬",
    description: "戦闘中、火傷を治す",
    rarity: 2,
    buyPrice: 20,
    curesStatus: ["burn"]
  },
  poisonCure: {
    id: "poisonCure",
    name: "毒消し草",
    description: "戦闘中、毒を治す",
    rarity: 2,
    buyPrice: 20,
    curesStatus: ["poison"]
  },
  stunCure: {
    id: "stunCure",
    name: "しびれ止め",
    description: "戦闘中、しびれを治す",
    rarity: 2,
    buyPrice: 20,
    curesStatus: ["stun"]
  },
  panacea: {
    id: "panacea",
    name: "万能薬",
    description: "戦闘中、あらゆる状態異常を治す",
    rarity: 4,
    sellPrice: 60,
    curesStatus: ["burn", "poison", "stun"]
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

export function canItemEscapeDungeon(itemId: ItemId): boolean {
  return ITEMS[itemId].escapesDungeon === true;
}

export function getItemCuresStatus(itemId: ItemId): StatusEffectType[] {
  return ITEMS[itemId].curesStatus ?? [];
}

export function canItemCureStatus(itemId: ItemId): boolean {
  return getItemCuresStatus(itemId).length > 0;
}

export function isItemBuyable(itemId: ItemId): boolean {
  return ITEMS[itemId].buyPrice !== undefined;
}

export function getItemRarityLabel(itemId: ItemId): string {
  return `☆${ITEMS[itemId].rarity}`;
}

export function getItemBuyPrice(itemId: ItemId): number {
  return ITEMS[itemId].buyPrice ?? 0;
}

export function getItemSellPrice(itemId: ItemId): number {
  const item = ITEMS[itemId];
  return item.sellPrice ?? Math.floor((item.buyPrice ?? 0) / 2);
}
