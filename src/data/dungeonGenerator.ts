import { Map as RotMap, RNG as RotRng } from "rot-js";
import { DUNGEON_ENEMY_KEYS, type DungeonEnemyKey } from "./enemies";
import type {
  ChestReward,
  EnemySpawn,
  EquipmentId,
  ItemId,
  MapDefinition,
  MapId,
  NpcDefinition,
  PortalDefinition,
  TilePosition
} from "../game/types";

const BASE_WIDTH = 40;
const BASE_HEIGHT = 30;
// Floors past this depth grow wider/taller than the base layout so a long
// tier-3 descent (up to floor 8) feels progressively larger.
export const DEEP_FLOOR_THRESHOLD = 5;
const DEEP_WIDTH_STEP = 4;
const DEEP_HEIGHT_STEP = 3;
// Cellular-automaton cave shape (see generateCaveGrid). This is the classic
// "B5678/S45678" cave rule: dense enough after a few smoothing passes to read
// as natural rock chambers rather than a maze of 1-wide tunnels.
const CAVE_FILL_PROBABILITY = 0.5;
const CAVE_SMOOTHING_ITERATIONS = 4;
const CAVE_CONNECTIVITY_ATTEMPTS = 5;
const SECTOR_BASE_COLS = 3;
const SECTOR_ROWS = 2;
// Any depth's supply chest has this flat chance to give a status-cure item
// instead of its usual depth-scaled loot (see pickSupplyChestReward) —
// panacea is deliberately rare within that slice since it's the only way to
// get one at all (it's never shop-buyable, unlike the three single cures).
const STATUS_CURE_ITEM_CHANCE = 0.12;
const STATUS_CURE_ITEM_WEIGHTS: ItemId[] = [
  "poisonCure",
  "poisonCure",
  "burnCure",
  "burnCure",
  "stunCure",
  "stunCure",
  "panacea"
];
const MIN_SUPPLY_CHESTS = 1;
const MAX_SUPPLY_CHESTS = 3;
const MAX_SUPPLY_CHESTS_WITH_DEPTH_BONUS = 6;
const REGULAR_ENEMY_COUNT = 5;
const DUNGEON_NAMES: Record<number, string> = {
  1: "エンバーフォール洞窟",
  2: "黒曜の深層洞窟",
  3: "月蝕の深奥",
  4: "霧隠れの深部"
};
// Which overworld map + tile a dungeon tier's floor-1 stairs lead back up
// to. Tiers 1-3 all surface on the field; tier 4 surfaces on "highlands"
// instead (see MAPS.highlands in data/maps.ts) since the field is already
// home to every other tier's entrance.
const DUNGEON_ENTRANCES: Record<number, { mapId: MapId } & TilePosition> = {
  1: { mapId: "field", x: 6, y: 24 },
  2: { mapId: "field", x: 34, y: 6 },
  3: { mapId: "field", x: 36, y: 16 },
  4: { mapId: "highlands", x: 38, y: 24 }
};
const TIER_3_DUNGEON_ENEMY_WEIGHTS: DungeonEnemyKey[] = [
  "orc",
  "direWolf",
  "direWolf",
  "darkMage",
  "darkMage",
  "stoneGolem",
  "stoneGolem",
  "mimic"
];
// Tier 4 deliberately reuses tier 3's regular-enemy pool as-is — the new
// boss is the point of tier 4, not a brand-new bestiary.
const DUNGEON_ENEMY_WEIGHTS_BY_TIER: Record<number, DungeonEnemyKey[]> = {
  1: [
    "goblin",
    "goblin",
    "bat",
    "skeleton",
    "wolf",
    "mage",
    "mimic"
  ],
  2: [
    "skeleton",
    "wolf",
    "mage",
    "mimic",
    "orc",
    "orc",
    "direWolf",
    "darkMage",
    "stoneGolem"
  ],
  3: TIER_3_DUNGEON_ENEMY_WEIGHTS,
  4: TIER_3_DUNGEON_ENEMY_WEIGHTS
};
type SupplyChestEquipmentBucket = "early" | "mid" | "late";
const TIER_3_SUPPLY_CHEST_EARLY_EQUIPMENT: EquipmentId[] = ["clothCap", "roundShield", "ironHelm"];
const TIER_3_SUPPLY_CHEST_MID_EQUIPMENT: EquipmentId[] = [
  "ironSword",
  "kiteShield",
  "steelRapier",
  "scaleMail"
];
const TIER_3_SUPPLY_CHEST_LATE_EQUIPMENT: EquipmentId[] = [
  "chainMail",
  "reinforcedGreaves",
  "emberCharm",
  "towerShield",
  "swiftGreaves",
  "hornedHelm",
  "sagesPendant"
];
// New gear is layered on top of the tier-1 pool starting at tier 2, and
// tier 3 layers in a few extra rare finds on top of that — mirroring
// DUNGEON_ENEMY_WEIGHTS_BY_TIER's "new content from tier 2 on" shape. Tier 4
// reuses tier 3's pools as-is (the new masterwork gear is shop-only, not
// chest loot, so no new chest-only items are added for tier 4).
const SUPPLY_CHEST_EQUIPMENT_BY_TIER: Record<SupplyChestEquipmentBucket, Record<number, EquipmentId[]>> = {
  early: {
    1: ["clothCap", "roundShield"],
    2: TIER_3_SUPPLY_CHEST_EARLY_EQUIPMENT,
    3: TIER_3_SUPPLY_CHEST_EARLY_EQUIPMENT,
    4: TIER_3_SUPPLY_CHEST_EARLY_EQUIPMENT
  },
  mid: {
    1: ["ironSword", "kiteShield"],
    2: TIER_3_SUPPLY_CHEST_MID_EQUIPMENT,
    3: TIER_3_SUPPLY_CHEST_MID_EQUIPMENT,
    4: TIER_3_SUPPLY_CHEST_MID_EQUIPMENT
  },
  late: {
    1: ["chainMail", "reinforcedGreaves", "emberCharm"],
    2: ["chainMail", "reinforcedGreaves", "emberCharm", "towerShield", "swiftGreaves"],
    3: TIER_3_SUPPLY_CHEST_LATE_EQUIPMENT,
    4: TIER_3_SUPPLY_CHEST_LATE_EQUIPMENT
  }
};
const DUNGEON_GUARDIAN_KEYS: Record<number, string> = {
  1: "guardian",
  2: "deepGuardian",
  3: "eclipseBeast",
  4: "mistSovereign"
};
const RELIC_CHEST_IDS: Record<number, string> = {
  1: "relic-chest",
  2: "moon-relic-chest"
};
const FINAL_RELIC_MAX_TIER = 2;
export type DungeonWallAccent = "ember" | "crystal" | "rune" | "mist";
export interface DungeonTileTheme {
  wallBase: string;
  wallShade: string;
  wallHighlight: string;
  floorBase: string;
  floorShade: string;
  floorHighlight: string;
  accent: DungeonWallAccent;
}
// Each tier gets its own wall/floor palette (and a small wall accent motif) so
// the dungeons read as visually distinct places, not just the same corridors
// recolored once — matching the increasingly ominous tier names above
// (ember cave -> obsidian depths -> lunar eclipse -> misty depths).
const DUNGEON_TILE_THEME_BY_TIER: Record<number, DungeonTileTheme> = {
  1: {
    wallBase: "#3a2a22",
    wallShade: "#211510",
    wallHighlight: "#c9793f",
    floorBase: "#6a5d48",
    floorShade: "#423b31",
    floorHighlight: "#caa25a",
    accent: "ember"
  },
  2: {
    wallBase: "#20242f",
    wallShade: "#111319",
    wallHighlight: "#5ec9e6",
    floorBase: "#2b2f3a",
    floorShade: "#1a1d24",
    floorHighlight: "#4fb3d1",
    accent: "crystal"
  },
  3: {
    wallBase: "#2a1f3a",
    wallShade: "#160f21",
    wallHighlight: "#b98fe0",
    floorBase: "#332942",
    floorShade: "#1e1729",
    floorHighlight: "#8f6fc9",
    accent: "rune"
  },
  4: {
    wallBase: "#22302f",
    wallShade: "#121b1a",
    wallHighlight: "#7fd9c4",
    floorBase: "#2b3a38",
    floorShade: "#182422",
    floorHighlight: "#5fb8a0",
    accent: "mist"
  }
};
const DEFAULT_DUNGEON_ENEMY_WEIGHTS: DungeonEnemyKey[] = [
  "goblin",
  "goblin",
  "bat",
  "skeleton",
  "wolf",
  "mage",
  "mimic"
];

