import {
  generateDungeon,
  getDungeonEnemyKeysForTier,
  getDungeonGuardianKeyForTier,
  getDungeonNameForTier,
  getFieldDungeonEntranceForTier,
  getRelicChestIdForTier,
  hasFinalRelicForTier
} from "../data/dungeonGenerator";
import { isDungeonEnemyKey, type DungeonEnemyKey } from "../data/enemies";
import {
  describeLunaStage,
  getLunaLineForStage,
  isLunaQuestStage,
  LUNA_CASUAL_LINES
} from "../data/lunaLines";
import type { LunaQuestStage } from "../data/lunaLines";
import type { ChestReward, EnemySpawn, MapDefinition, PortalDefinition, TilePosition } from "../game/types";

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
}

interface GroqChatCompletion {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const WIDTH = 40;
const HEIGHT = 30;
const DEFAULT_MODEL = "llama-3.1-8b-instant";
const LUNA_MODEL = "llama-3.3-70b-versatile";
const REGULAR_ENEMY_COUNT = 5;

interface DungeonRequest {
  floor: number;
  floorCount: number;
  upTarget?: TilePosition;
  tier: number;
}

interface NormalizedEnemySpawn extends TilePosition {
  enemyKey: DungeonEnemyKey;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === "/api/health") {
      return jsonResponse({
        ok: true,
        groqConfigured: Boolean(env.GROQ_API_KEY),
        model: env.GROQ_MODEL ?? DEFAULT_MODEL
      });
    }

    if (url.pathname === "/api/dungeon") {
      if (request.method !== "POST" && request.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }
      return createDungeonResponse(request, env);
    }

    if (url.pathname === "/api/luna-line") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }
      return createLunaLineResponse(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return jsonResponse({ error: "Not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};

async function createDungeonResponse(request: Request, env: Env): Promise<Response> {
  const context = await readDungeonRequest(request);
  if (!env.GROQ_API_KEY) {
    return jsonResponse({ map: generateDungeon(context), source: "worker-local" });
  }

  try {
    const map = await generateGroqDungeon(env, context);
    return jsonResponse({ map, source: "groq" });
  } catch (error) {
    console.warn(
      "Groq dungeon generation failed",
      error instanceof Error ? error.message : "unknown error"
    );
    return jsonResponse({
      map: generateDungeon(context),
      source: "worker-local",
      warning: "groq-unavailable"
    });
  }
}

async function readDungeonRequest(request: Request): Promise<DungeonRequest> {
  if (request.method === "GET") {
    return { floor: 1, floorCount: 1, tier: 1 };
  }

  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    raw = {};
  }

  const body =
    raw && typeof raw === "object"
      ? (raw as { floor?: unknown; floorCount?: unknown; upTarget?: unknown; tier?: unknown })
      : {};
  const floorCount = readBoundedInteger(body.floorCount, 1, 8, 1);
  const floor = readBoundedInteger(body.floor, 1, floorCount, 1);
  const tier = readBoundedInteger(body.tier, 1, 3, 1);
  const upTarget = readPlayablePosition(body.upTarget);

  return upTarget ? { floor, floorCount, upTarget, tier } : { floor, floorCount, tier };
}

function readBoundedInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return clamp(Math.floor(parsed), min, max);
}

function readPlayablePosition(value: unknown): TilePosition | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const position = value as { x?: unknown; y?: unknown };
  if (!Number.isInteger(position.x) || !Number.isInteger(position.y)) {
    return undefined;
  }

  const tilePosition = { x: position.x, y: position.y } as TilePosition;
  return isPlayable(tilePosition) ? tilePosition : undefined;
}

