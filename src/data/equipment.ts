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
  speedBonus?: number;
}

export interface EquipmentStats {
  attackBonus: number;
  defenseBonus: number;
  maxHpBonus: number;
  maxMpBonus: number;
  speedBonus: number;
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
  "emberCharm",
  "steelRapier",
  "scaleMail",
  "towerShield",
  "swiftGreaves",
  "hornedHelm",
  "sagesPendant",
  "masterworkGreatsword",
  "masterworkAegis",
  "masterworkCirclet",
  "masterworkPlate",
  "masterworkGreaves",
  "masterworkSigil"
];

export const EQUIPMENT_SHOP_ORDER: EquipmentId[] = [
  "woodSword",
  "roundShield",
  "clothCap",
  "paddedVest",
  "travelerPants",
  "silverRing"
];

export const MASTERWORK_EQUIPMENT_ORDER: EquipmentId[] = [
  "masterworkGreatsword",
  "masterworkAegis",
  "masterworkCirclet",
  "masterworkPlate",
  "masterworkGreaves",
  "masterworkSigil"
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
    description: "防御+1 素早さ+1",
    rarity: 1,
    buyPrice: 18,
    defenseBonus: 1,
    speedBonus: 1
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
    description: "HP+3 素早さ+2",
    rarity: 1,
    buyPrice: 24,
    maxHpBonus: 3,
    speedBonus: 2
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
    description: "MP+3 素早さ+1",
    rarity: 2,
    buyPrice: 45,
    maxMpBonus: 3,
    speedBonus: 1
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
  },
  steelRapier: {
    id: "steelRapier",
    name: "鋼のレイピア",
    category: "weapon",
    description: "攻撃+7 素早さ+2",
    rarity: 3,
    sellPrice: 70,
    attackBonus: 7,
    speedBonus: 2
  },
  scaleMail: {
    id: "scaleMail",
    name: "鱗の鎧",
    category: "bodyUpper",
    description: "防御+4 HP+6",
    rarity: 3,
    sellPrice: 72,
    defenseBonus: 4,
    maxHpBonus: 6
  },
  towerShield: {
    id: "towerShield",
    name: "タワーシールド",
    category: "shield",
    description: "防御+4 HP+5",
    rarity: 3,
    sellPrice: 68,
    defenseBonus: 4,
    maxHpBonus: 5
  },
  swiftGreaves: {
    id: "swiftGreaves",
    name: "疾風の脚甲",
    category: "bodyLower",
    description: "素早さ+3 HP+2",
    rarity: 3,
    sellPrice: 66,
    speedBonus: 3,
    maxHpBonus: 2
  },
  hornedHelm: {
    id: "hornedHelm",
    name: "角兜",
    category: "head",
    description: "防御+3 攻撃+1",
    rarity: 3,
    sellPrice: 64,
    defenseBonus: 3,
    attackBonus: 1
  },
  sagesPendant: {
    id: "sagesPendant",
    name: "賢者のペンダント",
    category: "accessory",
    description: "MP+6 攻撃+2",
    rarity: 4,
    sellPrice: 90,
    maxMpBonus: 6,
    attackBonus: 2
  },
  masterworkGreatsword: {
    id: "masterworkGreatsword",
    name: "常闇の大剣",
    category: "weapon",
    description: "攻撃+11 素早さ+3",
    rarity: 5,
    buyPrice: 450,
    attackBonus: 11,
    speedBonus: 3
  },
  masterworkAegis: {
    id: "masterworkAegis",
    name: "霧守りの大盾",
    category: "shield",
    description: "防御+6 HP+8",
    rarity: 5,
    buyPrice: 420,
    defenseBonus: 6,
    maxHpBonus: 8
  },
  masterworkCirclet: {
    id: "masterworkCirclet",
    name: "深霧の兜",
    category: "head",
    description: "防御+4 攻撃+2",
    rarity: 5,
    buyPrice: 380,
    defenseBonus: 4,
    attackBonus: 2
  },
  masterworkPlate: {
    id: "masterworkPlate",
    name: "隠れ里の重鎧",
    category: "bodyUpper",
    description: "防御+6 HP+9",
    rarity: 5,
    buyPrice: 430,
    defenseBonus: 6,
    maxHpBonus: 9
  },
  masterworkGreaves: {
    id: "masterworkGreaves",
    name: "霧走りの脚甲",
    category: "bodyLower",
    description: "素早さ+4 HP+4",
    rarity: 5,
    buyPrice: 400,
    speedBonus: 4,
    maxHpBonus: 4
  },
  masterworkSigil: {
    id: "masterworkSigil",
    name: "帝王の紋章",
    category: "accessory",
    description: "MP+8 攻撃+3",
    rarity: 5,
    buyPrice: 400,
    maxMpBonus: 8,
    attackBonus: 3
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

export function getEquipmentStatSummary(equipmentId: EquipmentId, level = 0): string {
  const stats = getUpgradedEquipmentStats(equipmentId, level);
  const parts: string[] = [];
  if (stats.attackBonus) {
    parts.push(`攻+${stats.attackBonus}`);
  }
  if (stats.defenseBonus) {
    parts.push(`防+${stats.defenseBonus}`);
  }
  if (stats.maxHpBonus) {
    parts.push(`HP+${stats.maxHpBonus}`);
  }
  if (stats.maxMpBonus) {
    parts.push(`MP+${stats.maxMpBonus}`);
  }
  if (stats.speedBonus) {
    parts.push(`速+${stats.speedBonus}`);
  }
  return parts.join(" ") || "能力なし";
}

export function getEquipmentStatDelta(
  currentId: EquipmentId | undefined,
  candidateId: EquipmentId,
  currentLevel = 0,
  candidateLevel = 0
): string {
  const current = currentId ? getUpgradedEquipmentStats(currentId, currentLevel) : createEmptyEquipmentStats();
  const candidate = getUpgradedEquipmentStats(candidateId, candidateLevel);
  const parts: string[] = [];

  const pushDelta = (key: keyof EquipmentStats, label: string) => {
    const delta = candidate[key] - current[key];
    if (delta !== 0) {
      parts.push(`${label}${delta > 0 ? "+" : ""}${delta}`);
    }
  };

  pushDelta("attackBonus", "攻");
  pushDelta("defenseBonus", "防");
  pushDelta("maxHpBonus", "HP");
  pushDelta("maxMpBonus", "MP");
  pushDelta("speedBonus", "速");

  return parts.join(" ") || "変化なし";
}

export function createEmptyEquipmentStats(): EquipmentStats {
  return {
    attackBonus: 0,
    defenseBonus: 0,
    maxHpBonus: 0,
    maxMpBonus: 0,
    speedBonus: 0
  };
}

// A repeatable gold sink for gear you already own: each level adds a flat
// +1 to every stat the piece already grants (not a percentage — a flat
// bump stays meaningful whether the base bonus is +1 like a starter cap or
// +11 like a masterwork greatsword, where a percentage would round away to
// nothing on the small end). Upgrade levels are per equipment id, not per
// owned copy — see GameState.ts's equipmentUpgrades for why.
export const MAX_EQUIPMENT_UPGRADE_LEVEL = 2;

export function getEquipmentUpgradeLabel(level: number): string {
  return level > 0 ? `+${level}` : "";
}

export function getEquipmentUpgradeCost(equipmentId: EquipmentId, currentLevel: number): number {
  const equipment = EQUIPMENT[equipmentId];
  const base = equipment.buyPrice ?? (equipment.sellPrice ? equipment.sellPrice * 2 : 20);
  return Math.max(10, Math.round(base * (currentLevel + 1) * 0.5));
}

export function getUpgradedEquipmentStats(equipmentId: EquipmentId, level: number): EquipmentStats {
  const equipment = EQUIPMENT[equipmentId];
  const bump = (value?: number) => (value ? value + level : 0);
  return {
    attackBonus: bump(equipment.attackBonus),
    defenseBonus: bump(equipment.defenseBonus),
    maxHpBonus: bump(equipment.maxHpBonus),
    maxMpBonus: bump(equipment.maxMpBonus),
    speedBonus: bump(equipment.speedBonus)
  };
}