type Grid = string[][];
type Rng = () => number;

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DungeonGenerationOptions {
  seed?: number;
  floor?: number;
  floorCount?: number;
  upTarget?: TilePosition;
  tier?: number;
}

export function generateDungeon(
  seedOrOptions: number | DungeonGenerationOptions = {}
): MapDefinition {
  const options = typeof seedOrOptions === "number" ? { seed: seedOrOptions } : seedOrOptions;
  const seed = options.seed ?? createDungeonSeed();
  const floorCount = Math.max(1, options.floorCount ?? 1);
  const floor = clamp(options.floor ?? 1, 1, floorCount);
  const tier = normalizeDungeonTier(options.tier);
  const isFinalFloor = floor >= floorCount;
  const rng = createRng(seed);
  const { width, height } = getDungeonDimensions(floor);
  const extraDepth = Math.max(0, floor - DEEP_FLOOR_THRESHOLD);
  // The start/end rooms stay explicit rectangles — they anchor the spawn,
  // stairs, relic and guardian placements below, and read fine as small
  // carved chambers even inside an otherwise organic cave. Everything
  // between them is a cellular-automaton cave (generateCaveGrid) instead of
  // the old grid of rectangular rooms + straight corridors, so the bulk of
  // the dungeon no longer reads as placed blocks.
  const startRoom: Room = { x: 1, y: 1, w: 8, h: 6 };
  const endRoom = clampRoom(
    {
      x: randomInt(rng, 26, 29),
      y: randomInt(rng, 20, 23),
      w: 8,
      h: 6
    },
    BASE_WIDTH,
    BASE_HEIGHT
  );
  const grid = buildConnectedCaveGrid(width, height, seed, startRoom, endRoom, rng);

  // Enemies/chests/water pools used to be scattered one-per-rectangular-room;
  // the cave has no natural "rooms" to anchor on, so instead divide its
  // bounding box into evenly sized sectors and sample a random open floor
  // tile within each (findOpenFloorNear already handles a sector center
  // landing on a wall cell). This reproduces the same "spread across the
  // map, not clustered" distribution the room-based pool used to give.
  const sectors = buildSectors(width, height, extraDepth);

  const spawn = { x: 1, y: 1 };
  const dungeonEntrance = getDungeonEntranceForTier(tier);
  const reserved = new Set<string>([positionKey(spawn)]);
  const enemies: EnemySpawn[] = [];
  const portals: PortalDefinition[] = [
    floor === 1
      ? {
          x: spawn.x,
          y: spawn.y,
          toMap: dungeonEntrance.mapId,
          toX: dungeonEntrance.x,
          toY: dungeonEntrance.y,
          kind: "stairs-up"
        }
      : {
          x: spawn.x,
          y: spawn.y,
          toMap: "dungeon",
          toFloor: floor - 1,
          toX: options.upTarget?.x ?? 1,
          toY: options.upTarget?.y ?? 1,
          kind: "stairs-up",
          dungeonTier: tier
        }
  ];
  const requiredTiles: TilePosition[] = [spawn];
  const endCenter = roomCenter(endRoom);

  const hasFinalRelic = hasFinalRelicForTier(tier);
  let relicChest: TilePosition | undefined;
  let guardian: TilePosition | undefined;
  if (isFinalFloor) {
    if (hasFinalRelic) {
      relicChest = { x: endCenter.x, y: Math.max(endRoom.y + 1, endCenter.y - 1) };
      placeMarker(grid, relicChest, "B");
      reserved.add(positionKey(relicChest));
    }

    guardian = findOpenFloorNear(
      grid,
      relicChest ? { x: relicChest.x, y: relicChest.y + 1 } : endCenter,
      reserved
    );
    placeMarker(grid, guardian, "D");
    reserved.add(positionKey(guardian));
    requiredTiles.push(guardian);
  } else {
    const downStairs = findOpenFloorNear(grid, endCenter, reserved);
    placeMarker(grid, downStairs, "V");
    reserved.add(positionKey(downStairs));
    requiredTiles.push(downStairs);
    portals.push({
      x: downStairs.x,
      y: downStairs.y,
      toMap: "dungeon",
      toFloor: floor + 1,
      toX: 1,
      toY: 1,
      kind: "stairs-down",
      dungeonTier: tier
    });
  }

  const regularEnemyPositions = shuffled(sectors, rng)
    .slice(0, REGULAR_ENEMY_COUNT)
    .map((room, index) => {
      const preferred = {
        x: randomInt(rng, room.x + 1, room.x + room.w - 2),
        y: randomInt(rng, room.y + 1, room.y + room.h - 2)
      };
      const position = findOpenFloorNear(grid, preferred, reserved);
      const enemyKey = pickDungeonEnemyKey(rng, tier);
      reserved.add(positionKey(position));
      enemies.push({
        id: `dungeon-b${floor}-${enemyKey}-${index + 1}`,
        enemyKey,
        x: position.x,
        y: position.y
      });
      return position;
    });
  requiredTiles.push(...regularEnemyPositions);

  if (guardian) {
    enemies.push({
      id: getGuardianIdForTier(tier),
      enemyKey: getDungeonGuardianKeyForTier(tier),
      x: guardian.x,
      y: guardian.y
    });
  }

  const supplyChestCount = getSupplyChestCount(floor, rng());
  const supplyChests: TilePosition[] = [];
  for (let index = 0; index < supplyChestCount; index += 1) {
    const room = sectors[(floor - 1 + index) % sectors.length];
    const supplyChest = findOpenFloorNear(grid, roomCenter(room), reserved);
    placeMarker(grid, supplyChest, "B");
    reserved.add(positionKey(supplyChest));
    addChestAccessRequirement(grid, supplyChest, reserved, requiredTiles);
    supplyChests.push(supplyChest);
  }

  if (relicChest) {
    addChestAccessRequirement(grid, relicChest, reserved, requiredTiles);
  }

  addWaterPools(grid, rng, sectors, reserved, requiredTiles);
  placeMarker(grid, spawn, "U");

  // Geist, the armored ally, waits on tier 4's first floor — always emitted
  // (like the guardian) and left for the world scene's existing
  // hiddenIfFlag filtering to remove once recruited, matching how Luna's
  // static field NPC is hidden after she joins.
  const npcs: NpcDefinition[] = [];
  if (tier === 4 && floor === 1) {
    const geistPosition = findOpenFloorNear(grid, roomCenter(sectors[3]), reserved);
    reserved.add(positionKey(geistPosition));
    npcs.push({
      id: "geist",
      name: "鎧の魔物ガイスト",
      texture: "companion-geist",
      x: geistPosition.x,
      y: geistPosition.y,
      hiddenIfFlag: "companion2Joined"
    });
  }

  return {
    id: "dungeon",
    name: `${getDungeonNameForTier(tier)} B${floor}F`,
    floor,
    floorCount,
    tier,
    spawn,
    rows: grid.map((row) => row.join("")),
    portals,
    npcs,
    chests: [
      ...supplyChests.map((position, index) => ({
        id: `dungeon-t${tier}-b${floor}-supply-chest-${index + 1}`,
        x: position.x,
        y: position.y,
        reward: pickSupplyChestReward(floor, floorCount, tier, rng)
      })),
      ...(relicChest
        ? [
            {
              id: getRelicChestIdForTier(tier),
              x: relicChest.x,
              y: relicChest.y,
              reward: { type: "relic" } as const
            }
          ]
        : [])
    ],
    enemies
  };
}

