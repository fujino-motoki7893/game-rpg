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
const OUTPUT_SIZE = 48; // matches CHARACTER_SPRITES frameWidth/frameHeight for humanoids
const FRAME_COLUMNS = 9; // walk.png has 9 frames per direction in the source sheet
// Sample 4 evenly spaced frames from the 9-frame walk cycle to build the
// idle/walk1/walk2/walk3 columns this game's BootScene animations expect.
const SAMPLE_FRAMES = [0, 2, 4, 6];

// Row order in every LPC "walk.png" sheet is fixed: up, left, down, right.
const LPC_ROW = { up: 0, left: 1, down: 2, right: 3 };
// Row order this game's sprite sheets use (see characterSprites.ts).
const GAME_DIRECTIONS = ["down", "left", "right", "up"];

const HAIR_PALETTE_SOURCE = [
  "#260D14", "#6A1108", "#A02600D9", "#A026009C", "#A42600", "#BF4000", "#E55600", "#FF8A00"
];
const HAIR_PALETTES = {
  chestnut: ["#200C0D", "#3A130E", "#63200BD9", "#63200B9C", "#63200B", "#81310A", "#B6550E", "#D28102"],
  dark_brown: ["#050100", "#160701", "#290E02D9", "#290E029C", "#290E02", "#421603", "#5F1F04", "#792806"],
  light_brown: ["#1A0E04", "#301B07", "#60350FD9", "#60350F9C", "#60350F", "#7D4513", "#AE682A", "#C88D58"],
  white: ["#1D1D21", "#484E57", "#8B9498D9", "#8B94989C", "#8B9498", "#B8BBBC", "#D8DCDC", "#FFFFFF"],
  black: ["#000000", "#080A0A", "#101414D9", "#1014149C", "#101414", "#1C2222", "#31313E", "#4A5057"],
  platinum: ["#1C0E06", "#7D5D5D", "#A87D52D9", "#A87D529C", "#A87D52", "#C0AB81", "#EDDF95", "#F6F6F3"]
};

// Layers are composited bottom-to-top in this order (matches the source
// project's zPos ordering: body < feet < legs < torso < hair).
const CHARACTERS = {
  player: {
    body: "body/bodies/male/walk.png",
    head: "head/heads/human/male/walk.png",
    feet: "feet/shoes/basic/male/walk.png",
    legs: "legs/pants/male/walk.png",
    torso: "torso/clothes/vest/male/walk/blue.png",
    hair: "chestnut"
  },
  "npc-elder": {
    body: "body/bodies/female/walk.png",
    head: "head/heads/human/female_elderly/walk.png",
    torso: "torso/clothes/robe/female/walk/brown.png",
    hair: "white"
  },
  "npc-healer": {
    body: "body/bodies/female/walk.png",
    head: "head/heads/human/female/walk.png",
    torso: "torso/clothes/robe/female/walk/white.png",
    hair: "dark_brown"
  },
  "npc-shopkeeper": {
    body: "body/bodies/male/walk.png",
    head: "head/heads/human/male/walk.png",
    feet: "feet/shoes/basic/male/walk.png",
    legs: "legs/pants/male/walk.png",
    torso: "torso/clothes/vest/male/walk/tan.png",
    hair: "light_brown"
  },
  "npc-armorer": {
    body: "body/bodies/male/walk.png",
    head: "head/heads/human/male/walk.png",
    feet: "feet/shoes/basic/male/walk.png",
    legs: "legs/pants/male/walk.png",
    torso: "torso/armour/plate/male/walk.png",
    hair: "black"
  },
  "companion-luna": {
    body: "body/bodies/female/walk.png",
    head: "head/heads/human/female/walk.png",
    torso: "dress/sash/female/walk/lavender.png",
    hair: "platinum"
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

async function recolorHair(inputPath, targetVariant, tolerance = 6) {
  const source = HAIR_PALETTE_SOURCE.map(parseHex);
  const target = HAIR_PALETTES[targetVariant].map(parseHex);
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

async function buildCharacterSheet(key, config) {
  const layerPaths = [];

  for (const slot of ["body", "feet", "legs", "torso"]) {
    if (config[slot]) {
      layerPaths.push(await fetchToCache(config[slot]));
    }
  }
  const headPath = await fetchToCache(config.head);

  const hairSourcePath = await fetchToCache("hair/plain/adult/walk.png");
  const hairBuffer = await recolorHair(hairSourcePath, config.hair);

  const composites = [
    { input: headPath, left: 0, top: 0 },
    ...layerPaths.slice(1).map((p) => ({ input: p, left: 0, top: 0 })),
    { input: hairBuffer, left: 0, top: 0 }
  ];

  const fullSheet = await sharp(layerPaths[0])
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

for (const [key, config] of Object.entries(CHARACTERS)) {
  await buildCharacterSheet(key, config);
  console.log(`Generated ${key}.png from LPC assets`);
}

console.log(`Done. Wrote ${Object.keys(CHARACTERS).length} humanoid sprite sheets to ${outputDir}`);