async function generateGroqDungeon(env: Env, context: DungeonRequest): Promise<MapDefinition> {
  const isFinalFloor = context.floor >= context.floorCount;
  const hasFinalRelic = hasFinalRelicForTier(context.tier);
  const dungeonName = getDungeonNameForTier(context.tier);
  const guardianKey = getDungeonGuardianKeyForTier(context.tier);
  const regularEnemyKeys = getDungeonEnemyKeysForTier(context.tier);
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL ?? DEFAULT_MODEL,
      temperature: 0.8,
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You generate compact tile maps for a browser RPG. Return JSON only. No markdown."
        },
        {
          role: "user",
          content: [
            `Create floor B${context.floor}F of a ${context.floorCount}-floor ${dungeonName}.`,
            context.tier >= 3
              ? "This is the third quest dungeon: a fearsome new monster has awakened here — make it feel the most dangerous and oppressive of all three caves."
              : context.tier >= 2
                ? "This is the second quest dungeon: make it feel deeper and more dangerous than the first cave."
                : "This is the first quest cave dungeon.",
            "Return a JSON object with rows, chests, enemies, and optionally stairsDown.",
            "rows must be exactly 30 strings, each exactly 40 characters.",
            "Allowed row characters: # wall, . floor, ~ water, U up stairs, V down stairs, B relic chest, D guardian floor.",
            "The outer border must be #. Put U at x=1,y=1.",
            "This is a large map (40x30) — carve several distinct rooms connected by corridors, not just one small cluster; spread rooms and enemies across the full width and height.",
            hasFinalRelic
              ? "The server will add one supply chest automatically. Only place B when this floor needs the final relic chest."
              : "The server will add one supply chest automatically. This dungeon has no relic to find, so never place B — the goal is only to defeat the guardian.",
            isFinalFloor
              ? hasFinalRelic
                ? "This is the final floor. Put one B chest and one D guardian near the deeper side of the dungeon. Do not place V."
                : "This is the final floor. Put one D guardian near the deeper side of the dungeon. Do not place B or V."
              : "This is not the final floor. Put one V down stairs near the deeper side of the dungeon. Do not place B or D.",
            isFinalFloor
              ? `Add exactly ${REGULAR_ENEMY_COUNT} regular enemies and one guardian enemy in enemies.`
              : `Add exactly ${REGULAR_ENEMY_COUNT} regular enemies in enemies.`,
            `Regular enemyKey values must come from: ${regularEnemyKeys.join(", ")}.`,
            isFinalFloor
              ? `The guardian enemyKey must be ${guardianKey}.`
              : "Do not add a guardian enemy on this floor.",
            hasFinalRelic
              ? "Every enemy, stairs, and at least one tile next to the final chest must be reachable from U without crossing #, ~, or B."
              : "Every enemy and stairs must be reachable from U without crossing #, ~, or B.",
            "Also include a numeric seed field for deterministic fallback.",
            isFinalFloor
              ? hasFinalRelic
                ? `Example shape (illustrative only, yours should fill the full 40x30 grid): {"rows":["########################################",...],"chests":[{"x":28,"y":22}],"enemies":[{"enemyKey":"${regularEnemyKeys[0]}","x":14,"y":4},{"enemyKey":"${regularEnemyKeys[1]}","x":26,"y":9},{"enemyKey":"${regularEnemyKeys[2]}","x":6,"y":14},{"enemyKey":"${regularEnemyKeys[0]}","x":18,"y":15},{"enemyKey":"${regularEnemyKeys[1]}","x":30,"y":15},{"enemyKey":"${guardianKey}","x":28,"y":23}]}`
                : `Example shape (illustrative only, yours should fill the full 40x30 grid): {"rows":["########################################",...],"chests":[],"enemies":[{"enemyKey":"${regularEnemyKeys[0]}","x":14,"y":4},{"enemyKey":"${regularEnemyKeys[1]}","x":26,"y":9},{"enemyKey":"${regularEnemyKeys[2]}","x":6,"y":14},{"enemyKey":"${regularEnemyKeys[0]}","x":18,"y":15},{"enemyKey":"${regularEnemyKeys[1]}","x":30,"y":15},{"enemyKey":"${guardianKey}","x":28,"y":23}]}`
              : `Example shape (illustrative only, yours should fill the full 40x30 grid): {"rows":["########################################",...],"stairsDown":{"x":28,"y":22},"chests":[],"enemies":[{"enemyKey":"${regularEnemyKeys[0]}","x":14,"y":4},{"enemyKey":"${regularEnemyKeys[1]}","x":26,"y":9},{"enemyKey":"${regularEnemyKeys[2]}","x":6,"y":14},{"enemyKey":"${regularEnemyKeys[0]}","x":18,"y":15},{"enemyKey":"${regularEnemyKeys[1]}","x":30,"y":15}]}`
          ].join(" ")
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Groq returned ${response.status}`);
  }

  const payload = (await response.json()) as GroqChatCompletion;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq returned no content");
  }

  const parsed = JSON.parse(extractJson(content)) as unknown;
  const map = normalizeDungeon(parsed, context);
  return map ?? generateDungeon({ ...context, seed: readSeed(parsed) ?? hashString(content) });
}

async function createLunaLineResponse(request: Request, env: Env): Promise<Response> {
  const stage = await readLunaLineRequest(request);
  const fallbackLine = getLunaLineForStage(stage);

  if (!env.GROQ_API_KEY) {
    return jsonResponse({ line: fallbackLine, source: "worker-local" });
  }

  try {
    const line = await generateGroqLunaLine(env, stage);
    return jsonResponse({ line, source: "groq" });
  } catch (error) {
    console.warn(
      "Groq Luna line generation failed",
      error instanceof Error ? error.message : "unknown error"
    );
    return jsonResponse({ line: fallbackLine, source: "worker-local", warning: "groq-unavailable" });
  }
}

async function readLunaLineRequest(request: Request): Promise<LunaQuestStage> {
  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    raw = {};
  }

  const body = raw && typeof raw === "object" ? (raw as { stage?: unknown }) : {};
  return isLunaQuestStage(body.stage) ? body.stage : "casual";
}

async function generateGroqLunaLine(env: Env, stage: LunaQuestStage): Promise<string> {
  const situation = describeLunaStage(stage);
  const voiceExamples = LUNA_CASUAL_LINES.slice(0, 4).map((line) => line.text);
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: LUNA_MODEL,
      temperature: 0.65,
      max_completion_tokens: 120,
      messages: [
        {
          role: "system",
          content: [
            "あなたは日本語の小さなブラウザRPGに登場する仲間キャラクター「ルナ」のセリフを1行だけ書きます。",
            "ルナは物腰が柔らかく上品な、支援型の魔法使いです。旅の道中、ずっと勇者(プレイヤー)に寄り添っています。",
            "一人称は「私」。口調は丁寧な「です・ます調」で、少し古風で落ち着いた話し方です。若者言葉、くだけた表現、絵文字は使いません。",
            "HPやMP、レベルなど、ゲームのシステム用語には言及しないでください。",
            "「頑張りましょう」「油断は禁物です」のような紋切り型の掛け声も避け、具体的で自然な一言にしてください。",
            "以下はルナの話し方の実例です。この雰囲気・文の長さに合わせてください(内容をそのまま繰り返す必要はありません):",
            ...voiceExamples.map((line) => `- ${line}`),
            "出力は「ルナ: 」から始まる1文のみ。40字以内。説明や地の文、鉤括弧は付けないでください。"
          ].join("\n")
        },
        {
          role: "user",
          content: `今の状況: ${situation}\nこの状況でルナが勇者にかけそうな一言を、上の話し方に忠実に1つ書いてください。`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Groq returned ${response.status}`);
  }

  const payload = (await response.json()) as GroqChatCompletion;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq returned no content");
  }

  const line = sanitizeLunaLine(content);
  if (!line) {
    throw new Error("Groq returned an unusable line");
  }
  return line;
}

