import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import AdmZip from "adm-zip";

// Source art credits (see public/assets/characters/CREDITS.md):
// - Golem: Stephen "Redshrike" Challener, William.Thompsonj
//   https://opengameart.org/content/lpc-golem (CC-BY / GPL / OGA-BY)
// - Bat: bagzie, reworked by AntumDeluge
//   https://opengameart.org/content/bat-rework (CC-BY 3.0 / OGA-BY 3.0)
// - Slime: Charles Sanchez (CharlesGabriel), bagzie, bluecarrot16
//   https://opengameart.org/content/lpc-monsters (CC-BY-SA 3.0 / GPL 3.0)
const cacheDir = path.resolve("scripts/.oga-cache");
const outputDir = path.resolve("public/assets/characters");

const GAME_DIRECTIONS = ["down", "left", "right", "up"];

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

async function extractFromZip(zipUrl, zipFilename, entryName, outFilename) {
  const outPath = path.join(cacheDir, outFilename);
  try {
    await fs.access(outPath);
    return outPath;
  } catch {
    // not extracted yet
  }
  const zipPath = await fetchToCache(zipUrl, zipFilename);
  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry(entryName);
  if (!entry) {
    throw new Error(`Zip entry not found: ${entryName} in ${zipFilename}`);
  }
  await fs.writeFile(outPath, zip.readFile(entry));
  return outPath;
}

// rowColMap: { down: {row, cols:[c0,c1,c2,c3]}, left: {...}, right: {...}, up: {...} }
async function buildMonster(key, sourcePath, frameWidth, frameHeight, outputSize, rowColMap) {
  const sheet = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const frameComposites = [];

  for (let row = 0; row < GAME_DIRECTIONS.length; row += 1) {
    const direction = GAME_DIRECTIONS[row];
    const { row: sourceRow, cols } = rowColMap[direction];
    for (let col = 0; col < cols.length; col += 1) {
      const sourceCol = cols[col];
      const frameBuffer = await sharp(sheet.data, {
        raw: { width: sheet.info.width, height: sheet.info.height, channels: 4 }
      })
        .extract({
          left: sourceCol * frameWidth,
          top: sourceRow * frameHeight,
          width: frameWidth,
          height: frameHeight
        })
        .resize(outputSize, outputSize, { kernel: "nearest" })
        .png()
        .toBuffer();
      frameComposites.push({ input: frameBuffer, left: col * outputSize, top: row * outputSize });
    }
  }

  await sharp({
    create: {
      width: outputSize * 4,
      height: outputSize * 4,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(frameComposites)
    .png()
    .toFile(path.join(outputDir, `${key}.png`));
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(cacheDir, { recursive: true });

// --- Golem -> enemy-guardian (448x256 = 7 cols x 4 rows @ 64px) ---
const golemPath = await fetchToCache(
  "https://opengameart.org/sites/default/files/golem-walk.png",
  "golem-walk.png"
);
await buildMonster("enemy-guardian", golemPath, 64, 64, 48, {
  down: { row: 0, cols: [0, 2, 4, 6] },
  right: { row: 1, cols: [0, 2, 4, 6] },
  up: { row: 2, cols: [0, 2, 4, 6] },
  left: { row: 3, cols: [0, 2, 4, 6] }
});
console.log("Generated enemy-guardian.png from OpenGameArt LPC Golem");

// --- Bat -> enemy-bat (144x256 = 3 cols x 4 rows @ 48x64px, N/E/S/W) ---
const batPath = await extractFromZip(
  "https://opengameart.org/sites/default/files/bat-1.3.zip",
  "bat-1.3.zip",
  "PNG/48x64/bat-NESW.png",
  "bat-NESW.png"
);
await buildMonster("enemy-bat", batPath, 48, 64, 32, {
  up: { row: 0, cols: [0, 1, 2, 1] },
  right: { row: 1, cols: [0, 1, 2, 1] },
  down: { row: 2, cols: [0, 1, 2, 1] },
  left: { row: 3, cols: [0, 1, 2, 1] }
});
console.log("Generated enemy-bat.png from OpenGameArt Bat (Rework)");

// --- Slime -> enemy-slime (512x256 = 8 cols x 4 rows @ 64px) ---
// Slime is round/symmetric, so the same frames are reused for all 4 directions.
const slimePath = await extractFromZip(
  "https://opengameart.org/sites/default/files/lpc-monsters.zip",
  "lpc-monsters.zip",
  "lpc-monsters/slime.png",
  "slime.png"
);
const slimeFrames = { row: 0, cols: [0, 2, 4, 6] };
await buildMonster("enemy-slime", slimePath, 64, 64, 32, {
  down: slimeFrames,
  left: slimeFrames,
  right: slimeFrames,
  up: slimeFrames
});
console.log("Generated enemy-slime.png from OpenGameArt LPC Monsters");

console.log(`Done. Wrote 3 monster sprite sheets to ${outputDir}`);
