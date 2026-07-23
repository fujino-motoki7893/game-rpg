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
  speed: number;
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
  /** NPC only appears once this save flag is true. */
  requiresFlag?: string;
  /** NPC is hidden once this save flag is true (e.g. after joining the party). */
  hiddenIfFlag?: string;
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
  /**
   * "edge" portals sit on an otherwise-blocked border tile just past the
   * last walkable tile; walking into them transitions the map instead of
   * bumping into a wall, so crossing feels like walking off the map's edge
   * rather than stepping onto a marked door tile.
   */
  kind?: "map" | "stairs-up" | "stairs-down" | "edge";
  /** Which dungeon tier this portal leads into/within (only meaningful when toMap is "dungeon"). */
  dungeonTier?: number;
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

export interface DungeonTierProgress {
  floorCount?: number;
  currentFloor?: number;
  generatedFloors?: Record<string, MapDefinition>;
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
  speed: number;
  level: number;
  exp: number;
  gold: number;
  potions: number;
  items: Inventory;
  equipmentInventory: EquipmentInventory;
  equipment: EquipmentLoadout;
  flags: Record<string, boolean>;
  companionHp?: number;
  companionMp?: number;
  companionEquipment?: EquipmentLoadout;
  defeatedEnemies: string[];
  /** Which dungeon tier the player is currently inside (or last entered). */
  activeDungeonTier?: number;
  /** Each tier's dungeon crawl (floor count, current floor, generated floors) is tracked independently, so revisiting an earlier tier doesn't disturb a later one. */
  dungeonProgressByTier?: Record<number, DungeonTierProgress>;
}

export interface BattlePayload {
  enemyInstanceId: string;
  enemyKey: string;
}