function sanitizeLunaLine(content: string): string | undefined {
  const trimmed = content.trim().replace(/^["「]+|["」]+$/g, "");
  const firstLine = trimmed.split("\n")[0].trim();
  if (!firstLine || firstLine.length > 80) {
    return undefined;
  }
  return firstLine.startsWith("ルナ") ? firstLine : `ルナ: ${firstLine}`;
}

function normalizeDungeon(value: unknown, context: DungeonRequest): MapDefinition | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const isFinalFloor = context.floor >= context.floorCount;
  const hasFinalRelic = hasFinalRelicForTier(context.tier);
  const raw = value as { rows?: unknown; chests?: unknown; enemies?: unknown; stairsDown?: unknown };
  if (!Array.isArray(raw.rows) || raw.rows.length !== HEIGHT) {
    return undefined;
  }

  const grid = raw.rows.map((row) => {
    if (typeof row !== "string") {
      return undefined;
    }
    return [...row.padEnd(WIDTH, "#").slice(0, WIDTH)].map((tile) => sanitizeTile(tile));
  });

  if (grid.some((row) => !row)) {
    return undefined;
  }

  const rows = grid as string[][];
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (y === 0 || y === HEIGHT - 1 || x === 0 || x === WIDTH - 1) {
        rows[y][x] = "#";
      }
      if (rows[y][x] === "U" || rows[y][x] === "V" || rows[y][x] === "B" || rows[y][x] === "D") {
        rows[y][x] = ".";
      }
    }
  }

  const spawn = { x: 1, y: 1 };
  const fieldEntrance = getFieldDungeonEntranceForTier(context.tier);
  rows[spawn.y][spawn.x] = ".";
  const reserved = new Set<string>([positionKey(spawn)]);
  const portals: PortalDefinition[] = [
    context.floor === 1
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
          toFloor: context.floor - 1,
          toX: context.upTarget?.x ?? 1,
          toY: context.upTarget?.y ?? 1,
          kind: "stairs-up",
          dungeonTier: context.tier
        }
  ];
  let chest: TilePosition | undefined;
  let guardian: TilePosition | undefined;
  let downStairs: TilePosition | undefined;

  if (isFinalFloor) {
    if (hasFinalRelic) {
      chest = pickPosition(raw.chests, rows, reserved) ?? findOpenFloorNear(rows, { x: 28, y: 22 }, reserved);
      if (!chest) {
        return undefined;
      }
      reserved.add(positionKey(chest));
    }

    guardian =
      pickEnemy(raw.enemies, getDungeonGuardianKeyForTier(context.tier), rows, reserved) ??
      findOpenFloorNear(rows, chest ? { x: chest.x, y: chest.y + 1 } : { x: 28, y: 22 }, reserved);
    if (!guardian) {
      return undefined;
    }
    reserved.add(positionKey(guardian));
  } else {
    downStairs =
      readPosition(raw.stairsDown, rows, reserved) ??
      findMarker(raw.rows, "V", rows, reserved) ??
      findOpenFloorNear(rows, { x: 28, y: 22 }, reserved);
    if (!downStairs) {
      return undefined;
    }
    reserved.add(positionKey(downStairs));
    portals.push({
      x: downStairs.x,
      y: downStairs.y,
      toMap: "dungeon",
      toFloor: context.floor + 1,
      toX: 1,
      toY: 1,
      kind: "stairs-down",
      dungeonTier: context.tier
    });
  }

  const regularEnemies = pickRegularEnemies(raw.enemies, rows, reserved, context.tier);
  while (regularEnemies.length < REGULAR_ENEMY_COUNT) {
    const fallback = findOpenFloorNear(
      rows,
      { x: 8 + regularEnemies.length * 6, y: 4 + regularEnemies.length * 5 },
      reserved
    );
    if (!fallback) {
      return undefined;
    }
    reserved.add(positionKey(fallback));
    const fallbackEnemyKeys = getDungeonEnemyKeysForTier(context.tier);
    regularEnemies.push({
      ...fallback,
      enemyKey: fallbackEnemyKeys[regularEnemies.length % fallbackEnemyKeys.length]
    });
  }

  const supplyChest = findOpenFloorNear(
    rows,
    { x: 8 + (context.floor % 3) * 10, y: 8 + (context.floor % 2) * 10 },
    reserved
  );
  if (!supplyChest) {
    return undefined;
  }
  reserved.add(positionKey(supplyChest));

  rows[spawn.y][spawn.x] = "U";
  rows[supplyChest.y][supplyChest.x] = "B";
  if (chest) {
    rows[chest.y][chest.x] = "B";
  }
  if (guardian) {
    rows[guardian.y][guardian.x] = "D";
  }
  if (downStairs) {
    rows[downStairs.y][downStairs.x] = "V";
  }

  let chestAccessTiles: TilePosition[] = [];
  let supplyChestAccessTiles = ensureChestAccess(rows, supplyChest);
  if (supplyChestAccessTiles.length === 0) {
    return undefined;
  }

  if (chest && guardian) {
    chestAccessTiles = ensureChestAccess(rows, chest, guardian);
    if (chestAccessTiles.length === 0) {
      return undefined;
    }
  }

  const requiredTiles = [
    ...(guardian ? [guardian] : []),
    ...(downStairs ? [downStairs] : []),
    ...regularEnemies,
    ...supplyChestAccessTiles,
    ...chestAccessTiles
  ];
  if (!canReachAll(rows, spawn, requiredTiles)) {
    requiredTiles.forEach((target) => carveCorridor(rows, spawn, target));
    rows[spawn.y][spawn.x] = "U";
    rows[supplyChest.y][supplyChest.x] = "B";
    if (chest) {
      rows[chest.y][chest.x] = "B";
    }
    if (guardian) {
      rows[guardian.y][guardian.x] = "D";
    }
    if (downStairs) {
      rows[downStairs.y][downStairs.x] = "V";
    }
    if (chest && guardian) {
      chestAccessTiles = ensureChestAccess(rows, chest, guardian);
    }
    supplyChestAccessTiles = ensureChestAccess(rows, supplyChest);
  }

  if (!canReachAll(rows, spawn, requiredTiles)) {
    return undefined;
  }

  return {
    id: "dungeon",
    name: `${getDungeonNameForTier(context.tier)} B${context.floor}F`,
    floor: context.floor,
    floorCount: context.floorCount,
    spawn,
    rows: rows.map((row) => row.join("")),
    portals,
    npcs: [],
    chests: [
      {
        id: `dungeon-t${context.tier}-b${context.floor}-supply-chest`,
        x: supplyChest.x,
        y: supplyChest.y,
        reward: pickSupplyChestReward(context.floor, context.floorCount)
      },
      ...(chest
        ? [
            {
              id: getRelicChestIdForTier(context.tier),
              x: chest.x,
              y: chest.y,
              reward: { type: "relic" } as const
            }
          ]
        : [])
    ],
    enemies: [
      ...regularEnemies.map((enemy, index) => ({
        id: `dungeon-b${context.floor}-${enemy.enemyKey}-${index + 1}`,
        enemyKey: enemy.enemyKey,
        x: enemy.x,
        y: enemy.y
      })),
      ...(guardian
        ? [
            {
              id: "dungeon-guardian",
              enemyKey: getDungeonGuardianKeyForTier(context.tier),
              x: guardian.x,
              y: guardian.y
            }
          ]
        : [])
    ]
  };
}

