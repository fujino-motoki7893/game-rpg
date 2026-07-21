import { DUNGEON_ENEMY_KEYS, type DungeonEnemyKey } from "./enemies";
import type {
  ChestReward,
  EnemySpawn,
  MapDefinition,
  PortalDefinition,
  TilePosition
} from "../game/types";

const WIDTH = 40;
const HEIGHT = 30;
const REGULAR_ENEMY_COUNT = 5;
const DUNGEON_NAMES: Record<number, string> = {
  1: "エンバーフォール洞窟",
  2: "黒曜の深層洞窟",
  3: "月蝕の深奥"
};
const FIELD_DUNGEON_ENTRANCES: Record<number, TilePosition> = {
  1: { x: 6, y: 24 },
  2: { x: 34, y: 6 },
  3: { x: 36, y: 16 }
};
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
  3: [
    "orc",
    "direWolf",
    "direWolf",
    "darkMage",
    "darkMage",
    "stoneGolem",
    "stoneGolem",
    "mimic"
  ]
};
const DUNGEON_GUARDIAN_KEYS: Record<number, string> = {
  1: "guardian",
  2: "deepGuardian",
  3: "eclipseBeast"
};
const RELIC_CHEST_IDS: Record<number, string> = {
  1: "relic-chest",
  2: "moon-relic-chest"
};
const FINAL_RELIC_MAX_TIER = 2;
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
  const grid = createFilledGrid("#");
  const startRoom: Room = { x: 1, y: 1, w: 8, h: 6 };
  const midRooms = [
    clampRoom({
      x: randomInt(rng, 12, 16),
      y: randomInt(rng, 2, 5),
      w: randomInt(rng, 6, 8),
      h: randomInt(rng, 4, 6)
    }),
    clampRoom({
      x: randomInt(rng, 24, 29),
      y: randomInt(rng, 2, 6),
      w: randomInt(rng, 6, 8),
      h: randomInt(rng, 4, 5)
    }),
    clampRoom({
      x: randomInt(rng, 3, 7),
      y: randomInt(rng, 12, 16),
      w: randomInt(rng, 6, 8),
      h: randomInt(rng, 4, 6)
    }),
    clampRoom({
      x: randomInt(rng, 16, 20),
      y: randomInt(rng, 12, 16),
      w: randomInt(rng, 6, 9),
      h: randomInt(rng, 5, 7)
    }),
    clampRoom({
      x: randomInt(rng, 28, 32),
      y: randomInt(rng, 12, 16),
      w: randomInt(rng, 6, 8),
      h: randomInt(rng, 4, 6)
    }),
    clampRoom({
      x: randomInt(rng, 6, 10),
      y: randomInt(rng, 20, 23),
      w: randomInt(rng, 6, 8),
      h: randomInt(rng, 4, 6)
    })
  ];
  const endRoom = clampRoom({
    x: randomInt(rng, 26, 29),
    y: randomInt(rng, 20, 23),
    w: 8,
    h: 6
  });
  const rooms = [startRoom, ...midRooms, endRoom];

  rooms.forEach((room) => carveRoom(grid, room));
  for (let index = 1; index < rooms.length; index += 1) {
    connectRooms(grid, roomCenter(rooms[index - 1]), roomCenter(rooms[index]), rng);
  }

  const spawn = { x: 1, y: 1 };
  const fieldEntrance = getFieldDungeonEntranceForTier(tier);
  const reserved = new Set<string>([positionKey(spawn)]);
  const enemies: EnemySpawn[] = [];
  const portals: PortalDefinition[] = [
    floor === 1
      ? {
          x: spawn.x,
          y: spawn.y,
          toMap: "field",
          toX: fieldEntrance.x,
          toY: fieldEntrance.y,
          kind: "stairs-up"
        }
      : {
          x: spawn.x,
          y: spawn.y,
          toMap: "dungeon",
          toFloor: floor - 1,
          toX: options.upTarget?.x ?? 1,
          toY: options.upTarget?.y ?? 1,
          kind: "stairs-up"
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
      kind: "stairs-down"
    });
  }

  const regularEnemyPositions = shuffled(midRooms, rng)
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
      id: "dungeon-guardian",
      enemyKey: getDungeonGuardianKeyForTier(tier),
      x: guardian.x,
      y: guardian.y
    });
  }

  const supplyChest = findOpenFloorNear(
    grid,
    roomCenter(midRooms[(floor - 1) % midRooms.length]),
    reserved
  );
  placeMarker(grid, supplyChest, "B");
  reserved.add(positionKey(supplyChest));

  addChestAccessRequirement(grid, supplyChest, reserved, requiredTiles);
  if (relicChest) {
    addChestAccessRequirement(grid, relicChest, reserved, requiredTiles);
  }

  addWaterPools(grid, rng, midRooms, reserved, requiredTiles);
  placeMarker(grid, spawn, "U");

  return {
    id: "dungeon",
    name: `${getDungeonNameForTier(tier)} B${floor}F`,
    floor,
    floorCount,
    spawn,
    rows: grid.map((row) => row.join("")),
    portals,
    npcs: [],
    chests: [
      {
        id: `dungeon-t${tier}-b${floor}-supply-chest`,
        x: supplyChest.x,
        y: supplyChest.y,
        reward: pickSupplyChestReward(floor, floorCount, rng)
      },
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

export function getRelicChestIdForTier(tier: number): string {
  return RELIC_CHEST_IDS[normalizeDungeonTier(tier)] ?? RELIC_CHEST_IDS[1];
}

export function getFieldDungeonEntranceForTier(tier: number): TilePosition {
  return FIELD_DUNGEON_ENTRANCES[normalizeDungeonTier(tier)] ?? FIELD_DUNGEON_ENTRANCES[1];
}

export function getDungeonEnemyKeysForTier(tier: number): DungeonEnemyKey[] {
  const weights =
    DUNGEON_ENEMY_WEIGHTS_BY_TIER[normalizeDungeonTier(tier)] ?? DEFAULT_DUNGEON_ENEMY_WEIGHTS;
  return [...new Set(weights)];
}

export function hasFinalRelicForTier(tier: number): boolean {
  return normalizeDungeonTier(tier) <= FINAL_RELIC_MAX_TIER;
}

function normalizeDungeonTier(tier: number | undefined): number {
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

function createFilledGrid(tile: string): Grid {
  return Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => tile));
}

function clampRoom(room: Room): Room {
  const w = clamp(room.w, 3, WIDTH - 2);
  const h = clamp(room.h, 3, HEIGHT - 2);
  return {
    x: clamp(room.x, 1, WIDTH - w - 1),
    y: clamp(room.y, 1, HEIGHT - h - 1),
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

  for (let y = 1; y < HEIGHT - 1; y += 1) {
    for (let x = 1; x < WIDTH - 1; x += 1) {
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

function pickSupplyChestReward(floor: number, floorCount: number, rng: Rng): ChestReward {
  const depth = floor / floorCount;
  if (depth < 0.34) {
    const roll = rng();
    if (roll < 0.1) {
      return {
        type: "equipment",
        equipmentId: rng() < 0.5 ? "clothCap" : "roundShield",
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
      return {
        type: "equipment",
        equipmentId: rng() < 0.5 ? "ironSword" : "kiteShield",
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
    const equipmentIds = ["chainMail", "reinforcedGreaves", "emberCharm"] as const;
    return {
      type: "equipment",
      equipmentId: equipmentIds[randomInt(rng, 0, equipmentIds.length - 1)],
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
