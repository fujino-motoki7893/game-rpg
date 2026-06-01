import { generateDungeon } from "./dungeonGenerator";
import { ENEMIES } from "./enemies";
import type { MapDefinition } from "../game/types";

export type DungeonSource = "groq" | "worker-local" | "local";

interface DungeonApiResponse {
  map?: unknown;
  source?: DungeonSource;
}

export async function createDungeon(): Promise<{ dungeon: MapDefinition; source: DungeonSource }> {
  try {
    const response = await fetch("/api/dungeon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "王道ファンタジー", size: "small" }),
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      throw new Error(`Dungeon API returned ${response.status}`);
    }

    const payload = (await response.json()) as DungeonApiResponse;
    if (!isDungeonMap(payload.map)) {
      throw new Error("Dungeon API returned an invalid map");
    }

    return {
      dungeon: payload.map,
      source: payload.source === "groq" ? "groq" : "worker-local"
    };
  } catch {
    return { dungeon: generateDungeon(), source: "local" };
  }
}

function isDungeonMap(value: unknown): value is MapDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const map = value as MapDefinition;
  return (
    map.id === "dungeon" &&
    typeof map.name === "string" &&
    isTilePosition(map.spawn) &&
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
    map.chests.some((chest) => chest.id === "relic-chest" && isTilePosition(chest)) &&
    map.enemies.some(
      (enemy) =>
        enemy.id === "dungeon-guardian" &&
        enemy.enemyKey === "guardian" &&
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
