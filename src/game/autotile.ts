// Frame layout for the generated terrain spritesheets. Must stay in sync
// with scripts/generate-terrain-tiles.mjs, which bakes these exact frame
// indices when it builds public/assets/tiles/terrain-*.png.
//
// Corner-blend convention (matches Tiled's classic terrain-corner model):
// the tile drawn at grid cell (x,y) has four corners, each belonging to the
// map cell diagonally in that direction — top-left owned by (x-1,y-1),
// top-right by (x,y-1), bottom-left by (x-1,y), bottom-right by (x,y)
// itself. A cell surrounded by a single other ground type therefore picks
// one of 16 boolean corner combinations from that pair's blend sheet.

export const TERRAIN_OVERWORLD_KEY = "terrain-overworld";
export const TERRAIN_DUNGEON_KEY = "terrain-dungeon";

export type GroundGroup = "grass" | "tallGrass" | "path" | "water";

// Row 0 solids, frames 0-3.
const GROUND_GROUPS: GroundGroup[] = ["grass", "tallGrass", "path", "water"];

// Rows 1-6, 16 frames each. Order fixed by the build script.
const GROUND_PAIRS: [GroundGroup, GroundGroup][] = [
  ["grass", "tallGrass"],
  ["grass", "path"],
  ["grass", "water"],
  ["tallGrass", "path"],
  ["tallGrass", "water"],
  ["path", "water"]
];

export function overworldGroundGroup(tile: string): GroundGroup | null {
  switch (tile) {
    case ".":
      return "grass";
    case ",":
    case "S":
    case "G":
      return "tallGrass";
    case "=":
    case "O":
      return "path";
    case "~":
      return "water";
    case "B":
    case "D":
    case "T":
    case "U":
    case "V":
      return "grass";
    default:
      return null;
  }
}

function neighborGroup(
  rows: string[],
  x: number,
  y: number,
  groupOf: (tile: string) => string | null,
  self: string
): string {
  const row = rows[y];
  if (!row || x < 0 || x >= row.length) {
    return self;
  }
  // A non-ground neighbor (house/tree/rock, or an unmapped char) is treated
  // as if it were `self`, so building/tree edges don't force a stray blend.
  return groupOf(row[x]) ?? self;
}

function pickBlendFrame(
  groups: readonly string[],
  pairs: readonly [string, string][],
  self: string,
  tl: string,
  tr: string,
  bl: string
): number {
  const counts = new Map<string, number>();
  for (const g of [tl, tr, bl]) {
    if (g !== self) {
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  let partner = self;
  let best = 0;
  counts.forEach((count, g) => {
    if (count > best) {
      best = count;
      partner = g;
    }
  });

  const solidIndex = groups.indexOf(self);
  if (partner === self) {
    return solidIndex;
  }

  const pairIndex = pairs.findIndex(
    ([a, b]) => (a === self && b === partner) || (a === partner && b === self)
  );
  if (pairIndex === -1) {
    return solidIndex;
  }
  const [a, b] = pairs[pairIndex];
  // A third terrain that isn't part of this pair collapses to `self` — we
  // only have blend art for two terrains meeting at once.
  const normalize = (g: string) => (g === a || g === b ? g : self);
  const bit = (g: string) => (normalize(g) === b ? 1 : 0);
  const bitmask = bit(tl) | (bit(tr) << 1) | (bit(bl) << 2) | (bit(self) << 3);
  return (1 + pairIndex) * 16 + bitmask;
}

/** Returns the terrain-overworld spritesheet frame for a ground tile, or
 * null if this map char isn't a blendable ground type (house/tree/rock/etc,
 * which keep their own dedicated texture). */
export function overworldTileFrame(rows: string[], x: number, y: number): number | null {
  const self = overworldGroundGroup(rows[y][x]);
  if (!self) {
    return null;
  }
  const tl = neighborGroup(rows, x - 1, y - 1, overworldGroundGroup, self);
  const tr = neighborGroup(rows, x, y - 1, overworldGroundGroup, self);
  const bl = neighborGroup(rows, x - 1, y, overworldGroundGroup, self);
  return pickBlendFrame(GROUND_GROUPS, GROUND_PAIRS, self, tl, tr, bl);
}

type DungeonGroup = "wall" | "floor" | "water";

function dungeonGroundGroup(tile: string): DungeonGroup {
  if (tile === "#") {
    return "wall";
  }
  if (tile === "~") {
    return "water";
  }
  return "floor";
}

/** Returns the {key, frame} to draw for a dungeon tile at (x,y) for the
 * given tier (1-4). Water pools reuse the overworld sheet's solid water
 * frame since this atlas has no wall/floor-vs-water blend art. */
export function dungeonTileFrame(
  rows: string[],
  x: number,
  y: number,
  tier: number
): { key: string; frame: number } {
  const self = dungeonGroundGroup(rows[y][x]);
  if (self === "water") {
    return { key: TERRAIN_OVERWORLD_KEY, frame: GROUND_GROUPS.indexOf("water") };
  }

  const base = (Math.max(1, Math.min(4, tier)) - 1) * 32;
  const neighbor = (nx: number, ny: number): "wall" | "floor" => {
    const row = rows[ny];
    if (!row || nx < 0 || nx >= row.length) {
      return self;
    }
    const group = dungeonGroundGroup(row[nx]);
    return group === "water" ? self : group;
  };

  const tl = neighbor(x - 1, y - 1);
  const tr = neighbor(x, y - 1);
  const bl = neighbor(x - 1, y);

  if (tl === self && tr === self && bl === self) {
    return { key: TERRAIN_DUNGEON_KEY, frame: base + (self === "wall" ? 0 : 1) };
  }

  const bit = (g: "wall" | "floor") => (g === "floor" ? 1 : 0);
  const bitmask = bit(tl) | (bit(tr) << 1) | (bit(bl) << 2) | (bit(self) << 3);
  return { key: TERRAIN_DUNGEON_KEY, frame: base + 16 + bitmask };
}
