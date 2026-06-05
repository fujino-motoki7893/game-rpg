import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outputDir = path.resolve("public/assets/characters");
const directions = ["down", "left", "right", "up"];
const stepOffsets = [0, 1, 0, -1];

const sheets = [
  {
    key: "player",
    size: 48,
    kind: "humanoid",
    cloak: "#2f65a8",
    trim: "#efd65c",
    skin: "#efc59d",
    hair: "#493023",
    accent: "#dce9ff"
  },
  {
    key: "npc-elder",
    size: 48,
    kind: "humanoid",
    cloak: "#75593d",
    trim: "#d7d1c7",
    skin: "#eac39f",
    hair: "#d8d5ce",
    accent: "#b79562"
  },
  {
    key: "npc-healer",
    size: 48,
    kind: "humanoid",
    cloak: "#a94675",
    trim: "#f4f3ff",
    skin: "#efc59d",
    hair: "#47312b",
    accent: "#f1d5e5"
  },
  {
    key: "npc-shopkeeper",
    size: 48,
    kind: "humanoid",
    cloak: "#936a3d",
    trim: "#f0c14b",
    skin: "#efc59d",
    hair: "#51321e",
    accent: "#f6dc87"
  },
  {
    key: "npc-armorer",
    size: 48,
    kind: "humanoid",
    cloak: "#52687f",
    trim: "#c9d4dc",
    skin: "#efc59d",
    hair: "#34312b",
    accent: "#9fb5c9"
  },
  { key: "enemy-slime", size: 32, kind: "slime", base: "#6bd56c", shade: "#2f7b3e" },
  { key: "enemy-goblin", size: 32, kind: "goblin", base: "#7e9740", shade: "#3f5220" },
  { key: "enemy-bat", size: 32, kind: "bat", base: "#565184", shade: "#252640" },
  { key: "enemy-skeleton", size: 32, kind: "skeleton", base: "#d9cfad", shade: "#706957" },
  { key: "enemy-wolf", size: 32, kind: "wolf", base: "#83878f", shade: "#3f444c" },
  { key: "enemy-mage", size: 32, kind: "mage", base: "#7551b0", shade: "#33264f" },
  { key: "enemy-mimic", size: 32, kind: "mimic", base: "#9c572f", shade: "#3a2115" },
  { key: "enemy-guardian", size: 48, kind: "guardian", base: "#b05643", shade: "#4b2825" }
];

await fs.mkdir(outputDir, { recursive: true });

for (const sheet of sheets) {
  const svg = createSheetSvg(sheet);
  await sharp(Buffer.from(svg)).png().toFile(path.join(outputDir, `${sheet.key}.png`));
}

console.log(`Generated ${sheets.length} character sprite sheets in ${outputDir}`);