export function createDungeonSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function getDungeonNameForTier(tier: number): string {
  return DUNGEON_NAMES[normalizeDungeonTier(tier)] ?? DUNGEON_NAMES[1];
}

export function getDungeonGuardianKeyForTier(tier: number): string {
  return DUNGEON_GUARDIAN_KEYS[normalizeDungeonTier(tier)] ?? DUNGEON_GUARDIAN_KEYS[1];
}

// Tier-scoped so a guardian defeat in one tier's dungeon never suppresses the
// guardian spawn on another tier's final floor (they used to share the
// literal id "dungeon-guardian", which could leave a later tier's boss
// silently un-spawned if the defeat flag carried over, e.g. across a resume).
export function getGuardianIdForTier(tier: number): string {
  return `dungeon-guardian-t${normalizeDungeonTier(tier)}`;
}

export function getRelicChestIdForTier(tier: number): string {
  return RELIC_CHEST_IDS[normalizeDungeonTier(tier)] ?? RELIC_CHEST_IDS[1];
}

export function getDungeonEntranceForTier(tier: number): { mapId: MapId } & TilePosition {
  return DUNGEON_ENTRANCES[normalizeDungeonTier(tier)] ?? DUNGEON_ENTRANCES[1];
}

export function getDungeonTileThemeForTier(tier: number): DungeonTileTheme {
  return DUNGEON_TILE_THEME_BY_TIER[normalizeDungeonTier(tier)] ?? DUNGEON_TILE_THEME_BY_TIER[1];
}