function pickPosition(
  value: unknown,
  grid: string[][],
  reserved: Set<string>
): TilePosition | undefined {
  const positions = readPositions(value);
  return positions.find((position) => isOpenFloor(grid, position, reserved));
}

function readPosition(
  value: unknown,
  grid: string[][],
  reserved: Set<string>
): TilePosition | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const position = value as { x?: unknown; y?: unknown };
  return isOpenFloor(grid, position, reserved) ? position : undefined;
}

function findMarker(
  rows: unknown,
  marker: string,
  grid: string[][],
  reserved: Set<string>
): TilePosition | undefined {
  if (!Array.isArray(rows)) {
    return undefined;
  }

  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    if (typeof row !== "string") {
      continue;
    }
    const x = row.indexOf(marker);
    if (x >= 0) {
      const position = { x: clamp(x, 1, WIDTH - 2), y: clamp(y, 1, HEIGHT - 2) };
      if (isOpenFloor(grid, position, reserved)) {
        return position;
      }
    }
  }
  return undefined;
}

function pickEnemy(
  value: unknown,
  enemyKey: EnemySpawn["enemyKey"],
  grid: string[][],
  reserved: Set<string>
): TilePosition | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((enemy) => enemy && typeof enemy === "object")
    .map((enemy) => enemy as { enemyKey?: unknown; x?: unknown; y?: unknown })
    .filter((enemy) => enemy.enemyKey === enemyKey)
    .map((enemy) => ({ x: enemy.x, y: enemy.y }))
    .find((position): position is TilePosition => isOpenFloor(grid, position, reserved));
}

