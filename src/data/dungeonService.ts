import { generateDungeon } from "./dungeonGenerator";
import { ENEMIES } from "./enemies";
import type { MapDefinition, TilePosition } from "../game/types";

export type DungeonSource = "groq" | "worker-local" | "local";

interface DungeonApiResponse {
  map?: unknown;
  source?: DungeonSource;
}

export async function createDungeon(
  floor: number,
  floorCount: number,
  upTarget?: TilePosition
): Promise<{ dungeon: MapDefinition; source: DungeonSource }> {
  try {
    const response = await fetch("/api/dungeon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "王道ファンタジー", size: "small", floor, floorCount, upTarget }),
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      throw new Error(`Dungeon API returned ${response.status}`);
    }

    const payload = (await response.json()) as DungeonApiResponse;
    if (!isDungeonMap(payload.map, floor, floorCount)) {
      throw new Error("Dungeon API returned an invalid map");
    }

    return {
      dungeon: payload.map,
      source: payload.source === "groq" ? "groq" : "worker-local"
    };
  } catch {
    return { dungeon: generateDungeon({ floor, floorCount, upTarget }), source: "local" };
  }
}

function isDungeonMap(value: unknown, floor: number, floorCount: number): value is MapDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const map = value as MapDefinition;
  const baseValid =
    map.id === "dungeon" &&
    typeof map.name === "string" &&
    isTilePosition(map.spawn) &&
    map.floor === floor &&
    map.floorCount === floorCount &&
    Array.isArray(map.rows) &&
    map.rows.length === 15 &&
    map.rows.every((row) => typeof row === "string" && row.length === 20) &&
    Array.isArray(map.portals) &&
    Array.isArray(map.npcs) &&
    Array.isArray(map.chests) &&
    Array.isArray(map.enemies) &&
    map.enemies.length >= 2 &&
    map.enemies.every(
      (enemy) =>
        typeof enemy.id === "string" &&
        typeof enemy.enemyKey === "string" &&
        Boolean(ENEMIES[enemy.enemyKey]) &&
        isTilePosition(enemy)
    ) &&
    map.portals.some((portal) => portal.kind === "stairs-up" && isTilePosition(portal));

  if (!baseValid) {
    return false;
  }

  if (floor >= floorCount) {
    return (
      map.chests.some((chest) => chest.id === "relic-chest" && isTilePosition(chest)) &&
      map.enemies.some(
        (enemy) =>
          enemy.id === "dungeon-guardian" &&
          enemy.enemyKey === "guardian" &&
          isTilePosition(enemy)
      )
    );
  }

  return (
    map.chests.length === 0 &&
    map.portals.some(
      (portal) =>
        portal.kind === "stairs-down" &&
        portal.toMap === "dungeon" &&
        portal.toFloor === floor + 1 &&
        isTilePosition(portal)
    ) &&
    map.enemies.some(
      (enemy) =>
        enemy.enemyKey !== "guardian" &&
        isTilePosition(enemy)
    )
  );
}

function isTilePosition(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const position = value as { x?: unknown; y?: unknown };
  return Number.isInteger(position.x) && Number.isInteger(position.y);
}