export function getDungeonEnemyKeysForTier(tier: number): DungeonEnemyKey[] {
  const weights =
    DUNGEON_ENEMY_WEIGHTS_BY_TIER[normalizeDungeonTier(tier)] ?? DEFAULT_DUNGEON_ENEMY_WEIGHTS;
  return [...new Set(weights)];
}

export function getSupplyChestEquipmentPool(
  bucket: SupplyChestEquipmentBucket,
  tier: number
): EquipmentId[] {
  const pools = SUPPLY_CHEST_EQUIPMENT_BY_TIER[bucket];
  return pools[normalizeDungeonTier(tier)] ?? pools[1];
}

export function hasFinalRelicForTier(tier: number): boolean {
  return normalizeDungeonTier(tier) <= FINAL_RELIC_MAX_TIER;
}

export function getDungeonDimensions(floor: number): { width: number; height: number } {
  const extraDepth = Math.max(0, floor - DEEP_FLOOR_THRESHOLD);
  return {
    width: BASE_WIDTH + extraDepth * DEEP_WIDTH_STEP,
    height: BASE_HEIGHT + extraDepth * DEEP_HEIGHT_STEP
  };
}

// `roll` is a caller-supplied value in [0, 1) so both the seeded local
// generator (via its rng) and the worker's deterministic AI-assist path
// (via a hash of floor/tier) can share this formula.
export function getSupplyChestCount(floor: number, roll: number): number {
  const base = MIN_SUPPLY_CHESTS + Math.floor(clamp(roll, 0, 0.999999) * MAX_SUPPLY_CHESTS);
  const extraDepth = Math.max(0, floor - DEEP_FLOOR_THRESHOLD);
  const depthBonus = Math.floor(extraDepth / 2);
  return Math.min(base + depthBonus, MAX_SUPPLY_CHESTS_WITH_DEPTH_BONUS);
}

