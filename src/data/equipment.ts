import type { EquipmentCategory, EquipmentId, EquipmentSlot } from "../game/types";

export type EquipmentRarity = 1 | 2 | 3 | 4 | 5;

export interface EquipmentDefinition {
  id: EquipmentId;
  name: string;
  category: EquipmentCategory;
  description: string;
  rarity: EquipmentRarity;
  buyPrice?: number;
  sellPrice?: number;
  attackBonus?: number;
  defenseBonus?: number;
  maxHpBonus?: number;
  maxMpBonus?: number;
}

export interface EquipmentStats {
  attackBonus: number;
  defenseBonus: number;
  maxHpBonus: number;
  maxMpBonus: number;
}

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  "weapon",
  "shield",
  "head",
  "bodyUpper",
  "bodyLower",
  "accessory1",
  "accessory2"
];

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: "武器",
  shield: "盾",
  head: "頭",
  bodyUpper: "体(上)",
  bodyLower: "体(下)",
  accessory1: "アクセ1",
  accessory2: "アクセ2"
};

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  weapon: "武器",
  shield: "盾",
  head: "頭",
  bodyUpper: "体(上)",
  bodyLower: "体(下)",
  accessory: "アクセ"
};

export const EQUIPMENT_ORDER: EquipmentId[] = [
  "woodSword",
  "ironSword",
  "roundShield",
  "kiteShield",
  "clothCap",
  "ironHelm",
  "paddedVest",
  "chainMail",
  "travelerPants",
  "reinforcedGreaves",
  "silverRing",
  "emberCharm"
];

export const EQUIPMENT_SHOP_ORDER: EquipmentId[] = [
  "woodSword",
  "roundShield",
  "clothCap",
  "paddedVest",
  "travelerPants",
  "silverRing"
];

export const EQUIPMENT: Record<EquipmentId, EquipmentDefinition> = {
  woodSword: {
    id: "woodSword",
    name: "木の剣",
    category: "weapon",
    description: "攻撃+2",
    rarity: 1,
    buyPrice: 30,
    attackBonus: 2
  },
  ironSword: {
    id: "ironSword",
    name: "鉄の剣",
    category: "weapon",
    description: "攻撃+5",
    rarity: 2,
    sellPrice: 48,
    attackBonus: 5
  },
  roundShield: {
    id: "roundShield",
    name: "丸盾",
    category: "shield",
    description: "防御+1 HP+2",
    rarity: 1,
    buyPrice: 28,
    defenseBonus: 1,
    maxHpBonus: 2
  },
  kiteShield: {
    id: "kiteShield",
    name: "カイトシールド",
    category: "shield",
    description: "防御+2 HP+4",
    rarity: 2,
    sellPrice: 42,
    defenseBonus: 2,
    maxHpBonus: 4
  },
  clothCap: {
    id: "clothCap",
    name: "布の帽子",
    category: "head",
    description: "防御+1",
    rarity: 1,
    buyPrice: 18,
    defenseBonus: 1
  },
  ironHelm: {
    id: "ironHelm",
    name: "鉄の兜",
    category: "head",
    description: "防御+2",
    rarity: 2,
    sellPrice: 34,
    defenseBonus: 2
  },
  paddedVest: {
    id: "paddedVest",
    name: "旅人の上着",
    category: "bodyUpper",
    description: "防御+1 HP+4",
    rarity: 1,
    buyPrice: 34,
    defenseBonus: 1,
    maxHpBonus: 4
  },
  chainMail: {
    id: "chainMail",
    name: "鎖かたびら",
    category: "bodyUpper",
    description: "防御+3 HP+4",
    rarity: 2,
    sellPrice: 56,
    defenseBonus: 3,
    maxHpBonus: 4
  },
  travelerPants: {
    id: "travelerPants",
    name: "旅人のズボン",
    category: "bodyLower",
    description: "HP+3",
    rarity: 1,
    buyPrice: 24,
    maxHpBonus: 3
  },
  reinforcedGreaves: {
    id: "reinforcedGreaves",
    name: "補強レギンス",
    category: "bodyLower",
    description: "防御+1 HP+5",
    rarity: 2,
    sellPrice: 40,
    defenseBonus: 1,
    maxHpBonus: 5
  },
  silverRing: {
    id: "silverRing",
    name: "銀の指輪",
    category: "accessory",
    description: "MP+3",
    rarity: 2,
    buyPrice: 45,
    maxMpBonus: 3
  },
  emberCharm: {
    id: "emberCharm",
    name: "火種のお守り",
    category: "accessory",
    description: "攻撃+1 MP+4",
    rarity: 3,
    sellPrice: 60,
    attackBonus: 1,
    maxMpBonus: 4
  }
};

export function isEquipmentId(value: unknown): value is EquipmentId {
  return typeof value === "string" && EQUIPMENT_ORDER.includes(value as EquipmentId);
}

export function canEquipToSlot(equipmentId: EquipmentId, slot: EquipmentSlot): boolean {
  const category = EQUIPMENT[equipmentId].category;
  if (slot === "accessory1" || slot === "accessory2") {
    return category === "accessory";
  }
  return category === slot;
}

export function isEquipmentBuyable(equipmentId: EquipmentId): boolean {
  return EQUIPMENT[equipmentId].buyPrice !== undefined;
}

export function getEquipmentBuyPrice(equipmentId: EquipmentId): number {
  return EQUIPMENT[equipmentId].buyPrice ?? 0;
}

export function getEquipmentSellPrice(equipmentId: EquipmentId): number {
  const equipment = EQUIPMENT[equipmentId];
  return equipment.sellPrice ?? Math.floor((equipment.buyPrice ?? 0) / 2);
}

export function getEquipmentRarityLabel(equipmentId: EquipmentId): string {
  return `☆${EQUIPMENT[equipmentId].rarity}`;
}

export function getEquipmentStatSummary(equipmentId: EquipmentId): string {
  const equipment = EQUIPMENT[equipmentId];
  const parts: string[] = [];
  if (equipment.attackBonus) {
    parts.push(`攻+${equipment.attackBonus}`);
  }
  if (equipment.defenseBonus) {
    parts.push(`防+${equipment.defenseBonus}`);
  }
  if (equipment.maxHpBonus) {
    parts.push(`HP+${equipment.maxHpBonus}`);
  }
  if (equipment.maxMpBonus) {
    parts.push(`MP+${equipment.maxMpBonus}`);
  }
  return parts.join(" ") || "能力なし";
}

export function createEmptyEquipmentStats(): EquipmentStats {
  return {
    attackBonus: 0,
    defenseBonus: 0,
    maxHpBonus: 0,
    maxMpBonus: 0
  };
}