function createSheetSvg(sheet) {
  const width = sheet.size * 4;
  const height = sheet.size * 4;
  const frames = [];

  directions.forEach((direction, row) => {
    for (let col = 0; col < 4; col += 1) {
      const x = col * sheet.size;
      const y = row * sheet.size;
      frames.push(
        `<g transform="translate(${x},${y})">${drawFrame(sheet, direction, stepOffsets[col])}</g>`
      );
    }
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`,
    ...frames,
    "</svg>"
  ].join("");
}

function drawFrame(sheet, direction, step) {
  if (sheet.kind === "humanoid") {
    return drawHumanoid(sheet, direction, step);
  }
  if (sheet.kind === "guardian") {
    return drawGuardian(sheet, direction, step);
  }
  return drawCreature(sheet, direction, step);
}

function drawHumanoid(sheet, direction, step) {
  const draw = scaler(sheet.size);
  const side = direction === "left" || direction === "right";
  const back = direction === "up";
  const armShift = side ? (direction === "left" ? -1 : 1) : 0;
  const bodyY = 12 + Math.max(step, 0);

  return [
    draw.rect(12, 24 + step, 4, 6, "#1f2830"),
    draw.rect(19, 24 - step, 4, 6, "#1f2830"),
    draw.rect(9, bodyY, 14, 16, "#1a2026"),
    draw.rect(10, bodyY + 1, 12, 15, sheet.cloak),
    draw.rect(12, bodyY + 7, 8, 3, sheet.trim),
    draw.rect(8 + armShift, bodyY + 4, 3, 10, sheet.cloak),
    draw.rect(22 + armShift, bodyY + 4, 3, 10, sheet.cloak),
    draw.rect(9, 6, 14, 11, sheet.skin),
    back
      ? draw.rect(9, 5, 14, 13, sheet.hair)
      : [
          draw.rect(9, 5, 14, 4, sheet.hair),
          draw.rect(side && direction === "left" ? 9 : 20, 8, 3, 8, sheet.hair)
        ].join(""),
    side
      ? draw.rect(direction === "left" ? 12 : 19, 10, 2, 2, "#101010")
      : back
        ? draw.rect(11, 15, 10, 2, sheet.accent)
        : [draw.rect(13, 10, 2, 2, "#101010"), draw.rect(18, 10, 2, 2, "#101010")].join(""),
    draw.rect(11, bodyY + 2, 4, 2, "rgba(255,255,255,0.32)"),
    draw.rect(10, 27 + step, 4, 3, sheet.trim),
    draw.rect(19, 27 - step, 4, 3, sheet.trim)
  ].join("");
}

function drawCreature(sheet, direction, step) {
  const draw = scaler(sheet.size);
  switch (sheet.kind) {
    case "slime":
      return [
        draw.ellipse(16, 20 + step, 12, 9, sheet.base),
        draw.rect(10, 22 + step, 12, 2, sheet.shade),
        draw.rect(10, 15 + step, 7, 2, "rgba(255,255,255,0.38)"),
        drawEyes(draw, direction, 12, 16 + step)
      ].join("");
    case "bat":
      return [
        draw.path(
          `M 4 ${18 + step} L 13 11 L 16 ${19 + step} L 19 11 L 28 ${18 + step} L 21 23 L 16 20 L 11 23 Z`,
          sheet.shade
        ),
        draw.rect(12, 13 + step, 8, 10, sheet.base),
        drawEyes(draw, direction, 12, 16 + step)
      ].join("");
    case "skeleton":
      return [
        draw.rect(10, 19 + step, 12, 8, sheet.shade),
        draw.rect(9, 8 + step, 14, 12, sheet.base),
        draw.rect(12, 21 + step, 3, 6, sheet.base),
        draw.rect(18, 21 - step, 3, 6, sheet.base),
        drawEyes(draw, direction, 12, 13 + step),
        draw.rect(15, 17 + step, 3, 2, "#2b2824")
      ].join("");
    case "wolf":
      return [
        draw.rect(7, 13 + step, 18, 14, "#1a1616"),
        draw.rect(8, 14 + step, 16, 13, sheet.base),
        draw.rect(8, 9 + step, 5, 6, sheet.shade),
        draw.rect(20, 9 + step, 5, 6, sheet.shade),
        draw.rect(direction === "left" ? 8 : 17, 19 + step, 7, 3, sheet.shade),
        draw.rect(direction === "left" ? 9 : 20, 22 + step, 3, 2, "#e5dfd2"),
        drawEyes(draw, direction, 11, 16 + step)
      ].join("");
    case "mage":
      return [
        draw.rect(8, 12 + step, 16, 16, "#1a1616"),
        draw.rect(9, 13 + step, 14, 15, sheet.base),
        draw.rect(10, 6 + step, 12, 8, sheet.shade),
        draw.rect(14, 18 + step, 5, 5, "#86d9ff"),
        drawEyes(draw, direction, 12, 16 + step)
      ].join("");
    case "mimic":
      return [
        draw.rect(6, 12 + step, 20, 14, "#1a1616"),
        draw.rect(7, 13 + step, 18, 12, sheet.base),
        draw.rect(7, 13 + step, 18, 3, "#d5a33f"),
        draw.rect(15, 13 + step, 3, 12, "#d5a33f"),
        draw.rect(10, 18 + step, 3, 3, "#f1ead8"),
        draw.rect(19, 18 - step, 3, 3, "#f1ead8"),
        drawEyes(draw, direction, 12, 15 + step)
      ].join("");
    default:
      return [
        draw.rect(7, 10 + step, 18, 18, "#1a1616"),
        draw.rect(8, 11 + step, 16, 16, sheet.base),
        draw.rect(6, 9 + step, 7, 5, sheet.shade),
        draw.rect(19, 9 + step, 7, 5, sheet.shade),
        drawEyes(draw, direction, 12, 16 + step)
      ].join("");
  }
}

function drawGuardian(sheet, direction, step) {
  const draw = scaler(sheet.size);
  return [
    draw.rect(7, 10 + step, 18, 20, "#1a1616"),
    draw.rect(8, 11 + step, 16, 18, sheet.base),
    draw.rect(5, 10 + step, 8, 6, sheet.shade),
    draw.rect(19, 10 + step, 8, 6, sheet.shade),
    draw.rect(10, 6 + step, 12, 4, "#f0c14b"),
    draw.rect(12, 4 + step, 8, 2, "#f4d977"),
    draw.rect(11, 22 + step, 5, 5, sheet.shade),
    draw.rect(18, 22 - step, 5, 5, sheet.shade),
    drawEyes(draw, direction, 12, 16 + step)
  ].join("");
}

function drawEyes(draw, direction, x, y) {
  if (direction === "up") {
    return "";
  }
  if (direction === "left") {
    return draw.rect(x, y, 3, 3, "#111111");
  }
  if (direction === "right") {
    return draw.rect(x + 7, y, 3, 3, "#111111");
  }
  return [draw.rect(x, y, 3, 3, "#111111"), draw.rect(x + 7, y, 3, 3, "#111111")].join("");
}

function scaler(size) {
  const factor = size / 32;
  const scale = (value) => Math.round(value * factor);
  return {
    rect: (x, y, width, height, fill) =>
      `<rect x="${scale(x)}" y="${scale(y)}" width="${scale(width)}" height="${scale(height)}" fill="${fill}"/>`,
    ellipse: (cx, cy, rx, ry, fill) =>
      `<ellipse cx="${scale(cx)}" cy="${scale(cy)}" rx="${scale(rx)}" ry="${scale(ry)}" fill="${fill}"/>`,
    path: (d, fill) => `<path d="${scalePath(d, factor)}" fill="${fill}"/>`
  };
}

function scalePath(pathData, factor) {
  return pathData.replace(/-?\d+(?:\.\d+)?/g, (value) => String(Math.round(Number(value) * factor)));
}