function normalizeDungeonTier(tier: number | undefined): number {
  if (tier && tier >= 4) {
    return 4;
  }
  if (tier && tier >= 3) {
    return 3;
  }
  return tier && tier >= 2 ? 2 : 1;
}

function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createFilledGrid(tile: string, width: number, height: number): Grid {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => tile));
}

// Classic B5678/S45678 cave automaton: randomize ~half the grid as wall,
// smooth it a few times so it clumps into rock masses instead of static, then
// let rot-js's connect() stitch any disconnected pockets together so the
// whole cave is one reachable region. rot-js drives this off its own global
// RNG (separate from this module's seeded `rng`), so it's reseeded here to
// keep generation reproducible for a given seed.
function generateCaveGrid(width: number, height: number, seed: number): Grid {
  RotRng.setSeed(seed);
  const cellular = new RotMap.Cellular(width, height, { born: [5, 6, 7, 8], survive: [4, 5, 6, 7, 8] });
  cellular.randomize(CAVE_FILL_PROBABILITY);
  for (let i = 0; i < CAVE_SMOOTHING_ITERATIONS; i += 1) {
    cellular.create();
  }
  const grid = createFilledGrid("#", width, height);
  cellular.connect((x, y, value) => {
    grid[y][x] = value ? "#" : ".";
  }, 0);
  return grid;
}

