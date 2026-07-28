import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import AdmZip from "adm-zip";

// Source art: [LPC] Terrains — a corner-blended ("Wang"/terrain-corner) tile
// atlas built for Tiled's classic Terrain tool. Every pair of adjacent
// terrain types the atlas supports ships as all 16 boolean top-left/
// top-right/bottom-left/bottom-right corner combinations, which is exactly
// what this script needs to build seamless autotile sheets.
// https://opengameart.org/content/lpc-terrains (CC-BY-SA 3.0 / CC-BY-SA 4.0)
// See public/assets/tiles/CREDITS.md for full author list.
const ZIP_URL = "https://opengameart.org/sites/default/files/lpc-terrains.zip";
const cacheDir = path.resolve("scripts/.terrain-cache");
const outputDir = path.resolve("public/assets/tiles");

const TSX_ENTRY = "lpc-terrains/terrain-map-v7.tsx";
const PNG_ENTRY = "lpc-terrains/terrain-map-v7.png";
const SRC_TILE = 32;
const SRC_COLUMNS = 16;
const OUT_TILE = 32;
const OUT_COLUMNS = 16;

// Terrain type ids as defined in terrain-map-v7.tsx's <terraintypes>.
const TERRAIN_ID = {
  Dirt_Tan: 3,
  Grass: 5,
  Grass_Dark: 6,
  Water: 28,
  Mudstone_Gray: 17,
  Rock_Gray: 20,
  Ice: 12,
  Snow_1: 23,
  Snow_2: 24
};

async function fetchToCache(url, filename) {
  const cachePath = path.join(cacheDir, filename);
  try {
    await fs.access(cachePath);
    return cachePath;
  } catch {
    // not cached yet
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, buffer);
  return cachePath;
}

async function loadAtlas() {
  const zipPath = await fetchToCache(ZIP_URL, "lpc-terrains.zip");
  const zip = new AdmZip(zipPath);
  const tsx = zip.readAsText(zip.getEntry(TSX_ENTRY));
  const pngBuffer = zip.readFile(zip.getEntry(PNG_ENTRY));

  const combos = new Map();
  const tileRe = /<tile id="(\d+)" terrain="([\d,]+)"\/>/g;
  let match;
  while ((match = tileRe.exec(tsx))) {
    combos.set(match[1], match[2].split(",").map(Number));
  }

  const raw = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { combos, raw };
}

// Tiled's terrain-corner convention: the four corners of the tile drawn at
// grid cell (x,y) are the terrain painted at (x-1,y-1), (x,y-1), (x-1,y) and
// (x,y) respectively — i.e. each corner belongs to the cell diagonally in
// that direction, with (x,y) itself always owning the bottom-right corner.
// That's why every adjacent pair in the atlas ships all 16 combinations of
// "which of the two terrains occupies each corner" as distinct source tiles.
function findTileId(combos, tl, tr, bl, br) {
  const wanted = [tl, tr, bl, br].join(",");
  for (const [id, terrain] of combos) {
    if (terrain.join(",") === wanted) {
      return Number(id);
    }
  }
  throw new Error(`No source tile for corners ${wanted}`);
}

function extractTile(raw, tileId) {
  const col = tileId % SRC_COLUMNS;
  const row = Math.floor(tileId / SRC_COLUMNS);
  return sharp(raw.data, { raw: { width: raw.info.width, height: raw.info.height, channels: 4 } })
    .extract({ left: col * SRC_TILE, top: row * SRC_TILE, width: SRC_TILE, height: SRC_TILE })
    .resize(OUT_TILE, OUT_TILE, { kernel: "nearest" })
    .png()
    .toBuffer();
}

// bitmask bit0=TL bit1=TR bit2=BL bit3=BR; 0 = terrain A, 1 = terrain B.
async function extractPairFrames(raw, combos, idA, idB) {
  const frames = [];
  for (let bitmask = 0; bitmask < 16; bitmask += 1) {
    const tl = bitmask & 1 ? idB : idA;
    const tr = bitmask & 2 ? idB : idA;
    const bl = bitmask & 4 ? idB : idA;
    const br = bitmask & 8 ? idB : idA;
    frames.push(await extractTile(raw, findTileId(combos, tl, tr, bl, br)));
  }
  return frames;
}

function frameComposite(buffer, frameIndex) {
  const col = frameIndex % OUT_COLUMNS;
  const row = Math.floor(frameIndex / OUT_COLUMNS);
  return { input: buffer, left: col * OUT_TILE, top: row * OUT_TILE };
}

