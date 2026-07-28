import type { CompanionId } from "../data/companions";

export type Direction = "up" | "down" | "left" | "right";
export type MapId = "village" | "field" | "dungeon" | "hiddenVillage";

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
  /** MP pool for enemy skills (see data/enemySkills.ts) — 0/undefined means
   * this enemy only ever uses its free basic attack. */
  maxMp?: number;
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

export type ItemId =
  | "herb"
  | "strongHerb"
  | "magicWater"
  | "manaWater"
  | "returnFeather"
  | "burnCure"
  | "poisonCure"
  | "stunCure"
  | "panacea";
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
  | "emberCharm"
  | "steelRapier"
  | "scaleMail"
  | "towerShield"
  | "swiftGreaves"
  | "hornedHelm"
  | "sagesPendant"
  | "masterworkGreatsword"
  | "masterworkAegis"
  | "masterworkCirclet"
  | "masterworkPlate"
  | "masterworkGreaves"
  | "masterworkSigil";
export type EquipmentInventory = Partial<Record<EquipmentId, number>>;
export type EquipmentLoadout = Partial<Record<EquipmentSlot, EquipmentId>>;

/** One companion's persisted vitals/loadout, keyed by CompanionId in GameSave.companions. */
export interface CompanionSaveState {
  hp?: number;
  mp?: number;
  equipment?: EquipmentLoadout;
}

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
  /** Portal only functions (and only renders its icon) once this save flag is true. */
  requiresFlag?: string;
}

export interface MapDefinition {
  id: MapId;
  name: string;
  floor?: number;
  floorCount?: number;
  /** Which dungeon tier this map's interior should be themed as (only meaningful when id is "dungeon"). */
  tier?: number;
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
  /** Save schema generation, bumped whenever a migration changes the save's
   * shape. Absent on saves written before this field existed (treated as 0). */
  saveVersion?: number;
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
  /** Upgrade level (0-MAX_EQUIPMENT_UPGRADE_LEVEL) per equipment id — global
   * to the id, not per owned copy, so upgrading "ironSword" once upgrades
   * every iron sword the player owns or will ever find. */
  equipmentUpgrades?: Partial<Record<EquipmentId, number>>;
  flags: Record<string, boolean>;
  /** Each recruited companion's vitals/loadout, keyed by id — add a new CompanionId (data/companions.ts) to give it a slot here. */
  companions?: Partial<Record<CompanionId, CompanionSaveState>>;
  defeatedEnemies: string[];
  /** Which dungeon tier the player is currently inside (or last entered). */
  activeDungeonTier?: number;
  /** Each tier's dungeon crawl (floor count, current floor, generated floors) is tracked independently, so revisiting an earlier tier doesn't disturb a later one. */
  dungeonProgressByTier?: Record<number, DungeonTierProgress>;
}

export interface BattlePayload {
  /** The map enemy that triggered the fight; markEnemyDefeated() uses this to remove it from the map. */
  enemyInstanceId: string;
  /** 1-3 enemies in this fight. Any extras beyond the first are ambush reinforcements with no map presence of their own. */
  enemyKeys: string[];
}
