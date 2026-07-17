import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Source art: Universal LPC Spritesheet Character Generator
// https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator
// Licensed CC-BY-SA 3.0 (one of several license options offered per-asset; see
// public/assets/characters/CREDITS.md for full author list and license terms).
const LPC_RAW_BASE =
  "https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master/spritesheets";

const cacheDir = path.resolve("scripts/.lpc-cache");
const outputDir = path.resolve("public/assets/characters");

const FRAME_SIZE = 64; // source LPC frame size
const OUTPUT_SIZE = 32; // matches CHARACTER_SPRITES frameWidth/frameHeight for these enemies
const SAMPLE_FRAMES = [0, 2, 4, 6]; // 4 evenly spaced frames out of the 9-frame walk cycle

// Row order in every LPC "walk.png" sheet is fixed: up, left, down, right.
const LPC_ROW = { up: 0, left: 1, down: 2, right: 3 };
const GAME_DIRECTIONS = ["down", "left", "right", "up"];

const BODY_PALETTE_SOURCE = [
  "#271920", "#271920", "#99423c", "#cc8665", "#E4A47C", "#F9D5BA", "#FAECE7", "#f8f3eb"
];
const BODY_PALETTES = {
  bright_green: ["#02280E", "#02280E", "#06410E", "#255E1D", "#5B8F11", "#75AE23", "#99D248", "#d4d887"]
};

const HAIR_PALETTE_SOURCE = [
  "#260D14", "#6A1108", "#A02600D9", "#A026009C", "#A42600", "#BF4000", "#E55600", "#FF8A00"
];
const HAIR_PALETTES = {
  dark_brown: ["#050100", "#160701", "#290E02D9", "#290E029C", "#290E02", "#421603", "#5F1F04", "#792806"]
};

const MONSTERS = {
  "enemy-skeleton": {
    layers: ["body/bodies/skeleton/walk/skeleton.png", "head/heads/skeleton/adult/walk/skeleton.png"]
  },
  "enemy-goblin": {
    layers: [
      { path: "body/bodies/muscular/walk.png", recolor: { palette: "body", variant: "bright_green" } },
      "legs/pants/male/walk.png",
      "head/heads/goblin/adult/walk.png"
    ]
  },
  "enemy-mage": {
    layers: [
      "body/bodies/female/walk.png",
      "head/heads/human/female/walk.png",
      "torso/clothes/robe/female/walk/purple.png",
      { path: "hair/plain/adult/walk.png", recolor: { palette: "hair", variant: "dark_brown" } },
      "hat/magic/wizard/base/adult/walk.png"
    ]
  }
};

async function fetchToCache(relativePath) {
  const cachePath = path.join(cacheDir, relativePath.replace(/\//g, "_"));
  try {
    await fs.access(cachePath);
    return cachePath;
  } catch {
    // not cached yet
  }
  const url = `${LPC_RAW_BASE}/${relativePath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, buffer);
  return cachePath;
}

function parseHex(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255;
  return [r, g, b, a];
}

const PALETTE_SOURCES = { body: BODY_PALETTE_SOURCE, hair: HAIR_PALETTE_SOURCE };
const PALETTE_TARGETS = { body: BODY_PALETTES, hair: HAIR_PALETTES };

async function recolorLayer(inputPath, paletteName, variant, tolerance = 6) {
  const source = PALETTE_SOURCES[paletteName].map(parseHex);
  const target = PALETTE_TARGETS[paletteName][variant].map(parseHex);
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) {
      continue;
    }
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    for (let k = 0; k < source.length; k += 1) {
      const [sr, sg, sb, sa] = source[k];
      if (
        Math.abs(r - sr) <= tolerance &&
        Math.abs(g - sg) <= tolerance &&
        Math.abs(b - sb) <= tolerance &&
        Math.abs(a - sa) <= tolerance
      ) {
        const [tr, tg, tb] = target[k];
        data[i] = tr;
        data[i + 1] = tg;
        data[i + 2] = tb;
        break;
      }
    }
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function resolveLayer(layer) {
  if (typeof layer === "string") {
    return fetchToCache(layer);
  }
  const cachedPath = await fetchToCache(layer.path);
  if (!layer.recolor) {
    return cachedPath;
  }
  return recolorLayer(cachedPath, layer.recolor.palette, layer.recolor.variant);
}

async function buildMonsterSheet(key, config) {
  const composites = [];
  let baseInput = null;

  for (const layer of config.layers) {
    const resolved = await resolveLayer(layer);
    if (baseInput === null) {
      baseInput = resolved;
    } else {
      composites.push({ input: resolved, left: 0, top: 0 });
    }
  }

  const fullSheet = await sharp(baseInput)
    .composite(composites)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const outputCanvas = sharp({
    create: {
      width: OUTPUT_SIZE * 4,
      height: OUTPUT_SIZE * 4,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  });

  const frameComposites = [];
  for (let row = 0; row < GAME_DIRECTIONS.length; row += 1) {
    const direction = GAME_DIRECTIONS[row];
    const lpcRow = LPC_ROW[direction];
    for (let col = 0; col < SAMPLE_FRAMES.length; col += 1) {
      const sourceCol = SAMPLE_FRAMES[col];
      const frameBuffer = await sharp(fullSheet.data, {
        raw: { width: fullSheet.info.width, height: fullSheet.info.height, channels: 4 }
      })
        .extract({
          left: sourceCol * FRAME_SIZE,
          top: lpcRow * FRAME_SIZE,
          width: FRAME_SIZE,
          height: FRAME_SIZE
        })
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, { kernel: "nearest" })
        .png()
        .toBuffer();
      frameComposites.push({ input: frameBuffer, left: col * OUTPUT_SIZE, top: row * OUTPUT_SIZE });
    }
  }

  await outputCanvas
    .composite(frameComposites)
    .png()
    .toFile(path.join(outputDir, `${key}.png`));
}

await fs.mkdir(outputDir, { recursive: true });

for (const [key, config] of Object.entries(MONSTERS)) {
  await buildMonsterSheet(key, config);
  console.log(`Generated ${key}.png from LPC assets`);
}

console.log(`Done. Wrote ${Object.keys(MONSTERS).length} monster sprite sheets to ${outputDir}`);
