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
}

export interface PortalDefinition extends TilePosition {
  toMap: MapId;
  toX: number;
  toY: number;
}

export interface MapDefinition {
  id: MapId;
  name: string;
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
  attack: number;
  level: number;
  exp: number;
  gold: number;
  potions: number;
  flags: Record<string, boolean>;
  defeatedEnemies: string[];
  generatedDungeon?: MapDefinition;
}

export interface BattlePayload {
  enemyInstanceId: string;
  enemyKey: string;
}