function pickRegularEnemies(
  value: unknown,
  grid: string[][],
  reserved: Set<string>,
  tier: number
): NormalizedEnemySpawn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowedEnemyKeys = getDungeonEnemyKeysForTier(tier);
  const enemies: NormalizedEnemySpawn[] = [];
  value
    .filter((enemy) => enemy && typeof enemy === "object")
    .map((enemy) => enemy as { enemyKey?: unknown; x?: unknown; y?: unknown })
    .forEach((enemy) => {
      const position = { x: enemy.x, y: enemy.y };
      if (
        enemies.length < REGULAR_ENEMY_COUNT &&
        isDungeonEnemyKey(enemy.enemyKey) &&
        allowedEnemyKeys.includes(enemy.enemyKey) &&
        isOpenFloor(grid, position, reserved)
      ) {
        reserved.add(positionKey(position));
        enemies.push({ ...position, enemyKey: enemy.enemyKey });
      }
    });
  return enemies;
}

function readPositions(value: unknown): TilePosition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => entry as { x?: unknown; y?: unknown })
    .filter((entry): entry is TilePosition => Number.isInteger(entry.x) && Number.isInteger(entry.y));
}

function readSeed(value: unknown): number | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const seed = (value as { seed?: unknown }).seed;
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return seed >>> 0;
  }
  if (typeof seed === "string" && seed.trim()) {
    const parsed = Number(seed);
    return Number.isFinite(parsed) ? parsed >>> 0 : hashString(seed);
  }
  return undefined;
}

