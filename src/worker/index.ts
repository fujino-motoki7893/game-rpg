import { generateDungeon } from "../data/dungeonGenerator";
import { DUNGEON_ENEMY_KEYS, isDungeonEnemyKey, type DungeonEnemyKey } from "../data/enemies";
import type { EnemySpawn, MapDefinition, TilePosition } from "../game/types";

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

const WIDTH = 20;
const HEIGHT = 15;
const DEFAULT_MODEL = "llama-3.1-8b-instant";
const DUNGEON_NAME = "エンバーフォール洞窟";
const REGULAR_ENEMY_COUNT = 3;

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
      return createDungeonResponse(env);
    }

    if (url.pathname.startsWith("/api/")) {
      return jsonResponse({ error: "Not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};

async function createDungeonResponse(env: Env): Promise<Response> {
  if (!env.GROQ_API_KEY) {
    return jsonResponse({ map: generateDungeon(), source: "worker-local" });
  }

  try {
    const map = await generateGroqDungeon(env);
    return jsonResponse({ map, source: "groq" });
  } catch (error) {
    console.warn(
      "Groq dungeon generation failed",
      error instanceof Error ? error.message : "unknown error"
    );
    return jsonResponse({
      map: generateDungeon(),
      source: "worker-local",
      warning: "groq-unavailable"
    });
  }
}

async function generateGroqDungeon(env: Env): Promise<MapDefinition> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL ?? DEFAULT_MODEL,
      temperature: 0.8,
      max_completion_tokens: 1600,
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
            "Create a 20x15 classic fantasy cave dungeon.",
            "Return a JSON object with rows, chests, and enemies.",
            "rows must be exactly 15 strings, each exactly 20 characters.",
            "Allowed row characters: # wall, . floor, ~ water, O exit portal, B relic chest, D guardian floor.",
            "The outer border must be #. Put O at x=1,y=1.",
            "Put one B chest and one D guardian near the deeper side of the dungeon.",
            `Add exactly ${REGULAR_ENEMY_COUNT} regular enemies and one guardian enemy in enemies.`,
            `Regular enemyKey values must come from: ${DUNGEON_ENEMY_KEYS.join(", ")}.`,
            "The guardian enemyKey must be guardian.",
            "Every enemy and at least one tile next to the chest must be reachable from O without crossing #, ~, or B.",
            "Also include a numeric seed field for deterministic fallback.",
            "Example shape: {\"rows\":[\"####################\",...],\"chests\":[{\"x\":15,\"y\":12}],\"enemies\":[{\"enemyKey\":\"bat\",\"x\":7,\"y\":4},{\"enemyKey\":\"skeleton\",\"x\":12,\"y\":8},{\"enemyKey\":\"mimic\",\"x\":10,\"y\":11},{\"enemyKey\":\"guardian\",\"x\":15,\"y\":13}]}"
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
  const map = normalizeDungeon(parsed);
  return map ?? generateDungeon(readSeed(parsed) ?? hashString(content));
}

function normalizeDungeon(value: unknown): MapDefinition | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = value as { rows?: unknown; chests?: unknown; enemies?: unknown };
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
      if (rows[y][x] === "O" || rows[y][x] === "B" || rows[y][x] === "D") {
        rows[y][x] = ".";
      }
    }
  }

  const spawn = { x: 1, y: 1 };
  rows[spawn.y][spawn.x] = ".";
  const reserved = new Set<string>([positionKey(spawn)]);
  const chest = pickChest(raw.chests, rows, reserved) ?? findOpenFloorNear(rows, { x: 15, y: 12 }, reserved);
  if (!chest) {
    return undefined;
  }
  reserved.add(positionKey(chest));

  const guardian =
    pickEnemy(raw.enemies, "guardian", rows, reserved) ??
    findOpenFloorNear(rows, { x: chest.x, y: chest.y + 1 }, reserved);
  if (!guardian) {
    return undefined;
  }
  reserved.add(positionKey(guardian));

  const regularEnemies = pickRegularEnemies(raw.enemies, rows, reserved);
  while (regularEnemies.length < REGULAR_ENEMY_COUNT) {
    const fallback = findOpenFloorNear(
      rows,
      { x: 6 + regularEnemies.length * 4, y: 5 + regularEnemies.length * 3 },
      reserved
    );
    if (!fallback) {
      return undefined;
    }
    reserved.add(positionKey(fallback));
    regularEnemies.push({
      ...fallback,
      enemyKey: DUNGEON_ENEMY_KEYS[regularEnemies.length % DUNGEON_ENEMY_KEYS.length]
    });
  }

  rows[spawn.y][spawn.x] = "O";
  rows[chest.y][chest.x] = "B";
  rows[guardian.y][guardian.x] = "D";

  let chestAccessTiles = ensureChestAccess(rows, chest, guardian);
  if (chestAccessTiles.length === 0) {
    return undefined;
  }

  const requiredTiles = [guardian, ...regularEnemies, ...chestAccessTiles];
  if (!canReachAll(rows, spawn, requiredTiles)) {
    requiredTiles.forEach((target) => carveCorridor(rows, spawn, target));
    rows[spawn.y][spawn.x] = "O";
    rows[chest.y][chest.x] = "B";
    rows[guardian.y][guardian.x] = "D";
    chestAccessTiles = ensureChestAccess(rows, chest, guardian);
  }

  if (!canReachAll(rows, spawn, [guardian, ...regularEnemies, ...chestAccessTiles])) {
    return undefined;
  }

  return {
    id: "dungeon",
    name: DUNGEON_NAME,
    spawn,
    rows: rows.map((row) => row.join("")),
    portals: [{ x: spawn.x, y: spawn.y, toMap: "field", toX: 2, toY: 13 }],
    npcs: [],
    chests: [{ id: "relic-chest", x: chest.x, y: chest.y }],
    enemies: [
      ...regularEnemies.map((enemy, index) => ({
        id: `dungeon-${enemy.enemyKey}-${index + 1}`,
        enemyKey: enemy.enemyKey,
        x: enemy.x,
        y: enemy.y
      })),
      { id: "dungeon-guardian", enemyKey: "guardian", x: guardian.x, y: guardian.y }
    ]
  };
}

function pickChest(
  value: unknown,
  grid: string[][],
  reserved: Set<string>
): TilePosition | undefined {
  const positions = readPositions(value);
  return positions.find((position) => isOpenFloor(grid, position, reserved));
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
  reserved: Set<string>
): NormalizedEnemySpawn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const enemies: NormalizedEnemySpawn[] = [];
  value
    .filter((enemy) => enemy && typeof enemy === "object")
    .map((enemy) => enemy as { enemyKey?: unknown; x?: unknown; y?: unknown })
    .forEach((enemy) => {
      const position = { x: enemy.x, y: enemy.y };
      if (
        enemies.length < REGULAR_ENEMY_COUNT &&
        isDungeonEnemyKey(enemy.enemyKey) &&
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
  return tile === "#" || tile === "." || tile === "~" || tile === "O" || tile === "B" || tile === "D"
    ? tile
    : ".";
}

function ensureChestAccess(
  grid: string[][],
  chest: TilePosition,
  guardian: TilePosition
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
      !(position.x === guardian.x && position.y === guardian.y)
  );
  if (repairTile) {
    grid[repairTile.y][repairTile.x] = ".";
  }

  accessTiles = adjacentTiles(chest).filter((position) =>
    isWalkableForGeneration(grid, position)
  );
  return accessTiles;
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
  return tile === "." || tile === "O" || tile === "D";
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