// Carves the start/end rooms into a freshly generated cave and links them
// with a straight corridor, then verifies the result is actually traversable
// end to end. rot-js's connect() already guarantees the cave itself is one
// connected blob, and the corridor is virtually certain to cross it (it spans
// most of the map), so this should pass on the first attempt in practice —
// the retry with a perturbed seed is a defensive fallback for a boss/stairs
// room that's unreachable, not a normal code path.
function buildConnectedCaveGrid(
  width: number,
  height: number,
  seed: number,
  startRoom: Room,
  endRoom: Room,
  rng: Rng
): Grid {
  const startCenter = roomCenter(startRoom);
  const endCenter = roomCenter(endRoom);
  let grid: Grid = createFilledGrid("#", width, height);
  for (let attempt = 0; attempt < CAVE_CONNECTIVITY_ATTEMPTS; attempt += 1) {
    grid = generateCaveGrid(width, height, (seed + attempt * 0x9e3779b1) >>> 0);
    carveRoom(grid, startRoom);
    carveRoom(grid, endRoom);
    connectRooms(grid, startCenter, endCenter, rng);
    if (canReachAll(grid, startCenter, [endCenter])) {
      return grid;
    }
  }
  return grid;
}

// Replaces the old per-rectangular-room content pool: the cave has no
// natural "rooms", so this just tiles its bounding box into evenly sized
// sectors. Deep floors get extra columns as the map widens, mirroring how
// the old generator chained extra rooms onto deeper floors.
function buildSectors(width: number, height: number, extraDepth: number): Room[] {
  const cols = SECTOR_BASE_COLS + extraDepth;
  const rows = SECTOR_ROWS;
  const sectorWidth = Math.floor(width / cols);
  const sectorHeight = Math.floor(height / rows);
  const sectors: Room[] = [];
  for (let sectorY = 0; sectorY < rows; sectorY += 1) {
    for (let sectorX = 0; sectorX < cols; sectorX += 1) {
      sectors.push(
        clampRoom(
          {
            x: sectorX * sectorWidth + 1,
            y: sectorY * sectorHeight + 1,
            w: sectorWidth - 2,
            h: sectorHeight - 2
          },
          width,
          height
        )
      );
    }
  }
  return sectors;
}

function clampRoom(room: Room, width: number, height: number): Room {
  const w = clamp(room.w, 3, width - 2);
  const h = clamp(room.h, 3, height - 2);
  return {
    x: clamp(room.x, 1, width - w - 1),
    y: clamp(room.y, 1, height - h - 1),
    w,
    h
  };
}

function carveRoom(grid: Grid, room: Room): void {
  for (let y = room.y; y < room.y + room.h; y += 1) {
    for (let x = room.x; x < room.x + room.w; x += 1) {
      grid[y][x] = ".";
    }
  }
}

