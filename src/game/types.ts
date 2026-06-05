export type Direction = "up" | "down" | "left" | "right";
export type MapId = "village" | "field" | "dungeon";

export interface TilePosition {
  x: number;
  y: number;
}

export interface EnemyDefinition {
  key: string;
  name: string;
  maxHp: number;
  attack: number;
  exp: number;
  gold: number;
  texture: string;
  boss?: boolean;
}

export interface EnemySpawn extends TilePosition {
  id: string;
  enemyKey: string;
}

export interface NpcDefinition extends TilePosition {
  id: string;
  name: string;
  texture: string;
  solid?: boolean;
}

export interface ChestDefinition extends TilePosition {
  id: string;
  reward?: ChestReward;
}

export type ItemId = "herb" | "strongHerb" | "magicWater" | "manaWater" | "returnFeather";
export type Inventory = Partial<Record<ItemId, number>>;

export type EquipmentCategory =
  | "weapon"
  | "shield"
  | "head"
  | "bodyUpper"
  | "bodyLower"
  | "accessory";
export type EquipmentSlot =
  | "weapon"
  | "shield"
  | "head"
  | "bodyUpper"
  | "bodyLower"
  | "accessory1"
  | "accessory2";
export type EquipmentId =
  | "woodSword"
  | "ironSword"
  | "roundShield"
  | "kiteShield"
  | "clothCap"
  | "ironHelm"
  | "paddedVest"
  | "chainMail"
  | "travelerPants"
  | "reinforcedGreaves"
  | "silverRing"
  | "emberCharm";
export type EquipmentInventory = Partial<Record<EquipmentId, number>>;
export type EquipmentLoadout = Partial<Record<EquipmentSlot, EquipmentId>>;

export interface ItemReward {
  type: "item";
  itemId: ItemId;
  quantity: number;
}

export interface EquipmentReward {
  type: "equipment";
  equipmentId: EquipmentId;
  quantity: number;
}

export interface RelicReward {
  type: "relic";
}

export type ChestReward = ItemReward | EquipmentReward | RelicReward;

export interface PortalDefinition extends TilePosition {
  toMap: MapId;
  toX: number;
  toY: number;
  toFloor?: number;
  kind?: "map" | "stairs-up" | "stairs-down";
}

export interface MapDefinition {
  id: MapId;
  name: string;
  floor?: number;
  floorCount?: number;
  rows: string[];
  spawn: TilePosition;
  portals: PortalDefinition[];
  npcs: NpcDefinition[];
  chests: ChestDefinition[];
  enemies: EnemySpawn[];
}

export interface GameSave {
  mapId: MapId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  level: number;
  exp: number;
  gold: number;
  potions: number;
  items: Inventory;
  equipmentInventory: EquipmentInventory;
  equipment: EquipmentLoadout;
  flags: Record<string, boolean>;
  defeatedEnemies: string[];
  generatedDungeon?: MapDefinition;
  dungeonTier?: number;
  dungeonFloorCount?: number;
  currentDungeonFloor?: number;
  generatedDungeonFloors?: Record<string, MapDefinition>;
}

export interface BattlePayload {
  enemyInstanceId: string;
  enemyKey: string;
}