function findOpenFloorNear(
  grid: string[][],
  preferred: TilePosition,
  reserved: Set<string>
): TilePosition | undefined {
  for (let radius = 0; radius <= 8; radius += 1) {
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
  return undefined;
}

function isOpenFloor(
  grid: string[][],
  position: { x?: unknown; y?: unknown },
  reserved: Set<string>
): position is TilePosition {
  if (!Number.isInteger(position.x) || !Number.isInteger(position.y)) {
    return false;
  }

  const tilePosition = position as TilePosition;
  return (
    grid[tilePosition.y]?.[tilePosition.x] === "." &&
    !reserved.has(positionKey(tilePosition))
  );
}

function sanitizeTile(tile: string): string {
  return tile === "#" ||
    tile === "." ||
    tile === "~" ||
    tile === "O" ||
    tile === "U" ||
    tile === "V" ||
    tile === "B" ||
    tile === "D"
    ? tile
    : ".";
}

function ensureChestAccess(
  grid: string[][],
  chest: TilePosition,
  blocked?: TilePosition
): TilePosition[] {
  let accessTiles = adjacentTiles(chest).filter((position) =>
    isWalkableForGeneration(grid, position)
  );

  if (accessTiles.length > 0) {
    return accessTiles;
  }

  const repairTile = adjacentTiles(chest).find(
    (position) =>
      isPlayable(position) &&
      !(blocked && position.x === blocked.x && position.y === blocked.y)
  );
  if (repairTile) {
    grid[repairTile.y][repairTile.x] = ".";
  }

  accessTiles = adjacentTiles(chest).filter((position) =>
    isWalkableForGeneration(grid, position)
  );
  return accessTiles;
}

function pickSupplyChestReward(floor: number, floorCount: number): ChestReward {
  const depth = floor / floorCount;
  if (depth < 0.34) {
    if (floor > 1 && floor % 4 === 0) {
      return { type: "equipment", equipmentId: "clothCap", quantity: 1 };
    }
    if (floor > 1 && floor % 3 === 0) {
      return { type: "item", itemId: "returnFeather", quantity: 1 };
    }
    if (floor > 1 && floor % 2 === 0) {
      return { type: "item", itemId: "manaWater", quantity: 1 };
    }
    return { type: "item", itemId: "herb", quantity: floor === 1 ? 1 : 2 };
  }
  if (depth < 0.74) {
    if (floor % 4 === 0) {
      return { type: "equipment", equipmentId: "ironSword", quantity: 1 };
    }
    if (floor % 3 === 0) {
      return { type: "item", itemId: "returnFeather", quantity: 1 };
    }
    if (floor % 2 === 0) {
      return { type: "item", itemId: "manaWater", quantity: 1 };
    }
    return { type: "item", itemId: "strongHerb", quantity: 1 };
  }
  if (floor % 5 === 0) {
    return { type: "equipment", equipmentId: "emberCharm", quantity: 1 };
  }
  if (floor % 2 === 0) {
    return { type: "item", itemId: "returnFeather", quantity: 1 };
  }
  if (floor % 3 === 0) {
    return { type: "item", itemId: "manaWater", quantity: 1 };
  }
  return { type: "item", itemId: "magicWater", quantity: 1 };
}

function carveCorridor(grid: string[][], from: TilePosition, to: TilePosition): void {
  const stepX = from.x <= to.x ? 1 : -1;
  const stepY = from.y <= to.y ? 1 : -1;

  for (let x = from.x; x !== to.x + stepX; x += stepX) {
    carveFloor(grid, { x, y: from.y });
  }

  for (let y = from.y; y !== to.y + stepY; y += stepY) {
    carveFloor(grid, { x: to.x, y });
  }
}

function carveFloor(grid: string[][], position: TilePosition): void {
  if (isPlayable(position) && grid[position.y][position.x] !== "B") {
    grid[position.y][position.x] = ".";
  }
}

function isPlayable(position: TilePosition): boolean {
  return position.x > 0 && position.x < WIDTH - 1 && position.y > 0 && position.y < HEIGHT - 1;
}

function canReachAll(grid: string[][], start: TilePosition, targets: TilePosition[]): boolean {
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

function isWalkableForGeneration(grid: string[][], position: TilePosition): boolean {
  const tile = grid[position.y]?.[position.x];
  return tile === "." || tile === "O" || tile === "U" || tile === "V" || tile === "D";
}

function adjacentTiles(position: TilePosition): TilePosition[] {
  return [
    { x: position.x, y: position.y - 1 },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y }
  ];
}

function extractJson(content: string): string {
  const trimmed = content.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found");
  }
  return trimmed.slice(start, end + 1);
}

function positionKey(position: TilePosition): string {
  return `${position.x},${position.y}`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