function connectRooms(grid: Grid, from: TilePosition, to: TilePosition, rng: Rng): void {
  if (rng() < 0.5) {
    carveHorizontal(grid, from.x, to.x, from.y);
    carveVertical(grid, from.y, to.y, to.x);
    return;
  }

  carveVertical(grid, from.y, to.y, from.x);
  carveHorizontal(grid, from.x, to.x, to.y);
}

function carveHorizontal(grid: Grid, fromX: number, toX: number, y: number): void {
  const start = Math.min(fromX, toX);
  const end = Math.max(fromX, toX);
  for (let x = start; x <= end; x += 1) {
    grid[y][x] = ".";
  }
}

function carveVertical(grid: Grid, fromY: number, toY: number, x: number): void {
  const start = Math.min(fromY, toY);
  const end = Math.max(fromY, toY);
  for (let y = start; y <= end; y += 1) {
    grid[y][x] = ".";
  }
}

function roomCenter(room: Room): TilePosition {
  return {
    x: Math.floor(room.x + room.w / 2),
    y: Math.floor(room.y + room.h / 2)
  };
}

function placeMarker(grid: Grid, position: TilePosition, marker: string): void {
  grid[position.y][position.x] = marker;
}

function findOpenFloorNear(
  grid: Grid,
  preferred: TilePosition,
  reserved: Set<string>
): TilePosition {
  for (let radius = 0; radius <= 4; radius += 1) {
    for (let y = preferred.y - radius; y <= preferred.y + radius; y += 1) {
      for (let x = preferred.x - radius; x <= preferred.x + radius; x += 1) {
        const position = { x, y };
        if (Math.max(Math.abs(preferred.x - x), Math.abs(preferred.y - y)) !== radius) {
          continue;
        }
        if (isOpenFloor(grid, position, reserved)) {
          return position;
        }
      }
    }
  }

  for (let y = 1; y < grid.length - 1; y += 1) {
    for (let x = 1; x < grid[y].length - 1; x += 1) {
      const position = { x, y };
      if (isOpenFloor(grid, position, reserved)) {
        return position;
      }
    }
  }

  return { x: 1, y: 1 };
}

function isOpenFloor(grid: Grid, position: TilePosition, reserved: Set<string>): boolean {
  return grid[position.y]?.[position.x] === "." && !reserved.has(positionKey(position));
}

function addChestAccessRequirement(
  grid: Grid,
  chest: TilePosition,
  reserved: Set<string>,
  requiredTiles: TilePosition[]
): void {
  const accessTiles = adjacentTiles(chest).filter((position) =>
    isWalkableForGeneration(grid, position)
  );
  accessTiles.forEach((position) => reserved.add(positionKey(position)));
  requiredTiles.push(...accessTiles);
}

function pickSupplyChestReward(floor: number, floorCount: number, tier: number, rng: Rng): ChestReward {
  if (rng() < STATUS_CURE_ITEM_CHANCE) {
    const itemId = STATUS_CURE_ITEM_WEIGHTS[randomInt(rng, 0, STATUS_CURE_ITEM_WEIGHTS.length - 1)];
    return { type: "item", itemId, quantity: 1 };
  }

  const depth = floor / floorCount;
  if (depth < 0.34) {
    const roll = rng();
    if (roll < 0.1) {
      const pool = getSupplyChestEquipmentPool("early", tier);
      return {
        type: "equipment",
        equipmentId: pool[randomInt(rng, 0, pool.length - 1)],
        quantity: 1
      };
    }
    if (roll < 0.2) {
      return { type: "item", itemId: "returnFeather", quantity: 1 };
    }
    return roll < 0.36
      ? { type: "item", itemId: "manaWater", quantity: 1 }
      : { type: "item", itemId: "herb", quantity: rng() < 0.35 ? 2 : 1 };
  }
  if (depth < 0.74) {
    const roll = rng();
    if (roll < 0.16) {
      const pool = getSupplyChestEquipmentPool("mid", tier);
      return {
        type: "equipment",
        equipmentId: pool[randomInt(rng, 0, pool.length - 1)],
        quantity: 1
      };
    }
    if (roll < 0.3) {
      return { type: "item", itemId: "returnFeather", quantity: 1 };
    }
    if (roll < 0.52) {
      return { type: "item", itemId: "strongHerb", quantity: 1 };
    }
    return roll < 0.8
      ? { type: "item", itemId: "manaWater", quantity: 1 }
      : { type: "item", itemId: "herb", quantity: 2 };
  }
  const roll = rng();
  if (roll < 0.22) {
    const pool = getSupplyChestEquipmentPool("late", tier);
    return {
      type: "equipment",
      equipmentId: pool[randomInt(rng, 0, pool.length - 1)],
      quantity: 1
    };
  }
  if (roll < 0.42) {
    return { type: "item", itemId: "returnFeather", quantity: 1 };
  }
  if (roll < 0.62) {
    return { type: "item", itemId: "magicWater", quantity: 1 };
  }
  return roll < 0.86
    ? { type: "item", itemId: "manaWater", quantity: 1 }
    : { type: "item", itemId: "strongHerb", quantity: 1 };
}