// Row 0: solid tiles for the four blendable ground groups (frames 0-3).
// Rows 1-6: every unordered pair's 16 corner-blend frames, 16 per row —
// this order (grass/tallGrass/path/water groups, upper-triangular pairs)
// must match GROUND_GROUPS / GROUND_PAIRS in src/game/autotile.ts. Shared by
// buildOverworldSheet and buildHighlandSheet, which only differ in which
// four source terrain ids fill those group slots.
async function buildGroundSheet(raw, combos, solids, pairs, filename) {
  const composites = [];
  for (let i = 0; i < solids.length; i += 1) {
    composites.push(frameComposite(await extractTile(raw, solids[i]), i));
  }
  for (let p = 0; p < pairs.length; p += 1) {
    const frames = await extractPairFrames(raw, combos, pairs[p][0], pairs[p][1]);
    frames.forEach((buf, bitmask) => composites.push(frameComposite(buf, (1 + p) * 16 + bitmask)));
  }

  const rows = 1 + pairs.length;
  await sharp({
    create: { width: OUT_COLUMNS * OUT_TILE, height: rows * OUT_TILE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite(composites)
    .png()
    .toFile(path.join(outputDir, filename));
  console.log(`Wrote ${filename} (${OUT_COLUMNS}x${rows} frames)`);
}

async function buildOverworldSheet(raw, combos) {
  const solids = [TERRAIN_ID.Grass, TERRAIN_ID.Grass_Dark, TERRAIN_ID.Dirt_Tan, TERRAIN_ID.Water];
  const pairs = [
    [TERRAIN_ID.Grass, TERRAIN_ID.Grass_Dark],
    [TERRAIN_ID.Grass, TERRAIN_ID.Dirt_Tan],
    [TERRAIN_ID.Grass, TERRAIN_ID.Water],
    [TERRAIN_ID.Grass_Dark, TERRAIN_ID.Dirt_Tan],
    [TERRAIN_ID.Grass_Dark, TERRAIN_ID.Water],
    [TERRAIN_ID.Dirt_Tan, TERRAIN_ID.Water]
  ];
  await buildGroundSheet(raw, combos, solids, pairs, "terrain-overworld.png");
}

// The "highlands" area (src/data/maps.ts's MAPS.highlands) reskins the same
// grass/tallGrass/path/water group slots as snow/deep-snow/ice-trail/water,
// reusing overworldTileFrame's frame math as-is (see TERRAIN_HIGHLAND_KEY in
// src/game/autotile.ts) — only these four source ids differ from the
// overworld sheet, and only pairs the LPC atlas actually ships blend art for
// were picked (Snow_1/Snow_2/Ice/Water form a complete 4-choose-2 set).
async function buildHighlandSheet(raw, combos) {
  const solids = [TERRAIN_ID.Snow_1, TERRAIN_ID.Snow_2, TERRAIN_ID.Ice, TERRAIN_ID.Water];
  const pairs = [
    [TERRAIN_ID.Snow_1, TERRAIN_ID.Snow_2],
    [TERRAIN_ID.Snow_1, TERRAIN_ID.Ice],
    [TERRAIN_ID.Snow_1, TERRAIN_ID.Water],
    [TERRAIN_ID.Snow_2, TERRAIN_ID.Ice],
    [TERRAIN_ID.Snow_2, TERRAIN_ID.Water],
    [TERRAIN_ID.Ice, TERRAIN_ID.Water]
  ];
  await buildGroundSheet(raw, combos, solids, pairs, "terrain-highland.png");
}

// Each dungeon tier gets its own colorway by tinting the same wall/floor
// stone art, matching DUNGEON_TILE_THEME_BY_TIER in dungeonGenerator.ts.
const DUNGEON_TIER_TINT = {
  1: { wall: { r: 201, g: 121, b: 63 }, floor: { r: 202, g: 162, b: 90 } }, // ember
  2: { wall: { r: 94, g: 201, b: 230 }, floor: { r: 79, g: 179, b: 209 } }, // crystal
  3: { wall: { r: 185, g: 143, b: 224 }, floor: { r: 143, g: 111, b: 201 } }, // rune
  4: { wall: { r: 127, g: 217, b: 196 }, floor: { r: 95, g: 184, b: 160 } } // mist
};

async function tint(buffer, rgb) {
  return sharp(buffer).tint(rgb).png().toBuffer();
}

async function buildDungeonSheet(raw, combos) {
  // Per tier: row A = solid wall (col0) + solid floor (col1); row B = the
  // 16 wall/floor corner-blend frames. Frame index formula (must match
  // src/game/autotile.ts): base = (tier-1)*32; solidWall=base, solidFloor=
  // base+1, pair(bitmask)=base+16+bitmask.
  const tiers = [1, 2, 3, 4];
  const composites = [];
  for (const tier of tiers) {
    const base = (tier - 1) * 32;
    const tintSet = DUNGEON_TIER_TINT[tier];
    const solidWall = await tint(await extractTile(raw, TERRAIN_ID.Rock_Gray), tintSet.wall);
    const solidFloor = await tint(await extractTile(raw, TERRAIN_ID.Mudstone_Gray), tintSet.floor);
    composites.push(frameComposite(solidWall, base));
    composites.push(frameComposite(solidFloor, base + 1));

    const pairFrames = await extractPairFrames(raw, combos, TERRAIN_ID.Rock_Gray, TERRAIN_ID.Mudstone_Gray);
    for (let bitmask = 0; bitmask < 16; bitmask += 1) {
      const tinted = bitmask === 0 ? solidWall : bitmask === 15 ? solidFloor : await tintPairFrame(pairFrames[bitmask], tintSet);
      composites.push(frameComposite(tinted, base + 16 + bitmask));
    }
  }

  const rows = tiers.length * 2;
  await sharp({
    create: { width: OUT_COLUMNS * OUT_TILE, height: rows * OUT_TILE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite(composites)
    .png()
    .toFile(path.join(outputDir, "terrain-dungeon.png"));
  console.log(`Wrote terrain-dungeon.png (${OUT_COLUMNS}x${rows} frames)`);
}

// A corner-blend frame mixes wall and floor art in one image, so it can't be
// tinted with a single flat color the way pure solid tiles are. Wall/floor
// tints within a tier are close in hue by design, so tinting the whole
// frame toward their midpoint keeps both halves plausibly on-theme.
async function tintPairFrame(buffer, tintSet) {
  const mid = {
    r: Math.round((tintSet.wall.r + tintSet.floor.r) / 2),
    g: Math.round((tintSet.wall.g + tintSet.floor.g) / 2),
    b: Math.round((tintSet.wall.b + tintSet.floor.b) / 2)
  };
  return sharp(buffer).tint(mid).png().toBuffer();
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(cacheDir, { recursive: true });
  const { combos, raw } = await loadAtlas();
  await buildOverworldSheet(raw, combos);
  await buildHighlandSheet(raw, combos);
  await buildDungeonSheet(raw, combos);
}

await main();