function addWaterPools(
  grid: Grid,
  rng: Rng,
  rooms: Room[],
  reserved: Set<string>,
  requiredTiles: TilePosition[]
): void {
  const poolCount = randomInt(rng, 3, 6);
  for (let poolIndex = 0; poolIndex < poolCount; poolIndex += 1) {
    const room = rooms[randomInt(rng, 0, rooms.length - 1)];
    const origin = {
      x: randomInt(rng, room.x + 1, room.x + room.w - 2),
      y: randomInt(rng, room.y + 1, room.y + room.h - 2)
    };
    const cells = uniquePositions([
      origin,
      { x: origin.x + randomInt(rng, -1, 1), y: origin.y },
      { x: origin.x, y: origin.y + randomInt(rng, -1, 1) },
      { x: origin.x + randomInt(rng, -1, 1), y: origin.y + randomInt(rng, -1, 1) }
    ]);

    if (!cells.every((position) => isOpenFloor(grid, position, reserved))) {
      continue;
    }

    cells.forEach((position) => {
      grid[position.y][position.x] = "~";
    });

    if (!canReachAll(grid, { x: 1, y: 1 }, requiredTiles)) {
      cells.forEach((position) => {
        grid[position.y][position.x] = ".";
      });
    }
  }
}

function canReachAll(grid: Grid, start: TilePosition, targets: TilePosition[]): boolean {
  const visited = new Set<string>([positionKey(start)]);
  const queue: TilePosition[] = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    adjacentTiles(current).forEach((next) => {
      const key = positionKey(next);
      if (visited.has(key) || !isWalkableForGeneration(grid, next)) {
        return;
      }
      visited.add(key);
      queue.push(next);
    });
  }

  return targets.every((position) => visited.has(positionKey(position)));
}

function isWalkableForGeneration(grid: Grid, position: TilePosition): boolean {
  const tile = grid[position.y]?.[position.x];
  return tile === "." || tile === "U" || tile === "V" || tile === "D";
}

function adjacentTiles(position: TilePosition): TilePosition[] {
  return [
    { x: position.x, y: position.y - 1 },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y }
  ];
}

function uniquePositions(positions: TilePosition[]): TilePosition[] {
  const unique = new Map<string, TilePosition>();
  positions.forEach((position) => {
    unique.set(positionKey(position), position);
  });
  return [...unique.values()];
}

function shuffled<T>(items: T[], rng: Rng): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(rng, 0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function pickDungeonEnemyKey(rng: Rng, tier: number): DungeonEnemyKey {
  const weights = DUNGEON_ENEMY_WEIGHTS_BY_TIER[tier] ?? DEFAULT_DUNGEON_ENEMY_WEIGHTS;
  const weightedKey = weights[randomInt(rng, 0, weights.length - 1)];
  return DUNGEON_ENEMY_KEYS.includes(weightedKey) ? weightedKey : "goblin";
}

function randomInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function positionKey(position: TilePosition): string {
  return `${position.x},${position.y}`;
}
